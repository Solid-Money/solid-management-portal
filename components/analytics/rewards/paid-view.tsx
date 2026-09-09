"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import { Panel } from "@/components/analytics/panel";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters";
import { useRewardsPaid } from "@/hooks/use-analytics";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/utils";

export function RewardsPaidView() {
  const { queryString, filters } = useAnalyticsFilters();
  const { data, isLoading, error } = useRewardsPaid(queryString());

  const scope = `${filters.startDate} to ${filters.endDate}`;

  /**
   * Cashback and referral payouts on one daily axis.
   *
   * Merged into a single series rather than shown as two charts because the
   * question is what the incentive programme costs per day in total — two
   * charts side by side make the reader add them up by eye.
   */
  const byDay = useMemo(() => {
    if (!data) return [];

    const days = new Map<
      string,
      { date: string; cashbackUsd: number; referralUsd: number; totalUsd: number }
    >();

    const upsert = (date: string) =>
      days.get(date) ??
      days
        .set(date, { date, cashbackUsd: 0, referralUsd: 0, totalUsd: 0 })
        .get(date)!;

    for (const row of data.cashback.byDay) {
      const day = upsert(row.date);
      day.cashbackUsd += row.usd;
      day.totalUsd += row.usd;
    }
    for (const row of data.referrals.byDay) {
      const day = upsert(row.date);
      const usd = row.referrerUsd + row.newUserUsd;
      day.referralUsd += usd;
      day.totalUsd += usd;
    }

    return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const totalPaid = data
    ? data.cashback.totalUsd + data.referrals.totalUsd
    : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpiCard
          title="Total incentive paid"
          metric="incentiveCost"
          value={totalPaid === undefined ? undefined : formatUsd(totalPaid)}
          scope={`Cashback + referral payouts, ${scope}`}
          source="derived"
          updatedAt={data?.generatedAt}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Cashback paid"
          value={data ? formatUsd(data.cashback.totalUsd) : undefined}
          scope={
            data
              ? `${formatNumber(data.cashback.count, 0, 0)} credits in period`
              : "Credits in period"
          }
          source={data?.cashback.meta.source}
          updatedAt={data?.cashback.meta.updatedAt}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Referral payouts"
          value={data ? formatUsd(data.referrals.totalUsd) : undefined}
          scope={
            data
              ? `${formatNumber(data.referrals.count, 0, 0)} referrals paid, both legs`
              : "Referrals paid, both legs"
          }
          source={data?.referrals.meta.source}
          updatedAt={data?.referrals.meta.updatedAt}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Points issued"
          value={
            data ? formatNumber(data.points.totalPoints, 0, 0) : undefined
          }
          scope="A liability accruing, not cash leaving"
          source={data?.points.meta.source}
          updatedAt={data?.points.meta.updatedAt}
          invertTrendColor
        />
      </div>

      <Panel
        title="Incentive spend per day"
        question="What are we paying out, and is it trending up?"
        source="derived"
        updatedAt={data?.generatedAt}
        isLoading={isLoading}
        error={error}
      >
        {byDay.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-gray-400">
            Nothing was paid out in this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={byDay}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
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
                width={70}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                labelFormatter={(value) => formatDay(value as string, true)}
                formatter={(value: number, name) => [formatUsd(value), name]}
              />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              <Bar
                dataKey="cashbackUsd"
                name="Cashback"
                stackId="paid"
                fill="#6366f1"
              />
              <Bar
                dataKey="referralUsd"
                name="Referrals"
                stackId="paid"
                fill="#0d9488"
                radius={[3, 3, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="totalUsd"
                name="Total"
                stroke="#e11d48"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel
        title="Points issued per day"
        question="How fast is the points liability growing?"
        source={data?.points.meta.source}
        updatedAt={data?.points.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {data && data.points.byDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.points.byDay}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => formatDay(value)}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <YAxis
                tickFormatter={(value: number) => formatNumber(value, 0, 0)}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                width={70}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                labelFormatter={(value) => formatDay(value as string, true)}
                formatter={(value: number) => [
                  formatNumber(value, 0, 0),
                  "Points",
                ]}
              />
              <Bar dataKey="points" fill="#7c3aed" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">
            No points were issued in this period.
          </div>
        )}
      </Panel>
    </div>
  );
}

/** A `YYYY-MM-DD` bucket as a label, read in UTC to match how it was grouped. */
function formatDay(value: string, withYear = false): string {
  return formatDateTime(`${value}T00:00:00Z`, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export default RewardsPaidView;
