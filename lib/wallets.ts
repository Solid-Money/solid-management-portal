import api from "@/lib/api";
import { formatDateTime as formatDateTimeUtil, formatNumber, formatUsd } from "@/lib/utils";
import {
  ChainBalance,
  ExternalAccountStatus,
  ExternalAccountsResponse,
  FundingLedgerResponse,
  WalletAsset,
  WalletAssetFlow,
  WalletAssetPlan,
  WalletFailuresResponse,
  WalletFlowResponse,
  WalletForecastResponse,
  WalletInfo,
  WalletPlansResponse,
  WalletRefillPlan,
  WalletRole,
  WalletTransfersResponse,
} from "@/types";

/**
 * Wallet names carry spaces and parentheses ("Paymaster (Fuse)"), so every
 * request encodes the name. It is the same key the wallet config, the Slack
 * alerts and this page already agree on, which is worth more than a slug.
 */
const path = (walletName: string, suffix: string) =>
  `/admin/v1/wallets/${encodeURIComponent(walletName)}/${suffix}`;

export const getWalletTransfers = (
  walletName: string,
  params: {
    chainId?: number;
    asset?: WalletAsset;
    direction?: "incoming" | "outgoing" | "all";
    counterparty?: string;
    limit?: number;
  } = {}
) =>
  api
    .get<WalletTransfersResponse>(path(walletName, "transfers"), { params })
    .then((response) => response.data);

export const getWalletFailures = (
  walletName: string,
  params: { chainId?: number; sinceDays?: number; limit?: number } = {}
) =>
  api
    .get<WalletFailuresResponse>(path(walletName, "failures"), { params })
    .then((response) => response.data);

/**
 * Every wallet's verdict and refill plan in one call.
 *
 * Paired with `/wallets/status`: that gives live balances against the fixed
 * configured thresholds, this gives the verdict to actually render. Keeping
 * them apart means the board paints as soon as balances land and settles its
 * colours once, rather than showing a threshold reading it is about to
 * contradict when a card is opened.
 */
export const getWalletPlans = (windowDays = 7) =>
  api
    .get<WalletPlansResponse>("/admin/v1/wallets/plans", {
      params: { windowDays },
    })
    .then((response) => response.data);

export const getWalletFlow = (walletName: string, windowDays = 7) =>
  api
    .get<WalletFlowResponse>(path(walletName, "flow"), {
      params: { windowDays },
    })
    .then((response) => response.data);

export const getWalletForecast = (walletName: string) =>
  api
    .get<WalletForecastResponse>(path(walletName, "forecast"))
    .then((response) => response.data);

export const getWalletBalanceSeries = (
  walletName: string,
  chainId: number,
  asset: WalletAsset,
  windowDays = 7
) =>
  api
    .get<Array<{ capturedAt: string; balance: number }>>(
      path(walletName, "balance-series"),
      { params: { chainId, asset, windowDays } }
    )
    .then((response) => response.data);

/** Every top-up across every wallet, with per-day and per-week totals. */
export const getFundingLedger = (windowDays = 30) =>
  api
    .get<FundingLedgerResponse>("/admin/v1/wallets/funding-ledger", {
      params: { windowDays },
    })
    .then((response) => response.data);

export const getExternalAccounts = () =>
  api
    .get<ExternalAccountsResponse>("/admin/v1/wallets/external-accounts")
    .then((response) => response.data);

export const recordExternalBalance = (body: {
  account: string;
  balance: number;
  toppedUpBy?: number;
  note?: string;
}) =>
  api
    .post<ExternalAccountStatus>(
      "/admin/v1/wallets/external-accounts/readings",
      body
    )
    .then((response) => response.data);

// --- Reading a chain row by asset -------------------------------------------

export type BalanceStatus = "OK" | "LOW" | "CRITICAL" | "N/A";

export interface ChainAssetReading {
  asset: WalletAsset;
  label: string;
  balance: string;
  threshold: string;
  status: BalanceStatus;
  /** The ERC-20 the balance was read from; absent for the native gas token. */
  tokenAddress?: string;
}

export const WALLET_ASSETS: WalletAsset[] = [
  "gas",
  "soFUSE",
  "soUSD",
  "USDC",
  "USDT",
];

/**
 * Read one asset off a chain row.
 *
 * `ChainBalance` stores five assets as five parallel triples of fields, so any
 * code that wants "the soFUSE numbers" has to know three field names and get
 * all three right. Spelling that out per call site is how soFUSE ended up
 * missing from four of the five severity checks this page used to run.
 */
