"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NotInstrumented } from "@/components/analytics/not-instrumented";
import { Panel } from "@/components/analytics/panel";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters";
import { useDepositRails } from "@/hooks/use-analytics";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import { DEPOSIT_RAILS, type DepositRailRow } from "@/types/analytics";

export function FunnelRailsView() {
  const { queryString } = useAnalyticsFilters();
  const { data, isLoading, error } = useDepositRails(queryString());

  const rowByRail = new Map<string, DepositRailRow>(
    (data?.rails ?? []).map((row) => [row.rail, row])
  );

  return (
    <div className="space-y-6">
      <Panel
        title="Deposits by rail"
        question="Which rails do deposits arrive on, and where do they fail?"
        source="database"
        updatedAt={data?.generatedAt}
        isLoading={isLoading}
        error={error}
      >
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-4">Rail</th>
                  <th className="py-2 pr-4 text-right">Attempts</th>
                  <th className="py-2 pr-4 text-right">Credited</th>
                  <th className="py-2 pr-4 text-right">Failed</th>
                  <th className="py-2 pr-4 text-right">Volume</th>
                  <th className="py-2 pr-4 text-right">Depositors</th>
                  <th className="py-2 text-right">Median time to credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {DEPOSIT_RAILS.map((rail) => {
                  const row = rowByRail.get(rail.id);

                  // A rail with no ledger yet gets a labelled row rather than
                  // zeros: "nobody used this rail" and "we do not measure this
                  // rail" look identical as numbers and mean opposite things.
                  if (!row) {
                    return (
                      <tr key={rail.id} className="bg-gray-50/60">
                        <td className="py-2 pr-4 text-gray-500">
                          {rail.label}
                        </td>
                        <td colSpan={6} className="py-2 text-xs text-gray-400">
                          Not instrumented
                          {rail.notInstrumentedReason
                            ? ` — ${rail.notInstrumentedReason}`
                            : ""}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={rail.id}>
                      <td className="py-2 pr-4 font-medium text-gray-900">
                        {rail.label}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-700">
                        {formatNumber(row.attempts, 0, 0)}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-700">
                        {formatNumber(row.successes, 0, 0)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <span
                          className={
                            row.failures > 0
                              ? "font-medium text-red-600"
                              : "text-gray-400"
                          }
                        >
                          {formatNumber(row.failures, 0, 0)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-700">
                        {formatUsd(row.volumeUsd)}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-700">
                        {formatNumber(row.uniqueUsers, 0, 0)}
                      </td>
                      <td className="py-2 text-right text-gray-700">
                        {row.medianSecondsToCredit === null
                          ? "—"
                          : humanDuration(row.medianSecondsToCredit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-500">
            Bank deposits are read from the virtual-account deposit ledger in
            the backend, not from the #solid-deposit-notifications Slack
            channel. Volume is the fiat the user wired, so it excludes the
            deposit bonus and any conversion difference. A deposit that arrived
            but could not be matched to a user counts as failed here — it has
            not reached anyone, and it needs manual attribution.
          </p>
        </div>
      </Panel>

      <Panel
        title="Bank deposit volume per day"
        question="Is the bank rail growing?"
        source="rain"
        updatedAt={data?.generatedAt}
        isLoading={isLoading}
        error={error}
      >
        {data && data.byDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data.byDay}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
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
                formatter={(value: number, _name, item) => [
                  `${formatUsd(value)} · ${item?.payload?.successes ?? 0} deposits`,
                  "Credited",
                ]}
              />
              <Bar dataKey="volumeUsd" fill="#0d9488" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">
            No bank deposits credited in this period.
          </div>
        )}
      </Panel>

      <Panel
        title="Why deposits failed"
        question="What is actually going wrong, and how often?"
        source="rain"
        updatedAt={data?.generatedAt}
        isLoading={isLoading}
        error={error}
      >
        {data && data.failures.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-4">Rail</th>
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2 pr-4 text-right">Count</th>
                  <th className="py-2 text-right">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.failures.map((failure, index) => (
                  <tr key={`${failure.rail}-${failure.reason}-${index}`}>
                    <td className="py-2 pr-4 text-gray-700">
                      {DEPOSIT_RAILS.find((rail) => rail.id === failure.rail)
                        ?.label ?? failure.rail}
                    </td>
                    <td className="py-2 pr-4 text-gray-900">
                      {failure.reason}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700">
                      {formatNumber(failure.count, 0, 0)}
                    </td>
                    <td className="py-2 text-right text-gray-500">
                      {failure.lastSeen ? formatDateTime(failure.lastSeen) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            No deposit failures recorded in this period.
          </div>
        )}
      </Panel>

      <NotInstrumented
        metric="Internal transfers from Savings"
        reason="Transfers from a Savings position into the spending balance are not recorded as a deposit rail, so they are missing from the counts above."
        phase={2}
      />
    </div>
  );
}

/** Seconds as the coarsest unit that still reads precisely. */
function humanDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export default FunnelRailsView;
