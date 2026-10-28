"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
import { NotAvailableYet } from "@/components/referral-v4/not-available";
import { useReferralV4Analytics } from "@/hooks/use-analytics";
import { formatUtc, isNotAvailable } from "@/lib/referral-v4";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/utils";

/**
 * Referral v4 in money: card credit granted, spent and still outstanding,
 * what is held, the soFUSE spend share paid, and what Thursday's run is
 * expected to pay.
 *
 * Unscoped by the header's dates, like the liability view: outstanding credit
 * and bonuses on hold are positions, and the weekly series carries its own
 * dates.
 */
export function RewardsReferralsV4View() {
  const { data, isLoading, error } = useReferralV4Analytics();

  if (error && isNotAvailable(error)) {
    return <NotAvailableYet what="Referral v4 analytics" className="p-4" />;
  }

  const weekly = data?.weekly ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpiCard
          title="Card credit granted"
          value={data ? formatUsd(data.creditGrantedUsd) : undefined}
          scope="All time — referral bonuses, boosts and admin grants"
          source="database"
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Card credit spent"
          value={data ? formatUsd(data.creditSpentUsd) : undefined}
          scope="All time — used at Wirex authorization, net of refunds"
          source="database"
        />
        <AnalyticsKpiCard
          title="Credit outstanding"
          value={data ? formatUsd(data.creditOutstandingUsd) : undefined}
          scope="Granted, not yet spent or removed — what users can still spend"
          source="database"
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Credit pending"
          value={data ? formatUsd(data.creditPendingUsd) : undefined}
          scope="Held by card authorizations waiting to settle"
          source="database"
        />
        <AnalyticsKpiCard
          title="Bonuses on hold"
          value={data ? formatUsd(data.onHoldUsd) : undefined}
          scope="Earned, not yet credited — on hold, over the bonus limit or in review"
          source="database"
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Spend share paid"
          value={data ? formatUsd(data.spendSharePaidUsd) : undefined}
          scope="All time, in soFUSE to referrers every Thursday"
          source="database"
          invertTrendColor
        />
        <AnalyticsKpiCard
          className="md:col-span-2"
          title="Next payout"
          value={
            data?.nextPayout ? formatUsd(data.nextPayout.estimateUsd) : undefined
          }
          scope={
            data?.nextPayout
              ? `Estimate for ${formatUtc(data.nextPayout.at)} · ${formatNumber(
                  data.nextPayout.referrers,
                  0,
                  0,
                )} referrer${data.nextPayout.referrers === 1 ? "" : "s"} — unlocked card credit plus last week's spend share`
              : "Unlocked card credit plus last week's spend share"
          }
          source="derived"
        />
      </div>

      <Panel
        title="Referral v4 payouts per week"
        question="What does referral v4 pay out each week, and in which form?"
        source="database"
        isLoading={isLoading}
        error={error}
        actions={
          <Link
            href="/rewards-config"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            Program settings
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      >
        {weekly.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-gray-400">
            Nothing has been paid by referral v4 yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={weekly}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="weekStart"
                tickFormatter={(value: string) => formatWeek(value)}
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
                labelFormatter={(value) =>
                  `Week of ${formatWeek(value as string, true)}`
                }
                formatter={(value: number, name) => [formatUsd(value), name]}
              />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              <Bar
                dataKey="creditGrantedUsd"
                name="Card credit granted"
                stackId="paid"
                fill="#6366f1"
              />
              <Bar
                dataKey="spendSharePaidUsd"
                name="Spend share paid (soFUSE)"
                stackId="paid"
                fill="#0d9488"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </div>
  );
}

/** A week's start (ISO date or instant) as a label, read in UTC. */
function formatWeek(value: string, withYear = false): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  return formatDateTime(iso, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export default RewardsReferralsV4View;
