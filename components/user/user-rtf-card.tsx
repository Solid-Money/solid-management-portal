"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Zap } from "lucide-react";

import { getUserRtf } from "@/lib/api";
import {
  RainRtfAsset,
  RainRtfChain,
  RainRtfSpenderKind,
  RainRtfStatus,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyableValue } from "@/components/ui/copy-button";

const SPENDER_LABELS: Record<RainRtfSpenderKind, string> = {
  collateral: "Collateral contract",
  operator: "Rain operator",
};

/**
 * Why RTF is not offered, in words support can act on.
 *
 * The codes come from the backend and name a different fix in each case —
 * "ask Rain to enable the tenant" is a different ticket from "this is a Wirex
 * cardholder" — so they are spelled out rather than shown raw.
 */
const INELIGIBLE_LABELS: Record<string, string> = {
  "tenant-disabled":
    "Real-Time Funding is switched off for this environment. Rain has to enable the tenant, and RAIN_RTF_ENABLED has to be true.",
  "no-rain-customer":
    "No Rain card customer. RTF is a Rain feature — a Wirex cardholder has no collateral contract to pull into.",
  "no-wallet": "This user has no Safe yet, so there is no wallet to grant an allowance from.",
  "no-supported-chain":
    "Rain reports no collateral contract on any chain this build knows the RTF asset for.",
  "contracts-unavailable":
    "Rain's contracts endpoint could not be reached, so the chains could not be resolved. Transient — retry.",
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Ten to the power of `exponent`, as a `BigInt`.
 *
 * Built from a string rather than written as `10n ** 30n` because this project
 * targets ES2017, where BigInt *literals* are a syntax error even though the
 * type is available through `lib: esnext`. Same value, and it keeps the target
 * a decision for the whole app rather than one this panel forces.
 */
const pow10 = (exponent: number) => BigInt(`1${"0".repeat(exponent)}`);

const ZERO = BigInt(0);

/**
 * A smallest-units amount, rendered for a human.
 *
 * `BigInt` rather than `Number`, because an unlimited allowance is `uint256`
 * max and `Number` cannot hold it — it rounds to `1.1579208923731619e+77` and
 * then formats confidently. Returns `null` for anything that is not a
 * non-negative integer string, which the caller renders as "unknown" rather
 * than as zero.
 */
function formatUnits(
  raw: string | null | undefined,
  decimals: number,
  maximumFractionDigits = 2,
): string | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;

  const amount = BigInt(raw.trim());
  const divisor = pow10(decimals);
  const whole = (amount / divisor).toLocaleString("en-US");
  const fraction = amount % divisor;
  if (fraction === ZERO || maximumFractionDigits === 0) return whole;

  // Pad to the token's full precision before slicing. Slicing first would read
  // 1 wei of a 6dp token as 0.1.
  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, "");

  return fractionText ? `${whole}.${fractionText}` : whole;
}

/**
 * An allowance, described rather than printed.
 *
 * An unlimited allowance in full is 78 digits and tells a reader nothing, so
 * anything past a threshold no real balance reaches is reported as
 * "Unlimited". The threshold is deliberately far above any plausible card
 * spend and far below `uint256` max, so a genuinely large-but-finite approval
 * still reads as a number.
 */
const UNLIMITED_FLOOR = pow10(30);

function describeAllowance(
  allowance: string | null,
  decimals: number,
  symbol: string,
): string {
  if (allowance === null) return "Unknown (chain unreadable)";
  if (!/^\d+$/.test(allowance)) return "Unknown";
  const value = BigInt(allowance);
  if (value >= UNLIMITED_FLOOR) return "Unlimited";
  if (value === ZERO) return "None";
  return `${formatUnits(allowance, decimals) ?? "Unknown"} ${symbol}`;
}

function AssetBlock({
  asset,
  chainUnreadable,
}: {
  asset: RainRtfAsset;
  chainUnreadable: boolean;
}) {
  const balance = formatUnits(asset.walletBalance, asset.tokenDecimals);

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-gray-900">
            {asset.symbol}
          </span>
          <CopyableValue value={asset.tokenAddress} truncate />
        </div>
        <Badge variant={asset.isApproved ? "success" : "danger"}>
          {asset.isApproved ? "Approved" : "Not approved"}
        </Badge>
      </div>

      <dl className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-gray-500">Wallet balance</dt>
          <dd className="font-mono text-xs">
            {balance === null ? (
              <span className="text-gray-400">—</span>
            ) : (
              `${balance} ${asset.symbol}`
            )}
          </dd>
        </div>
        {asset.spenders.map((spender) => (
          <div
            key={`${spender.kind}-${spender.address}`}
            className="flex items-center justify-between gap-2"
          >
            <dt className="flex items-center gap-1.5 text-xs text-gray-500">
              {SPENDER_LABELS[spender.kind] ?? spender.kind}
              <Badge variant={spender.isApproved ? "success" : "muted"}>
                {spender.isApproved ? "ok" : "pending"}
              </Badge>
            </dt>
            <dd className="font-mono text-xs text-gray-700">
              {describeAllowance(
                spender.currentAllowance,
                asset.tokenDecimals,
                asset.symbol,
              )}
            </dd>
          </div>
        ))}
        {asset.spenders.length === 0 ? (
          <p className="text-xs text-gray-500">
            No spender to approve — Rain has provisioned no collateral contract here and the
            operator is switched off.
          </p>
        ) : null}
      </dl>

      {/* Suppressed when the whole chain is unreadable: "not approved" there
          means "we could not look", and the chain-level warning already says
          so. Repeating it per asset would read as several separate problems. */}
      {!asset.isApproved && !chainUnreadable ? (
        <p className="mt-2 text-xs text-gray-500">
          Authorizations in this asset will decline until every spender above is approved.
        </p>
      ) : null}
    </div>
  );
}

