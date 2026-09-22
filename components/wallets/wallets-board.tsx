"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Flame,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  ChainBalance,
  WalletAsset,
  WalletAssetFlow,
  WalletFilter,
  WalletInfo,
  WalletStatusResponse,
  WALLET_ROLE_ORDER,
} from "@/types";
import {
  BalanceStatus,
  chainStatuses,
  formatAmount,
  formatRunway,
  getWalletFlow,
  groupByRole,
  monitoredAssets,
  severityOf,
  truncateAddress,
  walletSeverity,
  walletStatuses,
} from "@/lib/wallets";
import WalletAssetModal from "@/components/wallets/wallet-asset-modal";

/** The unit the popup opens on: a token, on a chain, on a wallet. */
interface AssetTarget {
  wallet: WalletInfo;
  chainId: number;
  chainName: string;
  asset: WalletAsset;
}

export default function WalletsBoard({ filter }: { filter: WalletFilter }) {
  const [target, setTarget] = useState<AssetTarget | null>(null);
  const [flowForTarget, setFlowForTarget] = useState<WalletAssetFlow | undefined>();

  const { data, isLoading, error } = useQuery<WalletStatusResponse>({
    queryKey: ["wallets"],
    queryFn: async () => {
      const response = await api.get("/admin/v1/wallets/status");
      return response.data;
    },
    refetchInterval: 60000,
  });

  const groups = useMemo(() => {
    if (!data) return [];
    const visible = data.wallets.filter((wallet) => {
      if (filter === "all") return true;
      const active = wallet.active !== false;
      return filter === "active" ? active : !active;
    });
    return groupByRole(visible, WALLET_ROLE_ORDER);
  }, [data, filter]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Failed to load wallet status. Try again.</p>
      </div>
    );
  }

  if (!data || data.wallets.length === 0) {
    return <Notice>No wallets configured.</Notice>;
  }

  const shown = groups.flatMap((group) => group.wallets);
  const criticalCount = shown.filter((w) => walletSeverity(w) === 0).length;
  const lowCount = shown.filter((w) => walletSeverity(w) === 1).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-gray-500">
          Balances as of {new Date(data.lastUpdated).toLocaleString()}
        </p>
        {criticalCount > 0 && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            {criticalCount} critical
          </span>
        )}
        {lowCount > 0 && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
            {lowCount} low
          </span>
        )}
        <span className="ml-auto text-xs text-gray-500">
          Click any token row to see who funded it, who it has blocked, and
          what it still owes.
        </span>
      </div>

      {shown.length === 0 && <Notice>No {filter} wallets to display.</Notice>}

      {groups.map((group) => (
        <section key={group.role} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              {group.role}
            </h2>
            <span className="text-xs text-gray-400">
              {group.wallets.length} wallet
              {group.wallets.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-2">
            {group.wallets.map((wallet) => (
              <WalletCard
                key={wallet.name}
                wallet={wallet}
                onOpenAsset={(chain, asset, flow) => {
                  setTarget({
                    wallet,
                    chainId: chain.chainId,
                    chainName: chain.chainName,
                    asset,
                  });
                  setFlowForTarget(flow);
                }}
              />
            ))}
          </div>
        </section>
      ))}

      {target && (
        <WalletAssetModal
          wallet={target.wallet}
          target={{
            chainId: target.chainId,
            chainName: target.chainName,
            asset: target.asset,
          }}
          flow={flowForTarget}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

function WalletCard({
  wallet,
  onOpenAsset,
}: {
  wallet: WalletInfo;
  onOpenAsset: (
    chain: ChainBalance,
    asset: WalletAsset,
    flow?: WalletAssetFlow
  ) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const severity = walletSeverity(wallet);

  // Fetched only once the card is opened. The flow call reads a wallet's
  // transfer history across every chain it runs on; doing that eagerly for
  // fourteen wallets on every page load would cost far more than it tells
  // anyone whose wallets are all healthy.
  const { data: flow, isLoading: flowLoading } = useQuery({
    queryKey: ["wallet-flow", wallet.name],
    queryFn: () => getWalletFlow(wallet.name, 7),
    enabled: expanded,
    staleTime: 5 * 60 * 1000,
  });

  const flowByKey = useMemo(() => {
    const map = new Map<string, WalletAssetFlow>();
    (flow?.assets ?? []).forEach((asset) =>
      map.set(`${asset.chainId}:${asset.asset}`, asset)
    );
    return map;
  }, [flow]);

  /**
   * Every monitored asset across every chain, hottest first.
   *
   * While the flow call is in flight the list is still ordered — by severity —
   * so the card never reflows from "correct" to "differently correct" under the
   * reader's cursor, and an empty asset is at the top either way.
   */
  const rows = useMemo(() => {
    const all = wallet.chains.flatMap((chain) =>
      monitoredAssets(chain).map((reading) => ({
        chain,
        reading,
        flow: flowByKey.get(`${chain.chainId}:${reading.asset}`),
      }))
    );

    return all
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const severityDiff =
          severityOf([a.row.reading.status]) - severityOf([b.row.reading.status]);
        if (severityDiff !== 0) return severityDiff;
        const scoreDiff =
          (b.row.flow?.activityScore ?? 0) - (a.row.flow?.activityScore ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return a.index - b.index;
      })
      .map(({ row }) => row);
  }, [wallet.chains, flowByKey]);

  const tone =
    severity === 0
      ? "border-red-300 bg-red-50"
      : severity === 1
      ? "border-yellow-200 bg-yellow-50"
      : "border-gray-200 bg-white";

  return (
    <div className={`overflow-hidden rounded-lg border ${tone}`}>
      {/* A div rather than a button: the header carries its own copy-address
          button, and a button inside a button is invalid HTML that React
          reports as a hydration error. role + tabIndex + key handling keep it
          reachable from the keyboard. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((open) => !open);
          }
        }}
        className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-black/[0.02]"
      >
        <SeverityIcon severity={severity} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-gray-900">{wallet.name}</h3>
            {wallet.active === false && (
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[11px] text-gray-700">
                Inactive
              </span>
            )}
            {severity === 0 && (
              <span className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                CRITICAL
              </span>
            )}
            {severity === 1 && (
              <span className="rounded bg-yellow-200 px-1.5 py-0.5 text-[11px] font-medium text-yellow-900">
                LOW
              </span>
            )}
            {wallet.hasFailureSources === false && (
              <span
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500"
                title="No failure signal is mapped to this wallet, so we cannot say whether it has blocked anyone."
              >
                no failure signal
              </span>
            )}
          </div>

          <p className="mt-0.5 text-sm text-gray-600">
            {wallet.funds ?? wallet.description}
          </p>

          {/* Shown only when it matters. On a healthy wallet this is noise; on
              an empty one it is the line that decides whether to act now. */}
          {severity < 2 && wallet.impactWhenEmpty && (
            <p
              className={`mt-1 text-sm ${
                severity === 0 ? "text-red-800" : "text-yellow-900"
              }`}
            >
              <strong>Breaks:</strong> {wallet.impactWhenEmpty}
            </p>
          )}

          {wallet.active === false && wallet.inactiveReason && (
            <p className="mt-1 text-xs text-gray-500">{wallet.inactiveReason}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <AddressChip address={wallet.address} />
            {rows.slice(0, 4).map(({ chain, reading, flow: assetFlow }) => (
              <AssetChip
                key={`${chain.chainId}:${reading.asset}`}
                label={reading.label}
                chainName={chain.chainName}
                balance={reading.balance}
                threshold={reading.threshold}
                status={reading.status}
                runwayDays={assetFlow?.daysOfRunway}
              />
            ))}
            {rows.length > 4 && (
              <span className="text-xs text-gray-400">
                +{rows.length - 4} more
              </span>
            )}
          </div>
        </div>
        <span className="mt-1 text-gray-400">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 bg-white">
          {flowLoading && (
            <p className="px-4 py-2 text-xs text-gray-500">
              Working out what this wallet actually consumes…
            </p>
          )}
          {flow?.degraded && (
            <p className="px-4 py-2 text-xs text-amber-700">
              Transfer history is unavailable right now, so burn rate and the
              hot-asset ordering are missing. Balances below are live.
            </p>
          )}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Token / chain</th>
                <th className="px-4 py-2">Balance vs floor</th>
                <th className="px-4 py-2">Burn / day</th>
                <th className="px-4 py-2">Runway</th>
                <th className="px-4 py-2">Activity</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ chain, reading, flow: assetFlow }, index) => (
                <tr
                  key={`${chain.chainId}:${reading.asset}`}
                  onClick={() => onOpenAsset(chain, reading.asset, assetFlow)}
                  className="cursor-pointer hover:bg-indigo-50/50"
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5 font-medium text-gray-900">
                      {/* The hottest asset is the one an operator keeps having
                          to fund; flagging it is the whole point of the sort. */}
                      {index === 0 &&
                        (assetFlow?.outflowCount ?? 0) > 0 && (
                          <Flame className="h-3.5 w-3.5 text-orange-500" />
                        )}
                      {reading.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {chain.chainName}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <StatusText status={reading.status} />
                    <div className="text-xs text-gray-500">
                      {formatAmount(reading.balance)} /{" "}
                      {formatAmount(reading.threshold)}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {assetFlow?.measuredBurnPerDay != null
                      ? formatAmount(assetFlow.measuredBurnPerDay)
                      : assetFlow && assetFlow.outflowPerDay > 0
                      ? `~${formatAmount(assetFlow.outflowPerDay)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <RunwayCell flow={assetFlow} />
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {assetFlow
                      ? `${assetFlow.outflowCount} out · ${assetFlow.inflowCount} in`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-indigo-600">
                    Details →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {severity < 2 && <TopUpInstruction wallet={wallet} />}
        </div>
      )}
    </div>
  );
}

/**
 * What to send, and where, for every chain that is short.
 *
 * Kept verbatim from the old page, because it is the one part of it that
 * already did its job: "Send at least 100 soUSD on Fuse" is what someone
 * actually needs at 2am.
 */
function TopUpInstruction({ wallet }: { wallet: WalletInfo }) {
  const shortfalls = wallet.chains
    .map((chain) => ({
      chain,
      needs: monitoredAssets(chain)
        .filter(
          (reading) =>
            reading.status === "LOW" || reading.status === "CRITICAL"
        )
        .map((reading) => `${formatAmount(reading.threshold)} ${reading.label}`),
    }))
    .filter((row) => row.needs.length > 0);

  if (shortfalls.length === 0) return null;

  return (
    <div className="border-t border-gray-200 px-4 py-3">
      {shortfalls.map(({ chain, needs }) => (
        <p key={chain.chainId} className="text-sm text-gray-800">
          Send at least <strong>{needs.join(" and ")}</strong> on{" "}
          {chain.chainName} to{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
            {wallet.address}
          </code>
        </p>
      ))}
      {wallet.topUpHint && (
        <p className="mt-2 text-xs text-indigo-900">{wallet.topUpHint}</p>
      )}
    </div>
  );
}

function RunwayCell({ flow }: { flow?: WalletAssetFlow }) {
  if (!flow) return <span className="text-gray-400">—</span>;
  if (flow.daysOfRunway == null) {
    return (
      <span
        className="text-xs text-gray-400"
        title={
          flow.snapshotCount < 2
            ? "Balance history is still building. Until it spans a few hours, a burn rate would be noise."
            : "Nothing observed leaving this balance in the window."
        }
      >
        {flow.snapshotCount < 2 ? "warming up" : "not draining"}
      </span>
    );
  }

  // Under a week of cover is worth funding this week whatever the threshold
  // says — a wallet at 3x its floor with two days left needs money today.
  const urgent = flow.daysOfRunway < 7;
  return (
    <span
      className={urgent ? "font-medium text-red-700" : "text-gray-700"}
      title={
        flow.runwayBasis === "measured"
          ? "Measured from balance history, gas fees included."
          : "Estimated from transfers out only — gas spent as fees is not counted, so this is optimistic."
      }
    >
      {formatRunway(flow.daysOfRunway)}
      {flow.runwayBasis === "outflow" && (
        <span className="ml-1 text-[11px] text-gray-400">est.</span>
      )}
    </span>
  );
}

function AssetChip({
  label,
  chainName,
  balance,
  threshold,
  status,
  runwayDays,
}: {
  label: string;
  chainName: string;
  balance: string;
  threshold: string;
  status: BalanceStatus;
  runwayDays?: number;
}) {
  const tone =
    status === "CRITICAL"
      ? "bg-red-100 text-red-900 border-red-200"
      : status === "LOW"
      ? "bg-yellow-100 text-yellow-900 border-yellow-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[11px] ${tone}`}
      title={`${label} on ${chainName}: ${balance} held against a floor of ${threshold}`}
    >
      {label} {formatAmount(balance)}
      <span className="opacity-60"> / {formatAmount(threshold)}</span>
      {runwayDays != null && runwayDays < 7 && (
        <span className="ml-1 font-medium">· {formatRunway(runwayDays)}</span>
      )}
    </span>
  );
}

function AddressChip({ address }: { address: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5"
      onClick={(event) => event.stopPropagation()}
    >
      <code className="font-mono text-[11px] text-gray-700">
        {truncateAddress(address)}
      </code>
      <button
        onClick={async (event) => {
          event.stopPropagation();
          try {
            await navigator.clipboard.writeText(address);
            toast.success("Address copied");
          } catch {
            toast.error("Could not copy");
          }
        }}
        className="text-gray-400 hover:text-gray-700"
        aria-label="Copy wallet address"
      >
        <Copy className="h-3 w-3" />
      </button>
    </span>
  );
}

function SeverityIcon({ severity }: { severity: 0 | 1 | 2 }) {
  if (severity === 0)
    return <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />;
  if (severity === 1)
    return <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />;
  return <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />;
}

function StatusText({ status }: { status: BalanceStatus }) {
  const tone =
    status === "CRITICAL"
      ? "text-red-700 font-semibold"
      : status === "LOW"
      ? "text-yellow-700 font-medium"
      : "text-green-700";
  return <span className={`text-xs ${tone}`}>{status}</span>;
}

const Notice = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md border border-gray-200 bg-gray-50 p-8 text-center">
    <p className="text-gray-600">{children}</p>
  </div>
);

/** Re-exported so the page header can count without duplicating the logic. */
export { chainStatuses, walletStatuses };
