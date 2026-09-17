"use client";

import Link from "next/link";
import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import { NotInstrumented } from "@/components/analytics/not-instrumented";
import { Panel } from "@/components/analytics/panel";
import { useRewardsOwed, useRewardsPaid } from "@/hooks/use-analytics";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters";
import { useExecutiveSummary } from "@/hooks/use-revenue";
import { formatUsd } from "@/lib/utils";

/**
 * The Overview hero.
 *
 * Every tile is either a real number or says it is not instrumented — none of
 * them is a placeholder zero. The tiles that need panels from Phase 2 (AUM,
 * funded users, the 90-day spend target) say so, so it is obvious at a glance
 * how much of this page is real.
 *
 * Revenue comes from the existing executive summary, whose scope is stated on
 * the tile: it is a fixed 30-day window and does not follow the header's date
 * range. Labelling that is the point — it is one of the three revenue totals
 * that disagreed, and the disagreement was a scope difference nobody could see.
 */
export function OverviewView() {
  const { queryString, filters } = useAnalyticsFilters();

  const executive = useExecutiveSummary();
  const owed = useRewardsOwed();
  const paid = useRewardsPaid(queryString());

  const incentivePaid = paid.data
    ? paid.data.cashback.totalUsd + paid.data.referrals.totalUsd
    : undefined;

  const revenue = executive.data?.totalRevenue;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnalyticsKpiCard
          title="Revenue"
          metric="revenue"
          value={revenue ? formatUsd(Number(revenue.value ?? 0)) : undefined}
          scope="Last 30 days, all revenue types. Fixed window — not the range above."
          change={revenue?.change}
          trend={trendFrom(revenue?.change)}
          source="database"
        />
        <AnalyticsKpiCard
          title="Incentive paid"
          metric="incentiveCost"
          value={incentivePaid === undefined ? undefined : formatUsd(incentivePaid)}
          scope={`Cashback + referral payouts, ${filters.startDate} to ${filters.endDate}`}
          source="derived"
          updatedAt={paid.data?.generatedAt}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Owed to users"
          value={owed.data ? formatUsd(owed.data.totals.committedUsd) : undefined}
          scope="Committed now: qualified referrals + accrued cashback"
          source="database"
          updatedAt={owed.data?.generatedAt}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Card spending"
          metric="cardSpending"
          value={null}
          scope="Both rails, settled purchases"
          source="database"
        />
        <AnalyticsKpiCard
          title="AUM"
          metric="aum"
          value={null}
          scope="Solid balance + Savings vaults"
          source="on-chain"
        />
        <AnalyticsKpiCard
          title="Funded users"
          metric="fundedUser"
          value={null}
          scope="Cumulative, with net new in period"
          source="database"
        />
      </div>

      <Panel
        title="Is the incentive programme paying for itself?"
        question="Does revenue cover what we spend acquiring and rewarding users?"
        source="derived"
        updatedAt={paid.data?.generatedAt}
        isLoading={executive.isLoading || paid.isLoading}
        error={executive.error ?? paid.error}
      >
        {revenue && incentivePaid !== undefined ? (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-500">Revenue (30d)</dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {formatUsd(Number(revenue.value ?? 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">
                  Incentive paid (selected range)
                </dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {formatUsd(incentivePaid)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Owed but unpaid</dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {owed.data ? formatUsd(owed.data.totals.committedUsd) : "—"}
                </dd>
              </div>
            </dl>
            {/* The two figures cover different windows, so they are shown side
                by side rather than subtracted. A single "net" number here would
                be a subtraction across mismatched periods — exactly the kind of
                quietly wrong figure this section replaces. */}
            <p className="text-xs leading-relaxed text-gray-500">
              These are not directly comparable yet: revenue is a fixed 30-day
              window from the executive summary, incentive spend follows the
              range above. The daily revenue-versus-incentive chart, which puts
              both on one axis, needs the materialised daily revenue table from
              Phase 2.
            </p>
          </div>
        ) : null}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NotInstrumented
          metric="Alerts strip"
          reason="Payout wallet runway, deposit failure spikes, decline bursts and revenue anomalies need the alert evaluation job. Payout runway is already visible under Rewards → Payout wallets."
          phase={2}
        />
        <NotInstrumented
          metric="Progress to the 90-day spend target"
          reason="Needs the daily card-spend series, which lands with the Card tab."
          phase={2}
        />
      </div>

      <Panel
        title="What is real on this page"
        question="How much of Analytics is built, and what is each tab waiting on?"
        source="manual"
      >
        <ul className="space-y-2 text-sm text-gray-600">
          <li>
            <strong className="font-medium text-gray-900">Live now:</strong>{" "}
            Rewards (Paid, Owed &amp; upcoming, Payout wallets, Referral
            program), Funnel → Deposits by rail, Revenue (Overview, Fee
            breakdown, Vault economics), Signals → Segments.
          </li>
          <li>
            <strong className="font-medium text-gray-900">Phase 2:</strong>{" "}
            Growth, Card, Vaults, Funnel → Onboarding and Activation messaging,
            Revenue → Unit economics. Each sub-tab names what blocks it.
          </li>
          <li>
            <strong className="font-medium text-gray-900">Phase 3:</strong>{" "}
            Signals → Risk, Support, Product signals, and the Investor tab.
          </li>
          <li>
            <Link
              href="/analytics/glossary"
              className="text-indigo-600 hover:underline"
            >
              Every definition used above
            </Link>{" "}
            — the same numbers should read the same way in every tab.
          </li>
        </ul>
      </Panel>
    </div>
  );
}

/** A change string like "+12.4%" as a trend direction. */
function trendFrom(change?: string): "up" | "down" | "flat" | undefined {
  if (!change) return undefined;
  const value = Number.parseFloat(change.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

export default OverviewView;
