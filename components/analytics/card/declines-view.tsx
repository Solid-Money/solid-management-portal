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
  formatCount,
  formatDay,
  formatPercent,
  pivotByRail,
  railsIn,
} from "@/components/analytics/card/card-shared";
import { useCardSpending } from "@/hooks/use-card-analytics";
import { formatDateTime, formatUsd } from "@/lib/utils";
import { RAIL_COLORS, RAIL_LABELS } from "@/types/card-analytics";

/**
 * What is being declined, and is any of it abuse?
 *
 * Reads the same window as Spending — one request serves both — so the decline
 * rate here is always a rate of the attempts counted there.
 */
export function CardDeclinesView() {
  const { queryString, filters } = useAnalyticsFilters();
  const { data, isLoading, error } = useCardSpending(queryString());
  const scope = `${filters.startDate} to ${filters.endDate}`;

  // byDay has a row for every day with any activity; only days with a decline
  // belong on this chart, or a window with spend but no declines draws empty bars.
  const declineDays = useMemo(
    () => (data ? data.byDay.filter((row) => row.declineCount > 0) : []),
    [data]
  );
  const daily = useMemo(
    () => pivotByRail(declineDays, (row) => row.declineCount),
    [declineDays]
  );
  const dailyRails = railsIn(declineDays);
  const totals = data?.totals;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <AnalyticsKpiCard
          title="Decline rate"
          value={totals ? formatPercent(totals.declineRate) : undefined}
          scope={`Declines over all purchase attempts, ${scope}`}
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Declines"
          value={totals ? formatCount(totals.declineCount) : undefined}
          scope={`Of ${totals ? formatCount(totals.attemptCount) : "—"} attempts`}
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Pending authorisations"
          value={totals ? formatUsd(totals.pendingSpendUsd) : undefined}
          scope={`${totals ? formatCount(totals.pendingCount) : "—"} approved, not yet settled`}
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
      </div>

      <Panel
        title="Decline rate by rail"
        question="Is one rail declining far more than the other?"
        source={data?.meta.source}
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {data && data.rails.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="pb-2 font-medium">Rail</th>
                <th className="pb-2 text-right font-medium">Attempts</th>
                <th className="pb-2 text-right font-medium">Declined</th>
                <th className="pb-2 text-right font-medium">Decline rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.rails.map((rail) => (
                <tr key={rail.rail}>
                  <td className="py-2 font-medium text-gray-900">
                    <RailLabel rail={rail.rail} />
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCount(rail.attemptCount)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCount(rail.declineCount)}</td>
                  <td className="py-2 text-right tabular-nums">{formatPercent(rail.declineRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyPanel>No purchase attempts in this window.</EmptyPanel>
        )}
      </Panel>

      <Panel
        title="Declines per day"
        question="Did something start failing on a particular day?"
        source={data?.meta.source}
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {daily.length === 0 ? (
          <EmptyPanel>No declines in this window.</EmptyPanel>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
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
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                width={50}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                labelFormatter={(value) => formatDay(value as string, true)}
                formatter={(value: number, name) => [formatCount(value), name]}
              />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              {dailyRails.map((rail, index) => (
                <Bar
                  key={rail}
                  dataKey={rail}
                  name={RAIL_LABELS[rail]}
                  stackId="declines"
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Decline reasons"
          question="Why are purchases being declined?"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
          isLoading={isLoading}
          error={error}
        >
          {data && data.declineReasons.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2 font-medium">Reason</th>
                  <th className="pb-2 font-medium">Rail</th>
                  <th className="pb-2 text-right font-medium">Count</th>
                  <th className="pb-2 text-right font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.declineReasons.map((row) => (
                  <tr key={`${row.rail}:${row.reason}`}>
                    <td className="max-w-[260px] truncate py-1.5 pr-2 text-gray-900" title={row.reason}>
                      {row.reason}
                    </td>
                    <td className="py-1.5 text-gray-600">
                      <RailLabel rail={row.rail} />
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{formatCount(row.count)}</td>
                    <td className="py-1.5 text-right text-xs text-gray-500">
                      {formatDateTime(row.lastSeen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyPanel>No declines in this window.</EmptyPanel>
          )}
        </Panel>

        <Panel
          title="Most-declined merchants"
          question="Where do declines cluster — a merchant category we block, or probing?"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
          isLoading={isLoading}
          error={error}
        >
          {data && data.topDeclinedMerchants.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2 font-medium">Merchant</th>
                  <th className="pb-2 font-medium">Rail</th>
                  <th className="pb-2 text-right font-medium">Declines</th>
                  <th className="pb-2 text-right font-medium">Attempted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.topDeclinedMerchants.map((row) => (
                  <tr key={`${row.rail}:${row.merchant}`}>
                    <td className="max-w-[220px] truncate py-1.5 pr-2 text-gray-900" title={row.merchant}>
                      {row.merchant}
                    </td>
                    <td className="py-1.5 text-gray-600">
                      <RailLabel rail={row.rail} />
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{formatCount(row.count)}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-500">
                      {formatUsd(row.declinedUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyPanel>No declines in this window.</EmptyPanel>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default CardDeclinesView;