export function readChainAsset(
  chain: ChainBalance,
  asset: WalletAsset
): ChainAssetReading {
  switch (asset) {
    case "gas":
      return {
        asset,
        label: chain.gasTokenSymbol,
        balance: chain.gasBalance,
        threshold: chain.gasThreshold,
        status: chain.gasStatus,
      };
    case "USDC":
      return {
        asset,
        label: "USDC",
        balance: chain.usdcBalance,
        threshold: chain.usdcThreshold,
        status: chain.usdcStatus,
        tokenAddress: chain.usdcAddress,
      };
    case "USDT":
      return {
        asset,
        label: "USDT",
        balance: chain.usdtBalance ?? "0",
        threshold: chain.usdtThreshold ?? "0",
        status: chain.usdtStatus ?? "N/A",
        tokenAddress: chain.usdtAddress,
      };
    case "soUSD":
      return {
        asset,
        label: "soUSD",
        balance: chain.soUsdBalance ?? "0",
        threshold: chain.soUsdThreshold ?? "0",
        status: chain.soUsdStatus ?? "N/A",
        tokenAddress: chain.soUsdAddress,
      };
    case "soFUSE":
      return {
        asset,
        label: "soFUSE",
        balance: chain.soFuseBalance ?? "0",
        threshold: chain.soFuseThreshold ?? "0",
        status: chain.soFuseStatus ?? "N/A",
        tokenAddress: chain.soFuseAddress,
      };
  }
}

/**
 * The assets actually monitored on a chain row.
 *
 * `N/A` means the wallet is not watched for that asset there, which is not a
 * balance of zero and must never be rendered as one.
 */
export function monitoredAssets(chain: ChainBalance): ChainAssetReading[] {
  return WALLET_ASSETS.map((asset) => readChainAsset(chain, asset)).filter(
    (reading) => reading.status !== "N/A"
  );
}

// --- Severity ---------------------------------------------------------------

export const severityOf = (statuses: BalanceStatus[]): 0 | 1 | 2 => {
  if (statuses.includes("CRITICAL")) return 0;
  if (statuses.includes("LOW")) return 1;
  return 2;
};

/**
 * The key a plan row is looked up by: a token, on a chain, on a wallet.
 *
 * The same triple the backend groups by, so a lookup here cannot drift from
 * the thing it is looking up.
 */
export const planKey = (
  walletName: string,
  chainId: number,
  asset: WalletAsset
): string => `${walletName}:${chainId}:${asset}`;

/** Plan rows indexed for lookup, from the board-wide `plans` call. */
export const indexPlans = (
  plans?: WalletPlansResponse
): Map<string, WalletAssetPlan> =>
  new Map(
    (plans?.assets ?? []).map((asset) => [
      planKey(asset.walletName, asset.chainId, asset.asset),
      asset,
    ])
  );

/**
 * One asset's verdict.
 *
 * The rule itself lives in the backend, in one place, because the Slack
 * alerting has to reach the same conclusion as the page — a card that flips
 * from red to green when somebody expands it, while an alert fires overnight
 * on the reading the page has already disowned, is what happens when the
 * question is answered twice.
 *
 * What is left here is precedence, and the order is the whole point: the
 * board-wide plan wins, and the opened card's flow row is only a fallback for
 * when there is no plan at all.
 *
 * It is tempting to prefer the flow row because it is fresher — the plans
 * call is cached for five minutes server-side and reads every wallet's
 * balance in one pass, where a flow call re-reads one wallet on the spot. But
 * preferring it is how the colours start moving again: the two reads are
 * taken at different moments, so an asset sitting near its floor can be
 * `LOW` in one and `OK` in the other, and the card would change its mind the
 * moment somebody clicked it. Freshness is not what this page needs; a
 * verdict that stays put while nothing moves is.
 */
export const assetVerdict = (
  status: BalanceStatus,
  plan?: WalletAssetPlan,
  flow?: WalletAssetFlow
): BalanceStatus => plan?.verdict ?? flow?.verdict ?? status;

/**
 * The refill plan to quote — the board-wide one, for the reason above.
 *
 * The floor is the denominator every balance on the page is shown against, so
 * it has to come from the same read as the verdict. Quoting the flow's floor
 * under a plans-derived colour is the same contradiction one level down: the
 * number would change on expand even though the colour did not.
 */
