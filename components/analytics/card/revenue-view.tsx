"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
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
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import { Panel } from "@/components/analytics/panel";
import { Button } from "@/components/ui/button";
import {
  EmptyPanel,
  PayoutStatusBadge,
  RailLabel,
  formatCount,
  formatMonth,
  formatPercent,
} from "@/components/analytics/card/card-shared";
import { RecordPayoutDialog } from "@/components/analytics/card/record-payout-dialog";
import { useCardRevenue, useRefreshRainReport } from "@/hooks/use-card-analytics";
import { cn, formatDateTime, formatUsd } from "@/lib/utils";
import {
  RAIL_COLORS,
  RAIL_LABELS,
  type CardRevenueMonth,
  type CardRevenueProvider,
} from "@/types/card-analytics";

const MONTH_OPTIONS = [6, 12, 24];

const OWN_FEE_LABELS: Record<string, string> = {
  fx: "FX fee (ours)",
  card_deposit_bridge: "Top-up from another chain",
  rain_card_onboarding: "Card onboarding",
};

/**
 * The FX revenue card issuers owe us, month by month, and whether it arrived.
 *
 * Our own FX fee is switched off; Rain and Wirex charge theirs and pay us a
 * share — Rain in the first two weeks of the following month, reported in its
 * monthly issuing report. Each month shows what our ledger predicts, what Rain
 * reported, and what was paid, so a missing report or a late or short payout
 * is a row on this table rather than something someone has to notice.
 */
