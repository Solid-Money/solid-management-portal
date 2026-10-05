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
  WalletAssetPlan,
  WalletFilter,
  WalletInfo,
  WalletPlansResponse,
  WalletRefillPlan,
  WalletStatusResponse,
  WALLET_ROLE_ORDER,
} from "@/types";
import {
  BalanceStatus,
  chainStatuses,
  formatAmount,
  formatRunway,
  getWalletFlow,
  getWalletPlans,
  groupByRole,
  indexPlans,
  monitoredAssets,
  planKey,
  severityOf,
  truncateAddress,
  assetVerdict,
  assetRefillPlan,
  assetRunwayDays,
  walletSeverity,
  walletStatuses,
  walletVerdictSeverity,
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

  /**
   * The verdicts, for every wallet, fetched once rather than per opened card.
   *
   * Separate from the status call so the board paints as soon as balances
   * land: this one fans out over the whole registry behind a five-minute
   * cache and can take a moment on a cold one. Until it arrives no card
   * claims a verdict — see `WalletCard`.
   *
   * A failure here is not fatal. `plans` stays undefined, every card falls
   * back to its configured threshold, and the banner below says the page is
   * reading fixed numbers.
   */
  const {
    data: plans,
    isLoading: plansLoading,
    isError: plansFailed,
  } = useQuery<WalletPlansResponse>({
    queryKey: ["wallet-plans"],
    queryFn: () => getWalletPlans(7),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const planIndex = useMemo(() => indexPlans(plans), [plans]);
  const plansReady = !plansLoading;

  const groups = useMemo(() => {
    if (!data) return [];
    const visible = data.wallets.filter((wallet) => {
      if (filter === "all") return true;
      const active = wallet.active !== false;
      return filter === "active" ? active : !active;
    });
    return groupByRole(
      visible,
      WALLET_ROLE_ORDER,
      // Ordered on the verdict the cards are coloured by, so the worst wallet
      // is at the top of its group rather than the one with the lowest ratio
      // to a number somebody fixed two years ago.
      (wallet) =>
        walletVerdictSeverity(wallet, planIndex, plansReady) ??
        walletSeverity(wallet)
    );
  }, [data, filter, planIndex, plansReady]);

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
  const severities = shown.map(
    (wallet) =>
      walletVerdictSeverity(wallet, planIndex, plansReady) ??
      walletSeverity(wallet)
  );
  const criticalCount = severities.filter((s) => s === 0).length;
  const lowCount = severities.filter((s) => s === 1).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-gray-500">
          Balances as of {new Date(data.lastUpdated).toLocaleString()}
        </p>
        {/* Counted from the same verdicts the cards are coloured by. They used
            to be counted from the configured thresholds alone, so the header
            could read "3 below configured floor" over three cards that had
            each turned green when somebody opened them. */}
        {!plansReady && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Working out how long each wallet has left
          </span>
        )}
        {plansReady && criticalCount > 0 && (
          <span
            className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white"
            title="Inside a day of running out, or holding funds that should have moved on."
          >
            {criticalCount} need funding today
          </span>
        )}
        {plansReady && lowCount > 0 && (
          <span
            className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
            title="Inside its floor — worth funding this week."
          >
            {lowCount} need funding this week
          </span>
        )}
        <span className="ml-auto text-xs text-gray-500">
          Click any token row to see who funded it, who it has blocked, and
          what it still owes.
        </span>
      </div>

      {plansFailed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Days of cover could not be read, so every wallet below is judged
          against its fixed configured threshold. Those drift as usage changes:
          a wallet can read healthy with a day left, or critical with a
          fortnight.
        </div>
      )}

      {plans && plans.gaps.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          No transfer history for{" "}
          {plans.gaps.map((gap) => gap.walletName).join(", ")}, so{" "}
          {plans.gaps.length === 1 ? "it is" : "they are"} judged against
          configured thresholds rather than days of cover.
        </div>
      )}

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
                plans={planIndex}
                plansReady={plansReady}
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
  plans,
  plansReady,
  onOpenAsset,
}: {
  wallet: WalletInfo;
  plans: Map<string, WalletAssetPlan>;
  plansReady: boolean;
  onOpenAsset: (
    chain: ChainBalance,
    asset: WalletAsset,
    flow?: WalletAssetFlow
  ) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Fetched only once the card is opened. The flow call reads a wallet's
  // transfer history across every chain it runs on; doing that eagerly for
  // fourteen wallets on every page load would cost far more than it tells
  // anyone whose wallets are all healthy. The verdicts do not wait on it —
  // they come from the board-wide `plans` call — so opening a card adds the
  // cost, the activity and the transfers, and never changes a colour.
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

  /** This wallet's plan rows, by chain and asset. */
  const planFor = useMemo(
    () => (chainId: number, asset: WalletAsset) =>
      plans.get(planKey(wallet.name, chainId, asset)),
    [plans, wallet.name]
  );

  /**
   * Whether any asset is inside its measured floor.
   *
   * Separate from the configured statuses, which are fixed amounts that drift
   * out of meaning as usage grows: a wallet can be "OK" against one and still
   * be a few hours from empty.
   */
  const belowFloor = useMemo(
    () =>
      wallet.chains.some((chain) =>
        monitoredAssets(chain).some(
          (reading) =>
            assetRefillPlan(planFor(chain.chainId, reading.asset))?.belowFloor
        )
      ),
    [wallet.chains, planFor]
  );

  /**
   * Every monitored asset across every chain, worst first then hottest.
   *
   * The verdict it sorts on arrives with the board, so the order is already
   * right when a card opens; the flow call only breaks ties between equally
   * healthy assets. That is what stops the list reflowing from "correct" to
   * "differently correct" under the reader's cursor.
   */
  const rows = useMemo(() => {
    const all = wallet.chains.flatMap((chain) =>
      monitoredAssets(chain).map((reading) => {
        const assetFlow = flowByKey.get(`${chain.chainId}:${reading.asset}`);
        const assetPlan = planFor(chain.chainId, reading.asset);
        return {
          chain,
          reading,
          flow: assetFlow,
          plan: assetPlan,
          verdict: assetVerdict(reading.status, assetPlan, assetFlow),
          refill: assetRefillPlan(assetPlan, assetFlow),
          runwayDays: assetRunwayDays(assetPlan, assetFlow),
        };
      })
    );

    return all
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const severityDiff =
          severityOf([a.row.verdict]) - severityOf([b.row.verdict]);
        if (severityDiff !== 0) return severityDiff;
        // From the plan, not the flow: the chips on a collapsed card are the
        // first four of these, so a tiebreak that only exists once a card is
        // open would rearrange them the moment somebody clicked.
        const scoreDiff =
          (b.row.plan?.activityScore ?? b.row.flow?.activityScore ?? 0) -
          (a.row.plan?.activityScore ?? a.row.flow?.activityScore ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return a.index - b.index;
      })
      .map(({ row }) => row);
  }, [wallet.chains, flowByKey, planFor]);

  /**
   * The card's verdict, or `undefined` while the verdicts are still loading.
   *
   * It used to start from the configured threshold and be restated once a
   * flow call landed, which is why a card could read CRITICAL, then LOW, then
   * OK without anything on chain having moved — the balance stayed put and
   * the floor underneath it changed. Rendering "assessing" until there is an
   * answer is one transition from unknown to known, rather than two from
   * confidently wrong to confidently different.
   *
   * Taken from the rows rather than recomputed, so the badge cannot disagree
   * with the table under it. The two would only diverge where there is no
   * plan for this wallet and an opened card has a flow row instead — rare,
   * but a card headed CRITICAL over rows all reading OK is worse than either
   * alone, which is the shape of the bug this whole change is about.
   */
  const severity = useMemo(
    () => (plansReady ? severityOf(rows.map((row) => row.verdict)) : undefined),
    [rows, plansReady]
  );

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
            {severity === undefined && (
              <span
                className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500"
                title="Working out what this wallet costs per day, which is what its floor is set from."
              >
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                assessing cover
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
              an empty one it is the line that decides whether to act now, so
              it waits for a verdict rather than guessing from a threshold. */}
          {severity != null && severity < 2 && wallet.impactWhenEmpty && (
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
            {rows
              .slice(0, 4)
              .map(({ chain, reading, verdict, refill, runwayDays }) => (
                <AssetChip
                  key={`${chain.chainId}:${reading.asset}`}
                  label={reading.label}
                  chainName={chain.chainName}
                  balance={reading.balance}
                  threshold={reading.threshold}
                  plan={refill}
                  verdict={verdict}
                  runwayDays={runwayDays}
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
                {/* "Cost", not "burn": what leaves and does not come back.
                    Money passing through to users is reported separately. */}
                <th className="px-4 py-2">Cost / day</th>
                <th className="px-4 py-2">Runway</th>
                <th className="px-4 py-2">Activity</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(
                (
                  {
                    chain,
                    reading,
                    flow: assetFlow,
                    plan,
                    verdict,
                    refill,
                    runwayDays,
                  },
                  index
                ) => (
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
                    <StatusText status={verdict} reason={plan?.verdictReason} />
                    <div className="text-xs text-gray-500">
                      {formatAmount(reading.balance)} /{" "}
                      {formatAmount(refill?.floorAmount ?? reading.threshold)}
                      {refill && (
                        <span
                          className="ml-1 text-gray-400"
                          title={`A floor of ${refill.floorDays} days at the measured cost, rather than the fixed ${formatAmount(reading.threshold)} configured.`}
                        >
                          ({refill.floorDays}d)
                        </span>
                      )}
                      {plan?.isResidue && (
                        <span
                          className="ml-1 text-gray-400"
                          title="A router that should settle empty. The figure on the right is the remainder we tolerate, not a floor to stay above."
                        >
                          (ceiling)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <CostCell plan={plan} flow={assetFlow} />
                  </td>
                  <td className="px-4 py-2">
                    <RunwayCell
                      plan={plan}
                      flow={assetFlow}
                      runwayDays={runwayDays}
                    />
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
                )
              )}
            </tbody>
          </table>

          {/* Also shown when nothing has tripped its configured threshold but
              an asset is inside its measured floor — the Connect Wallet FUSE
              case, comfortably above a stale 1,000 and under a day of cover. */}
          {((severity != null && severity < 2) || belowFloor) && (
            <TopUpInstruction
              wallet={wallet}
              flowByAsset={flowByKey}
              planFor={planFor}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * What to do about it, and where — a top-up for most wallets, and the opposite
 * for a router.
 *
 * The amount is what brings the wallet back to its target cover rather than
 * what clears its floor. Sending the floor is what produced the daily refill
 * treadmill: Connect Wallet's FUSE floor was 1,000 against a cost of ~990 a
 * day, so every top-up bought a single day and someone had to come back the
 * next morning. Where no cost has been measured yet, it falls back to the
 * configured threshold and says so.
 *
 * A residue wallet is excluded from all of that and told apart explicitly. It
 * is a router that should settle empty, so its threshold is a ceiling on
 * tolerated dust — and reading it as a floor had this panel instructing an
 * operator to send 200 USDC to the Card Deposit Manager, which is the one
 * action its own config says must never be taken. A balance there is a user's
 * card deposit that never reached their card.
 */
function TopUpInstruction({
  wallet,
  flowByAsset,
  planFor,
}: {
  wallet: WalletInfo;
  flowByAsset: Map<string, WalletAssetFlow>;
  planFor: (chainId: number, asset: WalletAsset) => WalletAssetPlan | undefined;
}) {
  const stuck: Array<{ chainName: string; text: string }> = [];

  const shortfalls = wallet.chains
    .map((chain) => ({
      chain,
      needs: monitoredAssets(chain)
        .map((reading) => {
          const assetPlan = planFor(chain.chainId, reading.asset);
          const flow = flowByAsset.get(`${chain.chainId}:${reading.asset}`);
          const refill = assetRefillPlan(assetPlan, flow);

          if (assetPlan?.isResidue) {
            if (assetPlan.verdict === "CRITICAL") {
              stuck.push({
                chainName: chain.chainName,
                text: `${formatAmount(reading.balance)} ${reading.label}`,
              });
            }
            return null;
          }

          if (refill?.refillAmount && refill.refillAmount > 0) {
            return {
              text: `${formatAmount(refill.refillAmount)} ${reading.label}`,
              detail: `brings it to ${refill.targetDays} days of cover`,
            };
          }
          // No measured cost to plan from, so fall back to the fixed floor.
          const verdict = assetVerdict(reading.status, assetPlan, flow);
          if (verdict === "LOW" || verdict === "CRITICAL") {
            return {
              text: `${formatAmount(reading.threshold)} ${reading.label}`,
              detail: "its configured floor — no cost measured yet",
            };
          }
          return null;
        })
        .filter((need): need is NonNullable<typeof need> => need !== null),
    }))
    .filter((row) => row.needs.length > 0);

  if (shortfalls.length === 0 && stuck.length === 0) return null;

  return (
    <div className="border-t border-gray-200 px-4 py-3">
      {stuck.map(({ chainName, text }) => (
        <p key={chainName} className="text-sm text-red-900">
          <strong>Do not top this up.</strong> It is holding {text} on{" "}
          {chainName} — a deposit that was swept in and never routed on.
          Investigate where it stopped.
        </p>
      ))}
      {shortfalls.map(({ chain, needs }) => (
        <p key={chain.chainId} className="text-sm text-gray-800">
          Send at least{" "}
          <strong>{needs.map((need) => need.text).join(" and ")}</strong> on{" "}
          {chain.chainName} to{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
            {wallet.address}
          </code>
          <span className="ml-1 text-xs text-gray-500">
            ({needs[0].detail})
          </span>
        </p>
      ))}
      {shortfalls.length > 0 && wallet.topUpHint && (
        <p className="mt-2 text-xs text-indigo-900">{wallet.topUpHint}</p>
      )}
    </div>
  );
}

/**
 * What this asset costs us per day, with turnover kept out of it.
 *
 * The distinction is the point: a bridging wallet can move 16,000 USDC through
 * itself in a week and cost us 27 of it. Showing the 16,000 as burn is what
 * made every float wallet on this page look like it was on fire.
 */
function CostCell({
  plan,
  flow,
}: {
  plan?: WalletAssetPlan;
  flow?: WalletAssetFlow;
}) {
  // The cost comes from the plan, because the floor shown one column to the
  // left is that cost times the floor days — quoting a flow-measured cost
  // beside a plan-derived floor makes the arithmetic on screen not add up.
  const measured = plan?.realCostPerDay ?? flow?.realCostPerDay;
  const isFloat = plan?.isFloat ?? flow?.isFloat ?? false;

  if (measured == null && !flow) {
    return <span className="text-gray-400">—</span>;
  }

  const cost =
    measured != null
      ? formatAmount(measured)
      : flow && !isFloat && flow.outflowPerDay > 0
      ? `~${formatAmount(flow.outflowPerDay)}`
      : "—";

  return (
    <div>
      <div
        className="text-gray-700"
        title={
          measured != null
            ? "Measured from balance history net of top-ups, so gas burned as fees is included and money passing through to users is not."
            : isFloat
            ? "No cost measured yet. Gross outflow is not shown here because on this asset it is a user's money leaving, not ours."
            : "Estimated from transfers out only — gas spent as fees is not counted, so this is optimistic."
        }
      >
        {cost}
      </div>
      {/* Turnover is the one figure only the transfer history can give, so it
          appears when a card is opened and is additive — it never restates
          anything already on screen. */}
      {flow && flow.turnoverPerDay > 0 && (
        <div
          className="text-[11px] text-gray-400"
          title={`${flow.turnoverCount} transfers of users' money passing through in the window. Not a cost to us.`}
        >
          +{formatAmount(flow.turnoverPerDay)}/d through
        </div>
      )}
    </div>
  );
}

function RunwayCell({
  plan,
  flow,
  runwayDays,
}: {
  plan?: WalletAssetPlan;
  flow?: WalletAssetFlow;
  runwayDays?: number;
}) {
  // Same read as the chip above it, which already quotes days of cover on
  // anything inside a week. Two different runways for one asset on one screen
  // is the contradiction this page exists to remove.
  const snapshotCount = plan?.snapshotCount ?? flow?.snapshotCount;
  const basis = plan?.runwayBasis ?? flow?.runwayBasis;

  if (runwayDays == null) {
    if (snapshotCount == null) return <span className="text-gray-400">—</span>;
    return (
      <span
        className="text-xs text-gray-400"
        title={
          snapshotCount < 2
            ? "Balance history is still building. Until it spans a few hours, a burn rate would be noise."
            : "Nothing observed leaving this balance in the window."
        }
      >
        {snapshotCount < 2 ? "warming up" : "not draining"}
      </span>
    );
  }

  // Under a week of cover is worth funding this week whatever the threshold
  // says — a wallet at 3x its floor with two days left needs money today.
  const urgent = runwayDays < 7;
  return (
    <span
      className={urgent ? "font-medium text-red-700" : "text-gray-700"}
      title={
        basis === "measured"
          ? "Measured from balance history, gas fees included."
          : "Estimated from transfers out only — gas spent as fees is not counted, so this is optimistic."
      }
    >
      {formatRunway(runwayDays)}
      {basis === "outflow" && (
        <span className="ml-1 text-[11px] text-gray-400">est.</span>
      )}
    </span>
  );
}

/**
 * One asset's balance against its floor, at a glance.
 *
 * Shows the measured floor once there is one, so the chip and the table below
 * it cannot quote two different floors for the same asset — and so a chip does
 * not read as healthy against a fixed threshold the asset has outgrown.
 */
function AssetChip({
  label,
  chainName,
  balance,
  threshold,
  plan,
  verdict,
  runwayDays,
}: {
  label: string;
  chainName: string;
  balance: string;
  threshold: string;
  plan?: WalletRefillPlan;
  verdict: BalanceStatus;
  runwayDays?: number;
}) {
  const tone =
    verdict === "CRITICAL"
      ? "bg-red-100 text-red-900 border-red-200"
      : verdict === "LOW"
      ? "bg-yellow-100 text-yellow-900 border-yellow-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  const floor = plan ? plan.floorAmount : threshold;

  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[11px] ${tone}`}
      title={
        plan
          ? `${label} on ${chainName}: ${balance} held against a floor of ${formatAmount(floor)}, which is ${plan.floorDays} days at the measured cost. Configured threshold is ${formatAmount(threshold)}.`
          : `${label} on ${chainName}: ${balance} held against a floor of ${threshold}`
      }
    >
      {label} {formatAmount(balance)}
      <span className="opacity-60"> / {formatAmount(floor)}</span>
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

/** Undefined severity is the honest state while the verdicts are loading. */
function SeverityIcon({ severity }: { severity?: 0 | 1 | 2 }) {
  if (severity === undefined)
    return <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-gray-300" />;
  if (severity === 0)
    return <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />;
  if (severity === 1)
    return <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />;
  return <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />;
}

function StatusText({
  status,
  reason,
}: {
  status: BalanceStatus;
  reason?: string;
}) {
  const tone =
    status === "CRITICAL"
      ? "text-red-700 font-semibold"
      : status === "LOW"
      ? "text-yellow-700 font-medium"
      : "text-green-700";
  return (
    <span className={`text-xs ${tone}`} title={reason}>
      {status}
    </span>
  );
}

const Notice = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md border border-gray-200 bg-gray-50 p-8 text-center">
    <p className="text-gray-600">{children}</p>
  </div>
);

/** Re-exported so the page header can count without duplicating the logic. */
export { chainStatuses, walletStatuses };
