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
import {
  formatDateTime,
  formatEur,
  formatNumber,
  formatUsd,
} from "@/lib/utils";
import type { CashbackCurrency } from "@/types";
import type { LiabilityBucket } from "@/types/analytics";

/** Bars for the next month; beyond that the forecast is not worth the width. */
const FORECAST_DAYS = 30;

export function RewardsOwedView() {
  const { data, isLoading, error } = useRewardsOwed();

  const referrals = data?.referrals;
  const cashback = data?.cashback;
  const points = data?.points;
  // Euro cashback owed, in EUR. Never added to the dollar figures — it has its
  // own KPI, overdue line and credit-date series.
  const cashbackEur = cashback?.eur;

  return (
    <div className="space-y-6">
      <div
        className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
          cashbackEur ? "xl:grid-cols-5" : "xl:grid-cols-4"
        }`}
      >
        <AnalyticsKpiCard
          title="Committed"
          value={data ? formatUsd(data.totals.committedUsd) : undefined}
          scope={
            cashbackEur
              ? "Qualified referrals + accrued USD cashback. Money already earned. Euro cashback is separate."
              : "Qualified referrals + accrued cashback. Money already earned."
          }
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
        {cashbackEur ? (
          <AnalyticsKpiCard
            title="Accrued cashback (EUR)"
            metric="accruedCashback"
            value={formatEur(cashbackEur.accruedEur)}
            scope="Euro cardholders, paid in soEUR on Base. Not in the USD totals."
            source={cashback?.meta.source}
            updatedAt={cashback?.meta.updatedAt}
            invertTrendColor
          />
        ) : null}
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
        cashbackOverdueEur={cashbackEur?.overdueEur}
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

      {cashbackEur ? (
        <Panel
          title="Euro cashback credit dates"
          question="When does accrued euro cashback reach euro cardholders?"
          source={cashback?.meta.source}
          updatedAt={cashback?.meta.updatedAt}
          isLoading={isLoading}
          error={error}
        >
          <LiabilityBars
            buckets={cashbackEur.byCreditDate}
            currency="EUR"
            emptyLabel="No euro cashback is scheduled to credit in this window."
          />
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3">
            <Stat label="Accrued" value={formatEur(cashbackEur.accruedEur)} />
            <Stat
              label="Scheduled"
              value={formatEur(
                cashbackEur.byCreditDate.reduce((sum, b) => sum + b.eur, 0)
              )}
            />
            <Stat
              label="Overdue"
              value={
                cashbackEur.overdueEur > 0
                  ? formatEur(cashbackEur.overdueEur)
                  : "—"
              }
            />
          </dl>
        </Panel>
      ) : null}

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
  cashbackOverdueEur,
}: {
  referralOverdue?: LiabilityBucket;
  cashbackOverdue?: LiabilityBucket;
  /** Euro cashback overdue, in EUR; its own line, never added to the USD one. */
  cashbackOverdueEur?: number;
}) {
  const items: { label: string; count?: number; amount: string }[] = [
    referralOverdue && referralOverdue.count > 0
      ? {
          label: "referral payouts past their due date",
          count: referralOverdue.count,
          amount: formatUsd(referralOverdue.usd),
        }
      : null,
    cashbackOverdue && cashbackOverdue.count > 0
      ? {
          label: "cashback escrows matured and not swept",
          count: cashbackOverdue.count,
          amount: formatUsd(cashbackOverdue.usd),
        }
      : null,
    cashbackOverdueEur && cashbackOverdueEur > 0
      ? {
          label: "Euro cashback escrows matured and not swept",
          amount: formatEur(cashbackOverdueEur),
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
              {item.count !== undefined
                ? `${formatNumber(item.count, 0, 0)} `
                : ""}
              {item.label} · {item.amount}
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
  currency = "USD",
}: {
  buckets: Array<{ date: string; count: number; usd?: number; eur?: number }>;
  emptyLabel: string;
  /** Which figure the bars show: `usd` or, for euro cashback, `eur`. */
  currency?: CashbackCurrency;
}) {
  const data = buckets.slice(0, FORECAST_DAYS);
  const valueKey = currency === "EUR" ? "eur" : "usd";
  const money = currency === "EUR" ? formatEur : formatUsd;

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
          tickFormatter={(value: number) => money(value, 0)}
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
            `${money(value)} · ${item?.payload?.count ?? 0} rows`,
            "Due",
          ]}
        />
        <Bar dataKey={valueKey} radius={[3, 3, 0, 0]}>
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