function ChainRow({ chain }: { chain: RainRtfChain }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{chain.name}</span>
          <Badge variant="muted">{chain.chainId}</Badge>
          {chain.environment === "sandbox" ? (
            <Badge variant="warning">Sandbox</Badge>
          ) : null}
        </div>
        <Badge variant={chain.isApproved ? "success" : "danger"}>
          {chain.isApproved ? "Approved" : `${chain.pendingApprovals} pending`}
        </Badge>
      </div>

      {chain.unavailableReason ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {chain.unavailableReason}. Allowances below are unknown, not zero.
        </p>
      ) : null}

      <dl className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-gray-500">Wallet</dt>
          <dd>
            <CopyableValue value={chain.walletAddress} truncate />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-gray-500">Collateral contract</dt>
          <dd>
            <CopyableValue value={chain.collateralAddress} truncate />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-gray-500">Terms accepted</dt>
          <dd className="text-xs text-gray-700">
            {chain.hasConsent ? formatDateTime(chain.consentAt) : "Never"}
          </dd>
        </div>
        {chain.transactionHash ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-gray-500">Approval tx</dt>
            <dd>
              <CopyableValue value={chain.transactionHash} truncate />
            </dd>
          </div>
        ) : null}
      </dl>

      {/* Per asset, because the allowances are per asset. A card fully
          approved for USDC and unapproved for EURC declines only on EURC,
          and a single chain-level badge would hide exactly that. */}
      <div className="mt-3 space-y-2">
        {chain.assets.map((asset) => (
          <AssetBlock
            key={asset.tokenAddress}
            asset={asset}
            chainUnreadable={chain.unavailableReason !== null}
          />
        ))}
      </div>

      {/* The one state that is not self-evident from the badges above: the
          cardholder granted the allowances but we never recorded the consent,
          which means the confirm call did not land. The card still works —
          the chain is what Rain reads — but the compliance record is missing,
          and that is a thing to go and fix rather than notice at audit. */}
      {chain.isApproved && !chain.hasConsent ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Allowances are granted on-chain but no terms acceptance was recorded. The card works;
          the compliance record is missing.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Real-Time Funding, for the user page.
 *
 * ## Why this panel exists
 *
 * Under RTF, a card authorization does not spend a card balance — Rain pulls
 * the amount out of the cardholder's own wallet at the moment of the swipe,
 * against an ERC-20 allowance. That makes "why did this decline?" a question
 * about an allowance and a wallet balance on a specific chain, neither of
 * which appears anywhere else in the portal. This is where support looks.
 *
 * It shows the allowance **per spender**, which matters while Rain migrates
 * its collateral contracts: before the cut-over the operator is the spender
 * that pulls, after it the user's own collateral contract is, and a cardholder
 * holding only one of the two declines on whichever side of the switch they
 * are not approved for.
 *
 * Read-only, deliberately. An allowance belongs to the cardholder's wallet and
 * can only be changed by its own signature; there is no admin action here to
 * offer, and a button implying otherwise would be a support dead end.
 */
export default function UserRtfCard({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useQuery<{ data: RainRtfStatus }>({
    queryKey: ["user-rtf", userId],
    queryFn: async () => (await getUserRtf(userId)).data,
    retry: 1,
  });

  const status = data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-600" />
          Real-Time Funding
        </CardTitle>
        {status ? (
          <CardAction>
            <Badge variant={status.tenantEnabled ? "info" : "muted"}>
              {status.tenantEnabled ? "Tenant enabled" : "Tenant off"}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : isError || !status ? (
          <p className="text-sm text-gray-500">
            Could not load Real-Time Funding status for this user.
          </p>
        ) : !status.eligible ? (
          <p className="text-sm text-gray-500">
            {INELIGIBLE_LABELS[status.ineligibleReason ?? ""] ??
              "Real-Time Funding is not available for this user."}
          </p>
        ) : (
          <div className="space-y-3">
            {status.chains.map((chain) => (
              <ChainRow key={chain.chainId} chain={chain} />
            ))}
            <p className="text-xs text-gray-500">
              Terms version {status.terms.version}
              {status.legacyRevokeAvailable
                ? " · Legacy operator allowances may now be revoked — Rain has confirmed the reversal-enabled upgrade."
                : " · Legacy operator allowance must stay in place until Rain confirms the reversal-enabled upgrade."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
