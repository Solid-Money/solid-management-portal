"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import { MetricLabel } from "@/components/analytics/metric-label";
import { Panel } from "@/components/analytics/panel";
import { useReferralProgram } from "@/hooks/use-analytics";
import { formatNumber, formatUsd } from "@/lib/utils";

export function RewardsReferralsView() {
  const { data, isLoading, error } = useReferralProgram();

  const counts = data?.counts;
  const terms = data?.terms;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpiCard
          title="Referrers"
          value={counts ? formatNumber(counts.referrers, 0, 0) : undefined}
          scope="Users whose code has been used at least once"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Friends invited"
          value={counts ? formatNumber(counts.invited, 0, 0) : undefined}
          scope="All time, across every status"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Qualification rate"
          metric="qualificationRate"
          value={
            data
              ? data.qualificationRate === null
                ? "No closed windows yet"
                : `${(data.qualificationRate * 100).toFixed(1)}%`
              : undefined
          }
          scope="Qualified ÷ referrals whose window has closed"
          source="derived"
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Cost per qualified referral"
          value={
            terms
              ? formatUsd(terms.referrerRewardUsd + terms.newUserRewardUsd)
              : undefined
          }
          scope="Both legs of the reward, at current configured amounts"
          source="manual"
          updatedAt={data?.meta.updatedAt}
          invertTrendColor
        />
      </div>

      <Panel
        title="Program terms, as configured"
        question="What are we currently offering, and on what conditions?"
        source="manual"
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
        actions={
          <Link
            href="/rewards-config"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            Edit
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      >
        {terms ? (
          <>
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <Term
                label="Referrer reward"
                value={formatUsd(terms.referrerRewardUsd)}
              />
              <Term
                label="Friend reward"
                value={formatUsd(terms.newUserRewardUsd)}
              />
              <Term label="Settles in" value={terms.payoutToken} />
              <Term
                label="Program"
                value={terms.enabled ? "Live" : "Paused"}
                emphasis={!terms.enabled}
              />
              <Term
                label="Spend target"
                value={formatUsd(terms.spendTargetUsd)}
              />
              <Term
                label="Distinct merchants"
                value={formatNumber(terms.merchantTarget, 0, 0)}
              />
              <Term
                label="Qualify window"
                value={`${formatNumber(terms.qualifyWindowDays, 0, 0)} days`}
              />
              <Term
                label="Payout delay"
                value={`${formatNumber(terms.payoutDelayDays, 0, 0)} days`}
              />
            </dl>
            {/* These are read live from config rather than written into the
                panel: the amounts and the spend gate have both moved once
                already, and a hardcoded copy would have gone stale silently. */}
            <p className="mt-4 border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-500">
              Read live from the rewards config. Changing a value there changes
              every number on this tab, including the liability forecast.
            </p>
          </>
        ) : null}
      </Panel>

      <Panel
        title="Where referrals stand"
        question="How many friends are at each stage of qualifying?"
        source={data?.meta.source}
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {counts ? (
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3 lg:grid-cols-6">
            <Term
              label={<MetricLabel metric="pendingReferral" label="Pending" />}
              value={formatNumber(counts.pending, 0, 0)}
            />
            <Term
              label={
                <MetricLabel metric="qualifiedUnpaid" label="Qualified" />
              }
              value={formatNumber(counts.qualified, 0, 0)}
            />
            <Term label="Paid" value={formatNumber(counts.paid, 0, 0)} />
            <Term label="Expired" value={formatNumber(counts.expired, 0, 0)} />
            <Term
              label="Reversed"
              value={formatNumber(counts.reversed, 0, 0)}
            />
            <Term
              label="Under review"
              value={formatNumber(counts.underReview, 0, 0)}
              emphasis={counts.underReview > 0}
            />
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Top referrers"
        question="Which communities and creators actually bring users who qualify?"
        source={data?.meta.source}
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="py-2 pr-4">Referrer</th>
                <th className="py-2 pr-4 text-right">Invited</th>
                <th className="py-2 pr-4 text-right">Qualified</th>
                <th className="py-2 pr-4 text-right">Paid</th>
                <th className="py-2 pr-4 text-right">Paid out</th>
                <th className="py-2 text-right">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.topReferrers ?? []).map((row) => (
                <tr key={row.referrerId} className="hover:bg-gray-50">
                  <td className="py-2 pr-4">
                    {/* Ranked by referrer id: resolving it to a person is a
                        click through to their profile, which keeps this
                        endpoint free of names and emails. */}
                    <Link
                      href={`/users/${row.referrerId}`}
                      className="font-mono text-xs text-indigo-600 hover:underline"
                    >
                      {row.referrerId}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-700">
                    {formatNumber(row.invited, 0, 0)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-700">
                    {formatNumber(row.qualified, 0, 0)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-700">
                    {formatNumber(row.paid, 0, 0)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-700">
                    {formatUsd(row.paidUsd)}
                  </td>
                  <td className="py-2 text-right text-gray-500">
                    {row.invited > 0
                      ? `${((row.qualified / row.invited) * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
              {data && data.topReferrers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    No referrals recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Term({
  label,
  value,
  emphasis,
}: {
  label: React.ReactNode;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd
        className={
          emphasis ? "font-semibold text-amber-700" : "font-medium text-gray-900"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export default RewardsReferralsView;
