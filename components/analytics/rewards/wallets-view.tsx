"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import { MetricLabel } from "@/components/analytics/metric-label";
import { Panel } from "@/components/analytics/panel";
import { useRewardsPaid } from "@/hooks/use-analytics";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters";
import { formatNumber, formatUsd } from "@/lib/utils";
import type { WalletInfo, WalletStatusResponse } from "@/types";

/**
 * The two wallets that pay users, matched by name.
 *
 * Matched on a substring rather than an address so a wallet rotation does not
 * silently empty this panel — a renamed wallet is a visible mismatch, a
 * rotated address would just disappear.
 */
const PAYOUT_WALLET_MATCHERS = [
  { id: "cashback", label: "Cashback payout", match: /cashback/i },
  { id: "referral", label: "Referral payout", match: /referral/i },
] as const;

/** Below this many days of runway, the wallet needs topping up now. */
const RUNWAY_ALERT_DAYS = 14;

export function RewardsWalletsView() {
  const { queryString } = useAnalyticsFilters();

  const wallets = useQuery<WalletStatusResponse>({
    queryKey: ["wallets"],
    queryFn: async () => {
      const response = await api.get("/admin/v1/wallets/status");
      return response.data;
    },
    refetchInterval: 60_000,
  });

  const paid = useRewardsPaid(queryString());

  /**
   * Runway in days = balance ÷ average daily outflow over the selected window.
   *
   * Outflow is averaged over the window rather than the trailing 7 days alone,
   * so the number responds to the range in the header; a payout programme that
   * only sweeps some days would otherwise read as infinite runway on a quiet
   * week.
   */
  const outflow = useMemo(() => {
    if (!paid.data) return null;

    const days = Math.max(
      1,
      new Set([
        ...paid.data.cashback.byDay.map((row) => row.date),
        ...paid.data.referrals.byDay.map((row) => row.date),
      ]).size
    );

    return {
      cashback: paid.data.cashback.totalUsd / days,
      referral: paid.data.referrals.totalUsd / days,
      days,
    };
  }, [paid.data]);

  const payoutWallets = useMemo(() => {
    const all = wallets.data?.wallets ?? [];
    return PAYOUT_WALLET_MATCHERS.map((matcher) => ({
      ...matcher,
      wallet: all.find((wallet) => matcher.match.test(wallet.name)),
      dailyOutflow:
        matcher.id === "cashback" ? outflow?.cashback : outflow?.referral,
    }));
  }, [wallets.data, outflow]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {payoutWallets.map((entry) => {
          const balance = entry.wallet ? payoutBalanceUsd(entry.wallet) : null;
          const runway =
            balance !== null && entry.dailyOutflow && entry.dailyOutflow > 0
              ? balance / entry.dailyOutflow
              : null;

          return (
            <AnalyticsKpiCard
              key={entry.id}
              title={`${entry.label} runway`}
              metric="payoutRunway"
              value={
                wallets.isLoading || paid.isLoading
                  ? undefined
                  : entry.wallet === undefined
                    ? null
                    : runway === null
                      ? "No outflow in period"
                      : `${formatNumber(runway, 0, 0)} days`
              }
              scope={
                balance === null
                  ? "Wallet not found in /wallets/status"
                  : `${formatUsd(balance)} held · ${formatUsd(
                      entry.dailyOutflow ?? 0
                    )}/day average outflow`
              }
              source="on-chain"
              updatedAt={wallets.data?.lastUpdated}
              invertTrendColor
            />
          );
        })}
      </div>

      {payoutWallets.some(
        (entry) => entry.wallet === undefined && !wallets.isLoading
      ) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
              aria-hidden
            />
            <p>
              A payout wallet could not be matched by name in{" "}
              <code className="rounded bg-amber-100 px-1">
                /admin/v1/wallets/status
              </code>
              . Runway cannot be computed for it — check whether the wallet was
              renamed.
            </p>
          </div>
        </div>
      ) : null}

      <Panel
        title="Payout wallet balances"
        question="Can the payout wallets cover what we owe?"
        source="on-chain"
        updatedAt={wallets.data?.lastUpdated}
        isLoading={wallets.isLoading}
        error={wallets.error}
        actions={
          <Link
            href="/wallets"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            All wallets
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      >
        <div className="space-y-6">
          {payoutWallets.map((entry) => (
            <div key={entry.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900">
                  {entry.wallet?.name ?? entry.label}
                </h4>
                {entry.wallet ? (
                  <code className="text-xs text-gray-500">
                    {entry.wallet.address}
                  </code>
                ) : null}
              </div>

              {entry.wallet ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        <th className="py-2 pr-4">Chain</th>
                        <th className="py-2 pr-4 text-right">soUSD</th>
                        <th className="py-2 pr-4 text-right">soFUSE</th>
                        <th className="py-2 pr-4 text-right">Gas</th>
                        <th className="py-2 text-right">Needs top-up</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {entry.wallet.chains.map((chain) => (
                        <tr key={chain.chainId}>
                          <td className="py-2 pr-4 text-gray-900">
                            {chain.chainName}
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-700">
                            {balanceCell(chain.soUsdBalance)}
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-700">
                            {balanceCell(chain.soFuseBalance)}
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-700">
                            {balanceCell(chain.gasBalance)}{" "}
                            <span className="text-xs text-gray-400">
                              {chain.gasTokenSymbol}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            {chain.needsTopUp ? (
                              <span className="font-medium text-red-600">
                                Yes
                              </span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Not found in the wallet status response.
                </p>
              )}
            </div>
          ))}

          <p className="border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-500">
            The cashback wallet also receives Wirex card spend, so its balance
            moves on inflows as well as payouts — a rising balance there is not
            evidence that payouts have stopped. Runway assumes the average daily
            outflow over the selected window holds; the alert threshold is{" "}
            {RUNWAY_ALERT_DAYS} days.
          </p>
        </div>
      </Panel>

      <Panel
        title="What the runway is computed from"
        question="Which payouts are included in the outflow figure?"
        source="derived"
        updatedAt={paid.data?.generatedAt}
        isLoading={paid.isLoading}
        error={paid.error}
      >
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-gray-500">Cashback paid</dt>
            <dd className="font-medium text-gray-900">
              {paid.data ? formatUsd(paid.data.cashback.totalUsd) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Referral payouts</dt>
            <dd className="font-medium text-gray-900">
              {paid.data ? formatUsd(paid.data.referrals.totalUsd) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Days with a payout</dt>
            <dd className="font-medium text-gray-900">
              {outflow ? formatNumber(outflow.days, 0, 0) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">
              <MetricLabel metric="incentiveCost" label="Excluded" />
            </dt>
            <dd className="text-xs leading-relaxed text-gray-500">
              Points — a liability, not an outflow, until they are redeemed.
            </dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

/**
 * The payout float in USD.
 *
 * soUSD and soFUSE are both counted at face value: a precise figure needs the
 * soUSD rate and the FUSE price, which this endpoint does not carry, so the
 * number is treated as a float size rather than a valuation — enough to answer
 * "how many more payouts fit in here".
 */
function payoutBalanceUsd(wallet: WalletInfo): number {
  return wallet.chains.reduce((sum, chain) => {
    const soUsd = Number(chain.soUsdBalance ?? 0);
    const soFuse = Number(chain.soFuseBalance ?? 0);
    return (
      sum +
      (Number.isFinite(soUsd) ? soUsd : 0) +
      (Number.isFinite(soFuse) ? soFuse : 0)
    );
  }, 0);
}

function balanceCell(value: string | undefined): string {
  if (value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatNumber(parsed, 4, 2) : "—";
}

export default RewardsWalletsView;
