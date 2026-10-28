"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import { Panel } from "@/components/analytics/panel";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters";
import {
  EmptyPanel,
  RailLabel,
  RankedTable,
  formatCount,
  formatDay,
  formatPercent,
  pivotByRail,
  railsIn,
} from "@/components/analytics/card/card-shared";
import { useCardSpending } from "@/hooks/use-card-analytics";
import { formatUsd } from "@/lib/utils";
import { RAIL_COLORS, RAIL_LABELS } from "@/types/card-analytics";

/**
 * How much is being spent, on which rail, and how much of it converts currency.
 *
 * Foreign-currency spend is broken out everywhere because it is the base of
 * our card revenue now that our own FX fee is off: Rain and Wirex charge their
 * FX fee on it and pay us a share.
 */
export function CardSpendingView() {
  const { queryString, filters } = useAnalyticsFilters();
  const { data, isLoading, error } = useCardSpending(queryString());
  const scope = `${filters.startDate} to ${filters.endDate}${
    filters.rail ? `, ${RAIL_LABELS[filters.rail]} only` : ", every rail"
  }`;

  const daily = useMemo(
    () => (data ? pivotByRail(data.byDay, (row) => row.settledSpendUsd) : []),
    [data]
  );
  const dailyRails = data ? railsIn(data.byDay) : [];
  const totals = data?.totals;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpiCard
          title="Settled spend"
          value={totals ? formatUsd(totals.settledSpendUsd) : undefined}
          scope={`${totals ? formatCount(totals.purchaseCount) : "—"} purchases, ${scope}`}
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Foreign-currency spend"
          value={totals ? formatUsd(totals.foreignSpendUsd) : undefined}
          scope={
            totals
              ? `${formatPercent(
                  totals.settledSpendUsd > 0
                    ? totals.foreignSpendUsd / totals.settledSpendUsd
                    : null
                )} of settled spend — the base issuers pay FX on`
              : "The base issuers pay FX on"
          }
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Active cards"
          value={totals ? formatCount(totals.activeCards) : undefined}
          scope="Cards with at least one settled purchase in the window"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Average ticket"
          value={
            totals?.averageTicketUsd != null ? formatUsd(totals.averageTicketUsd) : totals ? "—" : undefined
          }
          scope={
            totals
              ? `${formatUsd(totals.pendingSpendUsd)} still pending, ${formatUsd(
                  totals.refundUsd
                )} refunded`
              : "Settled purchases only"
          }
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
      </div>

      <Panel
        title="Spend by rail"
        question="How is spend split between Rain and Wirex, and how much converts currency?"
        source={data?.meta.source}
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {data && data.rails.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2 font-medium">Rail</th>
                  <th className="pb-2 text-right font-medium">Settled spend</th>
                  <th className="pb-2 text-right font-medium">Purchases</th>
                  <th className="pb-2 text-right font-medium">Active cards</th>
                  <th className="pb-2 text-right font-medium">Avg ticket</th>
                  <th className="pb-2 text-right font-medium">Foreign spend</th>
                  <th className="pb-2 text-right font-medium">Foreign share</th>
                  <th className="pb-2 text-right font-medium">Refunds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.rails.map((rail) => (
                  <tr key={rail.rail}>
                    <td className="py-2 font-medium text-gray-900">
                      <RailLabel rail={rail.rail} />
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatUsd(rail.settledSpendUsd)}</td>
                    <td className="py-2 text-right tabular-nums">{formatCount(rail.purchaseCount)}</td>
                    <td className="py-2 text-right tabular-nums">{formatCount(rail.activeCards)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {rail.averageTicketUsd != null ? formatUsd(rail.averageTicketUsd) : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatUsd(rail.foreignSpendUsd)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatPercent(
                        rail.settledSpendUsd > 0 ? rail.foreignSpendUsd / rail.settledSpendUsd : null
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-500">
                      {formatUsd(rail.refundUsd)} ({formatCount(rail.refundCount)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel>No card activity in this window.</EmptyPanel>
        )}
      </Panel>

      <Panel
        title="Settled spend per day"
        question="Is spend growing, and on which rail?"
        source={data?.meta.source}
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {daily.length === 0 ? (
          <EmptyPanel>No settled spend in this window.</EmptyPanel>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => formatDay(value)}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <YAxis
                tickFormatter={(value: number) => formatUsd(value, 0)}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                width={80}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                labelFormatter={(value) => formatDay(value as string, true)}
                formatter={(value: number, name) => [formatUsd(value), name]}
              />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              {dailyRails.map((rail, index) => (
                <Bar
                  key={rail}
                  dataKey={rail}
                  name={RAIL_LABELS[rail]}
                  stackId="spend"
                  fill={RAIL_COLORS[rail]}
                  stroke="#ffffff"
                  strokeWidth={1}
                  radius={index === dailyRails.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Top categories"
          question="What are cardholders buying?"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
          isLoading={isLoading}
          error={error}
        >
          <RankedTable
            rows={data?.topCategories ?? []}
            headers={["Category", "Spend", "Purchases"]}
            label={(row) => row.category}
            value={(row) => formatUsd(row.settledSpendUsd)}
            secondary={(row) => formatCount(row.purchaseCount)}
          />
        </Panel>
        <Panel
          title="Top merchant countries"
          question="Where is the card being used?"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
          isLoading={isLoading}
          error={error}
        >
          <RankedTable
            rows={data?.topCountries ?? []}
            headers={["Country", "Spend", "Purchases"]}
            label={(row) => row.country}
            value={(row) => formatUsd(row.settledSpendUsd)}
            secondary={(row) => formatCount(row.purchaseCount)}
          />
        </Panel>
        <Panel
          title="Top foreign currencies"
          question="Which currencies drive the FX revenue base?"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
          isLoading={isLoading}
          error={error}
        >
          <RankedTable
            rows={data?.topCurrencies ?? []}
            headers={["Currency", "Spend", "Purchases"]}
            label={(row) => row.currency}
            value={(row) => formatUsd(row.settledSpendUsd)}
            secondary={(row) => formatCount(row.purchaseCount)}
          />
        </Panel>
      </div>
    </div>
  );
}

export default CardSpendingView;
