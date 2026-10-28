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
import { useCardIssuance } from "@/hooks/use-card-analytics";
import { RAIL_COLORS, RAIL_LABELS } from "@/types/card-analytics";

/**
 * Do the cards we issue get used?
 *
 * Activation is measured as a first settled purchase, not as the issuer's
 * "active" status: a card can be active and never swiped, and an unused Wirex
 * card costs us a monthly inactive-card fee.
 */
export function CardIssuanceView() {
  const { queryString, filters } = useAnalyticsFilters();
  const { data, isLoading, error } = useCardIssuance(queryString());
  const scope = `${filters.startDate} to ${filters.endDate}`;

  const daily = useMemo(
    () => (data ? pivotByRail(data.byDay, (row) => row.issued) : []),
    [data]
  );
  const dailyRails = data ? railsIn(data.byDay) : [];

  const issued = data?.rails.reduce((sum, rail) => sum + rail.issued, 0);
  const used = data?.rails.reduce((sum, rail) => sum + rail.issuedAndUsed, 0);
  const book = data?.rails.reduce((sum, rail) => sum + rail.book.total, 0);
  const inactive = data?.rails.reduce((sum, rail) => sum + rail.book.inactive, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpiCard
          title="Cards issued"
          value={issued === undefined ? undefined : formatCount(issued)}
          scope={scope}
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Used since issuance"
          value={
            issued === undefined || used === undefined
              ? undefined
              : formatPercent(issued > 0 ? used / issued : null)
          }
          scope={`${used === undefined ? "—" : formatCount(used)} of the cards issued in the window have a settled purchase`}
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Card book"
          value={book === undefined ? undefined : formatCount(book)}
          scope="Every card on file today, all statuses"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Inactive cards"
          value={inactive === undefined ? undefined : formatCount(inactive)}
          scope="On file today. Wirex bills a monthly fee per inactive card"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
          invertTrendColor
        />
      </div>

      <Panel
        title="Issuance and activation by rail"
        question="Which rail turns an issued card into a used one, and how fast?"
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
                  <th className="pb-2 text-right font-medium">Issued</th>
                  <th className="pb-2 text-right font-medium">Used</th>
                  <th className="pb-2 text-right font-medium">Activation</th>
                  <th className="pb-2 text-right font-medium">Median days to first spend</th>
                  <th className="pb-2 text-right font-medium">Active</th>
                  <th className="pb-2 text-right font-medium">Frozen</th>
                  <th className="pb-2 text-right font-medium">Inactive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.rails.map((rail) => (
                  <tr key={rail.rail}>
                    <td className="py-2 font-medium text-gray-900">
                      <RailLabel rail={rail.rail} />
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatCount(rail.issued)}</td>
                    <td className="py-2 text-right tabular-nums">{formatCount(rail.issuedAndUsed)}</td>
                    <td className="py-2 text-right tabular-nums">{formatPercent(rail.activationRate)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {rail.medianDaysToFirstSpend === null
                        ? "—"
                        : rail.medianDaysToFirstSpend.toFixed(1)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatCount(rail.book.active)}</td>
                    <td className="py-2 text-right tabular-nums">{formatCount(rail.book.frozen)}</td>
                    <td className="py-2 text-right tabular-nums">{formatCount(rail.book.inactive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-400">
              Issued and used are scoped to the window; active, frozen and
              inactive describe the whole book today.
            </p>
          </div>
        ) : (
          <EmptyPanel>No cards on file.</EmptyPanel>
        )}
      </Panel>

      <Panel
        title="Cards issued per day"
        question="Is issuance keeping pace, and on which rail?"
        source={data?.meta.source}
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {daily.length === 0 ? (
          <EmptyPanel>No cards were issued in this window.</EmptyPanel>
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
                  stackId="issued"
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
    </div>
  );
}

export default CardIssuanceView;
