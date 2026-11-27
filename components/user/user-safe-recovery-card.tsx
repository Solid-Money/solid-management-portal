"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

import { getUserSafeRecovery } from "@/lib/api";
import { REFERRAL_APP_URL } from "@/lib/kols";
import { formatDateTime } from "@/lib/utils";
import {
  SafeRecoveryAdminUser,
  SafeRecoveryStatus,
  SafeRecoveryView,
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

const STATUS_LABELS: Record<
  SafeRecoveryStatus,
  { label: string; variant: "success" | "info" | "muted" | "danger" }
> = {
  awaiting_signature: { label: "Not signed", variant: "muted" },
  submitting: { label: "Sending", variant: "info" },
  submitted: { label: "On its way", variant: "info" },
  succeeded: { label: "Moved", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  expired: { label: "Expired", variant: "muted" },
};

function StatusBadge({ status }: { status: SafeRecoveryStatus }) {
  const { label, variant } = STATUS_LABELS[status] ?? {
    label: status,
    variant: "muted",
  };
  return <Badge variant={variant}>{label}</Badge>;
}

function RecoveryRow({ recovery }: { recovery: SafeRecoveryView }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium text-gray-900">
          {recovery.amountFormatted} {recovery.symbol} on {recovery.network}
        </span>
        <StatusBadge status={recovery.status} />
      </div>
      <dl className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-gray-500">Started</dt>
          <dd className="text-xs text-gray-700">
            {formatDateTime(recovery.createdAt)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-gray-500">Sent to (rhino.fi)</dt>
          <dd>
            <CopyableValue value={recovery.destinationAddress} truncate />
          </dd>
        </div>
        {recovery.transactionHash ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-gray-500">Transaction</dt>
            <dd>
              <CopyableValue
                value={recovery.transactionHash}
                truncate
                href={recovery.explorerUrl}
              />
            </dd>
          </div>
        ) : null}
      </dl>
      {recovery.error ? (
        <p className="mt-2 text-xs text-red-700">{recovery.error}</p>
      ) : null}
    </div>
  );
}

/**
 * Funds in this user's Safe on networks the app does not run on, for the user
 * page.
 *
 * ## Why this panel exists
 *
 * "I sent USDT to my Solid address on Plasma and it never arrived" is a
 * deposit ticket, but those funds are in the user's own Safe, on a network the
 * app cannot send on, so nothing else in the portal shows them. This reads the
 * balances live from the chain, so support can confirm they are there.
 *
 * The user moves them back themselves: they open the Rescue tokens screen
 * (the link below), approve one transfer with their passkey, and the Safe
 * Recovery Relayer sends it and pays the gas. The funds go to the user's
 * rhino.fi address on that network, which pays USDC into their Safe on Base.
 *
 * Read-only, deliberately: only the user's passkey can move these funds.
 */
export default function UserSafeRecoveryCard({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useQuery<{
    data: SafeRecoveryAdminUser;
  }>({
    queryKey: ["user-safe-recovery", userId],
    queryFn: async () => (await getUserSafeRecovery(userId)).data,
    retry: 1,
  });

  const overview = data?.data;
  const networkNames = overview?.networks.map((n) => n.name).join(", ");
  const unreadable = overview?.unavailableBalances ?? [];
  const rescueLink = overview
    ? `${REFERRAL_APP_URL}${overview.appPath}`
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-indigo-600" />
          Funds on other networks
        </CardTitle>
        {overview ? (
          <CardAction>
            <Badge variant={overview.enabled ? "info" : "muted"}>
              {overview.enabled ? "Recovery on" : "Recovery off"}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : isError || !overview ? (
          <p className="text-sm text-gray-500">
            Could not load funds on other networks for this user.
          </p>
        ) : (
          <div className="space-y-3">
            {overview.balances.length === 0 ? (
              <p className="text-sm text-gray-500">
                {!overview.safeAddress
                  ? "This user has no Safe yet."
                  : unreadable.length > 0
                    ? `Nothing found in this user's Solid wallet on ${networkNames}, but not every balance could be read just now (below).`
                    : `Nothing in this user's Solid wallet on ${networkNames}.`}
              </p>
            ) : (
              <div className="space-y-2">
                {overview.balances.map((balance) => (
                  <div
                    key={`${balance.chainId}:${balance.tokenAddress}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5"
                  >
                    <span className="font-mono text-xs font-medium text-gray-900">
                      {balance.amountFormatted} {balance.symbol} on{" "}
                      {balance.network}
                    </span>
                    {balance.recovery ? (
                      <StatusBadge status={balance.recovery.status} />
                    ) : (
                      <Badge variant="warning">Not moved</Badge>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">
                    Link for the user (moves it with their passkey)
                  </span>
                  <CopyableValue value={rescueLink} />
                </div>
                {!overview.enabled ? (
                  <p className="text-xs text-amber-700">
                    Recovery is switched off on this backend
                    (SAFE_RECOVERY_ENABLED, SAFE_RECOVERY_RELAYER_PRIVATE_KEY),
                    so the link shows nothing to move until it is on.
                  </p>
                ) : null}
              </div>
            )}

            {unreadable.length > 0 ? (
              <div className="space-y-2">
                {unreadable.map((item) => (
                  <div
                    key={`${item.chainId}:${item.tokenAddress}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white p-2.5"
                  >
                    <span className="font-mono text-xs font-medium text-gray-900">
                      {item.symbol} on {item.network}
                    </span>
                    <Badge variant="muted">Could not read</Badge>
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  The network did not answer; reload to read these again.
                </p>
              </div>
            ) : null}

            {overview.recoveries.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">
                  Recoveries
                </p>
                {overview.recoveries.map((recovery) => (
                  <RecoveryRow key={recovery.id} recovery={recovery} />
                ))}
              </div>
            ) : null}

            {overview.relayerAddress ? (
              <dl className="space-y-1.5 border-t border-gray-100 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-xs text-gray-500">Relayer</dt>
                  <dd>
                    <CopyableValue value={overview.relayerAddress} truncate />
                  </dd>
                </div>
                {overview.networks.map((network) => (
                  <div
                    key={network.chainId}
                    className="flex items-center justify-between gap-2"
                  >
                    <dt className="text-xs text-gray-500">
                      Relayer gas on {network.name}
                    </dt>
                    <dd className="font-mono text-xs text-gray-700">
                      {network.relayerBalance === undefined
                        ? "Unreadable"
                        : `${network.relayerBalance} ${network.nativeSymbol}`}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
