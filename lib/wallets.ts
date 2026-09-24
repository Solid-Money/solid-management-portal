import api from "@/lib/api";
import { formatDateTime as formatDateTimeUtil, formatNumber, formatUsd } from "@/lib/utils";
import {
  ChainBalance,
  WalletAsset,
  WalletFailuresResponse,
  WalletFlowResponse,
  WalletForecastResponse,
  WalletInfo,
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

export const chainStatuses = (chain: ChainBalance): BalanceStatus[] =>
  monitoredAssets(chain).map((reading) => reading.status);

export const walletStatuses = (wallet: WalletInfo): BalanceStatus[] =>
  wallet.chains.flatMap(chainStatuses);

export const walletSeverity = (wallet: WalletInfo): 0 | 1 | 2 =>
  severityOf(walletStatuses(wallet));

/** Grouped by role, roles in blast-radius order, wallets worst-first within each. */
export function groupByRole(
  wallets: WalletInfo[],
  roleOrder: WalletRole[]
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
            walletSeverity(a.wallet) - walletSeverity(b.wallet) ||
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