export const assetRefillPlan = (
  plan?: WalletAssetPlan,
  flow?: WalletAssetFlow
): WalletRefillPlan | undefined => plan?.plan ?? flow?.plan;

/** Days of cover to quote, from the same read as the verdict and the floor. */
export const assetRunwayDays = (
  plan?: WalletAssetPlan,
  flow?: WalletAssetFlow
): number | undefined => plan?.daysOfRunway ?? flow?.daysOfRunway;

export const chainStatuses = (chain: ChainBalance): BalanceStatus[] =>
  monitoredAssets(chain).map((reading) => reading.status);

export const walletStatuses = (wallet: WalletInfo): BalanceStatus[] =>
  wallet.chains.flatMap(chainStatuses);

export const walletSeverity = (wallet: WalletInfo): 0 | 1 | 2 =>
  severityOf(walletStatuses(wallet));

/**
 * One wallet's severity, from the verdicts rather than the thresholds.
 *
 * Returns `undefined` while the plans call is still in flight. The board
 * renders that as "assessing cover", which is the honest state: showing a
 * threshold verdict it is about to replace is what made the page appear to
 * change its mind about wallets nobody had touched.
 */
export const walletVerdictSeverity = (
  wallet: WalletInfo,
  plans: Map<string, WalletAssetPlan>,
  ready: boolean
): 0 | 1 | 2 | undefined => {
  if (!ready) return undefined;
  return severityOf(
    wallet.chains.flatMap((chain) =>
      monitoredAssets(chain).map((reading) =>
        assetVerdict(
          reading.status,
          plans.get(planKey(wallet.name, chain.chainId, reading.asset))
        )
      )
    )
  );
};

/** Grouped by role, roles in blast-radius order, wallets worst-first within each. */
export function groupByRole(
  wallets: WalletInfo[],
  roleOrder: WalletRole[],
  severityOfWallet: (wallet: WalletInfo) => 0 | 1 | 2 = walletSeverity
): Array<{ role: WalletRole; wallets: WalletInfo[] }> {
  const byRole = new Map<WalletRole, WalletInfo[]>();

  wallets.forEach((wallet) => {
    const role = wallet.role ?? "Unclassified";
    byRole.set(role, [...(byRole.get(role) ?? []), wallet]);
  });

  return roleOrder
    .filter((role) => byRole.has(role))
    .map((role) => ({
      role,
      // Ties keep configured order, which keeps related wallets adjacent.
      wallets: (byRole.get(role) ?? [])
        .map((wallet, index) => ({ wallet, index }))
        .sort(
          (a, b) =>
            severityOfWallet(a.wallet) - severityOfWallet(b.wallet) ||
            a.index - b.index
        )
        .map(({ wallet }) => wallet),
    }));
}

// --- Formatting -------------------------------------------------------------

export const truncateAddress = (address?: string): string =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

/**
 * Format a token amount at a precision that suits its size.
 *
 * A paymaster balance of 5,655 FUSE and a gas balance of 0.0042 ETH are both
 * normal, and one fixed precision makes one of them unreadable.
 */
export function formatAmount(value: string | number): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(amount)) return "—";
  if (amount === 0) return "0";
  const abs = Math.abs(amount);
  const decimals = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.001 ? 4 : 8;
  return formatNumber(amount, decimals, 0);
}

/** A USD figure, or an em dash when there is nothing to price. */
export const formatWalletUsd = (value?: number): string =>
  value == null || !Number.isFinite(value) ? "—" : formatUsd(value);

/**
 * Days of runway, worded so the reader does not have to interpret a decimal.
 *
 * Anything past a month is "30+ days": the burn rate is a trailing average and
 * quoting "94 days" from it implies a precision the number does not have.
 */
export function formatRunway(days?: number): string {
  if (days == null || !Number.isFinite(days)) return "—";
  if (days < 1) {
    const hours = Math.max(Math.round(days * 24), 0);
    return hours <= 1 ? "under an hour" : `~${hours}h`;
  }
  if (days > 30) return "30+ days";
  return `${days.toFixed(days < 10 ? 1 : 0)} days`;
}

/** "3 days ago", "2h ago" — how long a wallet has been blocking, at a glance. */
export function formatAge(iso?: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const formatDateTime = (iso?: string): string =>
  iso ? formatDateTimeUtil(iso) : "—";