export function CardRevenueView() {
  const [months, setMonths] = useState(6);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, error } = useCardRevenue(months);
  const refresh = useRefreshRainReport();

  const chart = useMemo(() => {
    if (!data) return [];
    const byMonth = new Map<string, Record<string, number | string>>();
    for (const month of data.months) {
      const row = byMonth.get(month.billingMonth) ?? { month: month.billingMonth };
      row[month.provider] = month.expectedPayoutUsd;
      byMonth.set(month.billingMonth, row);
    }
    return [...byMonth.values()].sort((a, b) =>
      String(a.month).localeCompare(String(b.month))
    );
  }, [data]);

  const assumed =
    data &&
    (data.assumptions.rainFxRateAssumed || data.assumptions.wirexFxRateAssumed);
  const overdue = data?.months.filter((month) => month.status === "overdue") ?? [];

  const fetchReport = (billingMonth: string) =>
    refresh.mutate(billingMonth, {
      onSuccess: (result) => {
        if (result.status === "fetched") {
          toast.success(
            `Rain report for ${formatMonth(billingMonth)}: ${formatCount(
              result.rowCount ?? 0
            )} rows, FX fees ${
              result.fxFeesUsd == null ? "unreadable" : formatUsd(result.fxFeesUsd)
            }.`
          );
        } else if (result.status === "not_available") {
          toast.info(`Rain has not published the report for ${formatMonth(billingMonth)} yet.`);
        } else {
          toast.error(`Could not fetch the report: ${result.error ?? "unknown error"}`);
        }
      },
      onError: () => toast.error("Could not fetch the report."),
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          By billing month — the month the card spend settled in. Not scoped by
          the date range above: a payout belongs to a whole month.
        </p>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-0.5">
          {MONTH_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMonths(option)}
              className={cn(
                "cursor-pointer rounded px-2.5 py-1 text-xs font-medium",
                option === months ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {option} months
            </button>
          ))}
        </div>
      </div>

      {assumed ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p>
            Estimates assume a{" "}
            {data!.assumptions.rainFxRateAssumed
              ? `${formatPercent(data!.assumptions.rainFxRate, 2)} Rain`
              : null}
            {data!.assumptions.rainFxRateAssumed && data!.assumptions.wirexFxRateAssumed
              ? " and "
              : null}
            {data!.assumptions.wirexFxRateAssumed
              ? `${formatPercent(data!.assumptions.wirexFxRate, 2)} Wirex`
              : null}{" "}
            payout rate because the contracted rate is not set. Enter it under{" "}
            <Link href="/costs-config" className="font-medium underline">
              Cost inputs
            </Link>
            . Rain months with a report use Rain&apos;s own figure regardless.
          </p>
        </div>
      ) : null}

      {overdue.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {overdue.length === 1 ? "One payout is" : `${overdue.length} payouts are`} past
            the 14th with nothing recorded:{" "}
            {overdue
              .map((month) => `${RAIL_LABELS[month.provider]} ${formatMonth(month.billingMonth)}`)
              .join(", ")}
            .
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpiCard
          title="Expected FX payouts"
          value={data ? formatUsd(data.totals.expectedFxUsd) : undefined}
          scope={`Last ${months} billing months, reported where Rain has reported`}
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Reported by Rain"
          value={data ? formatUsd(data.totals.reportedFxUsd) : undefined}
          scope="FX fees in Rain's monthly issuing reports"
          source="rain"
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Received"
          value={data ? formatUsd(data.totals.receivedUsd) : undefined}
          scope="Payouts recorded, both issuers"
          source="manual"
          updatedAt={data?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Outstanding"
          value={data ? formatUsd(data.totals.outstandingUsd) : undefined}
          scope="Expected for finished months with no payout recorded"
          source={data?.meta.source}
          updatedAt={data?.meta.updatedAt}
          invertTrendColor
        />
      </div>

      <Panel
        title="Expected FX payout per month"
        question="How much FX revenue is each issuer generating for us?"
        source={data?.meta.source}
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {chart.length === 0 ? (
          <EmptyPanel>No card months to show.</EmptyPanel>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={(value: string) => formatMonth(value)}
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
                labelFormatter={(value) => formatMonth(value as string)}
                formatter={(value: number, name) => [formatUsd(value), name]}
              />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              {(["rain", "wirex"] as CardRevenueProvider[]).map((provider, index) => (
                <Bar
                  key={provider}
                  dataKey={provider}
                  name={RAIL_LABELS[provider]}
                  stackId="fx"
                  fill={RAIL_COLORS[provider]}
                  stroke="#ffffff"
                  strokeWidth={1}
                  radius={index === 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel
        title="Billing and payouts"
        question="Did each issuer report and pay what our ledger says it owes?"
        source={data?.meta.source}
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {data && data.months.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2 font-medium" />
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 font-medium">Issuer</th>
                  <th className="pb-2 text-right font-medium">Foreign spend</th>
                  <th className="pb-2 text-right font-medium">Estimate</th>
                  <th className="pb-2 text-right font-medium">Reported</th>
                  <th className="pb-2 text-right font-medium">Received</th>
                  <th className="pb-2 text-right font-medium">Variance</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.months.map((month) => {
                  const key = `${month.provider}:${month.billingMonth}`;
                  const isOpen = expanded === key;
                  const canExpand = month.provider === "rain";
                  return (
                    <Fragment key={key}>
                      <tr className={cn(isOpen && "bg-gray-50")}>
                        <td className="py-2 pl-1">
                          {canExpand ? (
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpen ? null : key)}
                              className="cursor-pointer text-gray-400 hover:text-gray-700"
                              aria-label={isOpen ? "Hide report" : "Show report"}
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          ) : null}
                        </td>
                        <td className="py-2 font-medium text-gray-900">{formatMonth(month.billingMonth)}</td>
                        <td className="py-2">
                          <RailLabel rail={month.provider} />
                        </td>
                        <td className="py-2 text-right tabular-nums">{formatUsd(month.foreignSpendUsd)}</td>
                        <td className="py-2 text-right tabular-nums text-gray-500">
                          {formatUsd(month.estimatedFxUsd)}
                          <span className="ml-1 text-[11px]">
                            @{formatPercent(month.fxRate, 2)}
                            {month.fxRateAssumed ? "*" : ""}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {month.provider === "wirex" ? (
                            <span className="text-xs text-gray-400">No report</span>
                          ) : month.report ? (
                            month.report.fxFeesUsd == null ? (
                              <span className="text-xs text-amber-700">Unreadable</span>
                            ) : (
                              formatUsd(month.report.fxFeesUsd)
                            )
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {month.payout ? formatUsd(month.payout.amountUsd) : "—"}
                        </td>
                        <td
                          className={cn(
                            "py-2 text-right tabular-nums",
                            month.varianceUsd != null && Math.abs(month.varianceUsd) > 1
                              ? "text-red-700"
                              : "text-gray-500"
                          )}
                        >
                          {month.varianceUsd == null
                            ? "—"
                            : `${month.varianceUsd >= 0 ? "+" : "−"}${formatUsd(Math.abs(month.varianceUsd))}`}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-col gap-0.5">
                            <PayoutStatusBadge status={month.status} />
                            {month.status === "awaiting_payout" ||
                            month.status === "awaiting_report" ||
                            month.status === "overdue" ? (
                              <span className="text-[11px] text-gray-400">
                                due {formatDateTime(month.payoutDueBy, { month: "short", day: "numeric", timeZone: "UTC" })}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-2">
                            {month.provider === "rain" && month.status !== "accruing" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => fetchReport(month.billingMonth)}
                                disabled={refresh.isPending}
                                className="cursor-pointer"
                                title="Fetch Rain's report for this month now"
                              >
                                {refresh.isPending && refresh.variables === month.billingMonth ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                )}
                                Report
                              </Button>
                            ) : null}
                            {month.status !== "accruing" ? <RecordPayoutDialog month={month} /> : null}
                          </div>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="bg-gray-50">
                          <td />
                          <td colSpan={9} className="pb-4 pr-4">
                            <ReportDetail month={month} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-400">
              Estimate = payout rate × settled foreign-currency spend in our
              ledger. * the rate is an assumed default, not a contracted figure.
              Rain&apos;s report supersedes the estimate once it is in.
            </p>
          </div>
        ) : (
          <EmptyPanel>No card months to show.</EmptyPanel>
        )}
      </Panel>

      <Panel
        title="Our own card fees"
        question="What did our own card fees earn, while they were switched on?"
        source="database"
        updatedAt={data?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
      >
        {data && data.ownFees.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium">Fee</th>
                <th className="pb-2 font-medium">Issuer</th>
                <th className="pb-2 text-right font-medium">Charged</th>
                <th className="pb-2 text-right font-medium">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...data.ownFees]
                .sort((a, b) => b.month.localeCompare(a.month) || b.feeUsd - a.feeUsd)
                .map((row) => (
                  <tr key={`${row.month}:${row.product}:${row.provider}`}>
                    <td className="py-1.5 text-gray-900">{formatMonth(row.month)}</td>
                    <td className="py-1.5 text-gray-700">{OWN_FEE_LABELS[row.product] ?? row.product}</td>
                    <td className="py-1.5">
                      <RailLabel rail={row.provider} />
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{formatUsd(row.feeUsd)}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-500">{formatCount(row.count)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <EmptyPanel>No card fees were charged in these months.</EmptyPanel>
        )}
      </Panel>
    </div>
  );
}

/** What Rain's report said for a month, and how it reconciles with our ledger. */
function ReportDetail({ month }: { month: CardRevenueMonth }) {
  const { report, reconciliation } = month;
  if (!report) {
    return (
      <p className="pt-2 text-sm text-gray-500">
        No report stored for {formatMonth(month.billingMonth)} yet. Rain publishes
        it early the following month; the daily sweep picks it up, or fetch it
        now with the Report button.
      </p>
    );
  }

  const unit = (value: string | null) =>
    value === null ? "unreadable" : value === "micro_usd" ? "micro-dollars" : value;

  return (
    <div className="grid grid-cols-1 gap-4 pt-2 lg:grid-cols-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-gray-200 bg-white p-3 text-xs">
        <dt className="text-gray-500">Report</dt>
        <dd className="text-gray-900">
          {report.reportMonth} · fetched {formatDateTime(report.fetchedAt)}
        </dd>
        <dt className="text-gray-500">Rows / spend rows</dt>
        <dd className="text-gray-900">
          {formatCount(report.rowCount)} / {formatCount(report.spendCount)}
        </dd>
        <dt className="text-gray-500">Settled spend</dt>
        <dd className="text-gray-900">{formatUsd(report.settledSpendUsd)}</dd>
        <dt className="text-gray-500">FX fees (our payout)</dt>
        <dd className="text-gray-900">
          {report.fxFeesUsd == null ? "Unreadable" : formatUsd(report.fxFeesUsd)}
        </dd>
        <dt className="text-gray-500">Interchange</dt>
        <dd className="text-gray-900">
          {report.interchangeUsd == null ? "Unreadable" : formatUsd(report.interchangeUsd)}
        </dd>
        <dt className="text-gray-500">Cross-border fees</dt>
        <dd className="text-gray-900">
          {report.crossBorderFeesUsd == null ? "Unreadable" : formatUsd(report.crossBorderFeesUsd)}
        </dd>
        <dt className="text-gray-500">International transactions</dt>
        <dd className="text-gray-900">{formatCount(report.internationalCount)}</dd>
        <dt className="text-gray-500">Units read as</dt>
        <dd className="text-gray-900">
          settlement {unit(report.units.settlement)}, FX {unit(report.units.foreignExchangeFees)},
          interchange {unit(report.units.interchange)}
        </dd>
      </dl>

      {reconciliation ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-gray-200 bg-white p-3 text-xs">
          <dt className="text-gray-500">Matched to our ledger</dt>
          <dd className="text-gray-900">
            {formatCount(reconciliation.matched)} of {formatCount(reconciliation.reportCount)}
          </dd>
          <dt className="text-gray-500">Only in Rain&apos;s report</dt>
          <dd className={cn(reconciliation.onlyInReport > 0 ? "text-amber-700" : "text-gray-900")}>
            {formatCount(reconciliation.onlyInReport)}
          </dd>
          <dt className="text-gray-500">Only in our ledger</dt>
          <dd className={cn(reconciliation.onlyInLedger > 0 ? "text-amber-700" : "text-gray-900")}>
            {formatCount(reconciliation.onlyInLedger)}
          </dd>
          <dt className="text-gray-500">Settled: report vs ledger</dt>
          <dd className="text-gray-900">
            {formatUsd(reconciliation.reportSettledUsd)} vs {formatUsd(reconciliation.ledgerSettledUsd)}
          </dd>
          <dt className="text-gray-500">Difference</dt>
          <dd
            className={cn(
              Math.abs(reconciliation.differenceUsd) > 1 ? "text-red-700" : "text-gray-900"
            )}
          >
            {formatUsd(reconciliation.differenceUsd)}
          </dd>
          {reconciliation.sampleOnlyInReport.length > 0 ? (
            <>
              <dt className="text-gray-500">Missing from ledger (sample)</dt>
              <dd className="break-all font-mono text-[11px] text-gray-700">
                {reconciliation.sampleOnlyInReport.slice(0, 5).join(", ")}
              </dd>
            </>
          ) : null}
          {reconciliation.sampleOnlyInLedger.length > 0 ? (
            <>
              <dt className="text-gray-500">Missing from report (sample)</dt>
              <dd className="break-all font-mono text-[11px] text-gray-700">
                {reconciliation.sampleOnlyInLedger.slice(0, 5).join(", ")}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

export default CardRevenueView;
