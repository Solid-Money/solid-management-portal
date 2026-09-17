"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import { MetricLabel } from "@/components/analytics/metric-label";
import { NotInstrumented } from "@/components/analytics/not-instrumented";
import { Panel } from "@/components/analytics/panel";
import { useRewardsOwed } from "@/hooks/use-analytics";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import type { LiabilityBucket } from "@/types/analytics";

/** Bars for the next month; beyond that the forecast is not worth the width. */
const FORECAST_DAYS = 30;

export function RewardsOwedView() {
  const { data, isLoading, error } = useRewardsOwed();

  const referrals = data?.referrals;
  const cashback = data?.cashback;
  const points = data?.points;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpiCard
          title="Committed"
          value={data ? formatUsd(data.totals.committedUsd) : undefined}
          scope="Qualified referrals + accrued cashback. Money already earned."
          source="database"
          updatedAt={data?.generatedAt}
          // A liability going up is not good news, so the trend colours invert.
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Forecast"
          value={data ? formatUsd(data.totals.forecastUsd) : undefined}
          scope="Committed, plus pending referrals at the historical qualification rate."
          source="derived"
          updatedAt={data?.generatedAt}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Accrued cashback"
          metric="accruedCashback"
          value={cashback ? formatUsd(cashback.accruedUsd) : undefined}
          scope={
            cashback
              ? `${formatNumber(cashback.count, 0, 0)} escrowed purchases awaiting credit`
              : "Escrowed purchases awaiting credit"
          }
          source={cashback?.meta.source}
          updatedAt={cashback?.meta.updatedAt}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Points outstanding"
          metric="pointsLiability"
          value={
            points
              ? points.impliedUsd.instrumented
                ? formatUsd(points.impliedUsd.usd)
                : null
              : undefined
          }
          scope={
            points
              ? `${formatNumber(points.totalPoints, 0, 0)} points held by ${formatNumber(points.holders, 0, 0)} users`
              : "Points issued and not yet redeemed"
          }
          source={points?.meta.source}
          updatedAt={points?.meta.updatedAt}
          invertTrendColor
        />
      </div>

      {/* Anything past its due date is a payout that should already have run,
          so it is surfaced above the forecasts rather than inside them. */}
      <OverdueStrip
        referralOverdue={referrals?.qualifiedUnpaid.overdue}
        cashbackOverdue={cashback?.overdue}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Referral payouts due"
          question="What leaves the referral wallet over the next 30 days?"
          source={referrals?.meta.source}
          updatedAt={referrals?.meta.updatedAt}
          isLoading={isLoading}
          error={error}
        >
          {referrals ? (
            <>
              <LiabilityBars
                buckets={referrals.qualifiedUnpaid.byDueDate}
                emptyLabel="No qualified referrals are waiting on a payout."
              />
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3">
                <Stat
                  label={<MetricLabel metric="qualifiedUnpaid" label="Qualified, unpaid" />}
                  value={`${formatUsd(referrals.qualifiedUnpaid.usd)} · ${referrals.qualifiedUnpaid.count}`}
                />
                <Stat
                  label={<MetricLabel metric="pendingReferral" label="Pending" />}
                  value={`${formatUsd(referrals.pending.expectedUsd)} · ${referrals.pending.count}`}
                />
                <Stat
                  label="Under review"
                  value={`${formatUsd(referrals.underReview.usd)} · ${referrals.underReview.count}`}
                />
              </dl>
            </>
          ) : null}
        </Panel>

        <Panel
          title="Cashback credit dates"
          question="When does accrued cashback actually reach cardholders?"
          source={cashback?.meta.source}
          updatedAt={cashback?.meta.updatedAt}
          isLoading={isLoading}
          error={error}
        >
          {cashback ? (
            <>
              <LiabilityBars
                buckets={cashback.byCreditDate}
                emptyLabel="No cashback is scheduled to credit in this window."
              />
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3">
                <Stat
                  label="Scheduled"
                  value={formatUsd(
                    cashback.byCreditDate.reduce((sum, b) => sum + b.usd, 0)
                  )}
                />
                <Stat
                  label="Not yet scheduled"
                  value={`${formatUsd(cashback.unscheduled.usd)} · ${cashback.unscheduled.count}`}
                />
                {/* Spend on rows too old to carry their own rate. Reported as
                    spend, not dollars, because pricing it here would mean
                    guessing which rate applies. */}
                <Stat
                  label="Unrated spend"
                  value={
                    cashback.unratedSpend > 0
                      ? formatUsd(cashback.unratedSpend)
                      : "—"
                  }
                />
              </dl>
            </>
          ) : null}
        </Panel>
      </div>

      <Panel
        title="Pending referrals by deadline"
        question="How much could we owe, and when does each friend run out of time?"
        source={referrals?.meta.source}
        updatedAt={referrals?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {referrals ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <Stat
                label="At full value"
                value={formatUsd(referrals.pending.expectedUsd)}
                hint="If every pending friend qualified"
              />
              <Stat
                label="Risk-adjusted"
                value={formatUsd(referrals.pending.riskAdjustedUsd)}
                hint="At the historical qualification rate"
              />
              <Stat
                label={
                  <MetricLabel metric="qualificationRate" label="Qualification rate" />
                }
                value={
                  referrals.qualificationRate === null
                    ? "No closed windows yet"
                    : `${(referrals.qualificationRate * 100).toFixed(1)}%`
                }
              />
              <Stat
                label="Terms"
                value={`${formatUsd(referrals.terms.referrerRewardUsd)} + ${formatUsd(
                  referrals.terms.newUserRewardUsd
                )} in ${referrals.terms.payoutToken}`}
                hint={`${formatUsd(referrals.terms.spendTargetUsd)} across ${
                  referrals.terms.merchantTarget
                } merchants in ${referrals.terms.qualifyWindowDays} days`}
              />
            </div>
            <LiabilityBars
              buckets={referrals.pending.byWindowClose}
              emptyLabel="No referrals are inside their qualify window."
            />
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Points issued, by what earned them"
        question="What is the points liability made of?"
        source={points?.meta.source}
        updatedAt={points?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {points ? (
          <div className="space-y-4">
            {!points.impliedUsd.instrumented ? (
              <NotInstrumented
                metric="Points liability in USD"
                reason={points.impliedUsd.reason}
              />
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="py-2 pr-4">Earned by</th>
                    <th className="py-2 pr-4 text-right">Points</th>
                    <th className="py-2 pr-4 text-right">Awards</th>
                    <th className="py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {points.byType.map((row) => (
                    <tr key={row.type}>
                      <td className="py-2 pr-4 text-gray-900">{row.type}</td>
                      <td className="py-2 pr-4 text-right text-gray-700">
                        {formatNumber(row.points, 0, 0)}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-500">
                        {formatNumber(row.count, 0, 0)}
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {points.totalPoints > 0
                          ? `${((row.points / points.totalPoints) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {points.byType.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-400">
                        No points issued yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function OverdueStrip({
  referralOverdue,
  cashbackOverdue,
}: {
  referralOverdue?: LiabilityBucket;
  cashbackOverdue?: LiabilityBucket;
}) {
  const items = [
    referralOverdue && referralOverdue.count > 0
      ? {
          label: "referral payouts past their due date",
          count: referralOverdue.count,
          usd: referralOverdue.usd,
        }
      : null,
    cashbackOverdue && cashbackOverdue.count > 0
      ? {
          label: "cashback escrows matured and not swept",
          count: cashbackOverdue.count,
          usd: cashbackOverdue.usd,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
          aria-hidden
        />
        <div className="space-y-0.5 text-sm text-amber-900">
          <p className="font-medium">Payouts are running late</p>
          {items.map((item) => (
            <p key={item.label} className="text-xs">
              {formatNumber(item.count, 0, 0)} {item.label} ·{" "}
              {formatUsd(item.usd)}
            </p>
          ))}
          <p className="pt-0.5 text-xs text-amber-700">
            The daily sweep may not have run. Check the payout wallet balance
            before assuming a code problem.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * A day-by-day liability series.
 *
 * Bars rather than a line: these are discrete obligations falling due on
 * specific dates, and a line between them would imply a continuous quantity
 * that does not exist.
 */
function LiabilityBars({
  buckets,
  emptyLabel,
}: {
  buckets: LiabilityBucket[];
  emptyLabel: string;
}) {
  const data = buckets.slice(0, FORECAST_DAYS);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) =>
            formatDateTime(`${value}T00:00:00Z`, {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })
          }
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
            formatDateTime(`${value}T00:00:00Z`, {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })
          }
          formatter={(value: number, _name, item) => [
            `${formatUsd(value)} · ${item?.payload?.count ?? 0} rows`,
            "Due",
          ]}
        />
        <Bar dataKey="usd" radius={[3, 3, 0, 0]}>
          {data.map((bucket) => (
            <Cell key={bucket.date} fill="#6366f1" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: React.ReactNode;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
      {hint ? <p className="text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

export default RewardsOwedView;
