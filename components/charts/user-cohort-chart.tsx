"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  TooltipProps,
  Legend,
} from "recharts";
import {
  CohortData,
  CohortRetentionRow,
  UserCohortResponse,
  ANALYTICS_CHART_COLORS,
} from "@/types/analytics-charts";

interface UserCohortChartProps {
  data: UserCohortResponse;
  height?: number;
}

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
};

interface CustomTooltipProps extends TooltipProps<number, string> {
  avgRetentionRate: number;
  avgLifetimeDeposits: number;
}

function getRetentionQuality(rate: number): {
  label: string;
  color: string;
  icon: string;
} {
  if (rate >= 0.8) {
    return { label: "Excellent", color: "text-emerald-600", icon: "🟢" };
  }
  if (rate >= 0.6) {
    return { label: "Good", color: "text-teal-600", icon: "🟢" };
  }
  if (rate >= 0.4) {
    return { label: "Average", color: "text-amber-600", icon: "🟡" };
  }
  return { label: "Below Average", color: "text-red-600", icon: "🔴" };
}

function getCohortQuality(
  retentionRate: number,
  avgRetention: number,
  depositsPerUser: number,
  avgDeposits: number
): string {
  const aboveAvgRetention = retentionRate > avgRetention;
  const aboveAvgDeposits = depositsPerUser > avgDeposits;

  if (aboveAvgRetention && aboveAvgDeposits) {
    return "High engagement — above average deposits and retention";
  }
  if (aboveAvgRetention) {
    return "Strong retention — users stay engaged";
  }
  if (aboveAvgDeposits) {
    return "High value — above average deposits";
  }
  return "Standard engagement";
}

function CustomTooltip({
  active,
  payload,
  label,
  avgRetentionRate,
  avgLifetimeDeposits,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const cohort = payload[0]?.payload as CohortData;
  const retentionQuality = getRetentionQuality(cohort.retentionRate);
  const avgValuePerUser = cohort.userCount > 0 ? cohort.totalDepositAmount / cohort.userCount : 0;
  const depositsPerUser = cohort.userCount > 0 ? cohort.totalDeposits / cohort.userCount : 0;
  const cohortQuality = getCohortQuality(
    cohort.retentionRate,
    avgRetentionRate,
    depositsPerUser,
    avgLifetimeDeposits
  );

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 max-w-xs">
      {/* Header */}
      <div className="border-b border-gray-100 pb-2 mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>👥</span> Cohort: {formatMonth(label as string)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Users who signed up this month. Tracking retention shows product stickiness and helps identify when users typically churn.
        </p>
      </div>

      {/* User metrics */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Total Users</span>
          <span className="font-medium text-indigo-600">
            {cohort.userCount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Still Active (30d)</span>
          <span className="font-medium text-emerald-600">
            {cohort.activeUsers.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Retention Rate</span>
          <span className={`font-medium ${retentionQuality.color}`}>
            {(cohort.retentionRate * 100).toFixed(1)}% {retentionQuality.icon}
          </span>
        </div>
      </div>

      {/* Deposit metrics */}
      <div className="space-y-1.5 mb-3 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Total Deposits</span>
          <span className="font-medium text-violet-600">
            {cohort.totalDeposits.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Total Value</span>
          <span className="font-medium text-blue-600">
            ${cohort.totalDepositAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Avg per User</span>
          <span className="font-medium text-gray-700">
            ${avgValuePerUser.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Deposits per User</span>
          <span className="font-medium text-gray-700">
            {depositsPerUser.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Cohort quality assessment */}
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs text-gray-600 font-medium">Cohort Quality:</p>
        <p className="text-xs text-gray-500 mt-0.5">
          └─ {cohortQuality}
        </p>
      </div>
    </div>
  );
}

function CohortSummary({
  summary,
}: {
  summary: UserCohortResponse["summary"];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div className="text-center p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">Total Users</p>
        <p className="text-sm font-semibold text-gray-900">
          {summary.totalUsers.toLocaleString()}
        </p>
      </div>
      <div className="text-center p-3 bg-teal-50 rounded-lg">
        <p className="text-xs text-teal-600">Avg Retention</p>
        <p className="text-sm font-semibold text-teal-700">
          {(summary.avgRetentionRate * 100).toFixed(1)}%
        </p>
      </div>
      <div className="text-center p-3 bg-indigo-50 rounded-lg">
        <p className="text-xs text-indigo-600">Best Cohort</p>
        <p className="text-sm font-semibold text-indigo-700">
          {formatMonth(summary.bestCohort)}
        </p>
      </div>
      <div className="text-center p-3 bg-violet-50 rounded-lg">
        <p className="text-xs text-violet-600">Avg Deposits/User</p>
        <p className="text-sm font-semibold text-violet-700">
          {summary.avgLifetimeDeposits.toFixed(1)}
        </p>
      </div>
    </div>
  );
}

function RetentionHeatmap({
  retentionMatrix,
}: {
  retentionMatrix: CohortRetentionRow[];
}) {
  if (!retentionMatrix || retentionMatrix.length === 0) {
    return null;
  }

  // Get all month offsets that have data
  const allMonths = new Set<number>();
  retentionMatrix.forEach((row) => {
    Object.keys(row.retentionByMonth).forEach((m) => allMonths.add(parseInt(m)));
  });
  const monthOffsets = Array.from(allMonths).sort((a, b) => a - b).slice(0, 12);

  const getRetentionColor = (rate: number) => {
    if (rate >= 0.5) return "bg-teal-500 text-white";
    if (rate >= 0.3) return "bg-teal-400 text-white";
    if (rate >= 0.2) return "bg-teal-300 text-gray-800";
    if (rate >= 0.1) return "bg-teal-200 text-gray-800";
    if (rate > 0) return "bg-teal-100 text-gray-600";
    return "bg-gray-50 text-gray-400";
  };

  return (
    <div className="mt-6">
      <h4 className="text-sm font-medium text-gray-700 mb-3">
        Retention Matrix (by Month)
      </h4>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-gray-500">Cohort</th>
              <th className="px-2 py-1 text-center text-gray-500">M0</th>
              {monthOffsets.map((m) => (
                <th key={m} className="px-2 py-1 text-center text-gray-500">
                  M{m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {retentionMatrix.slice(-12).map((row) => (
              <tr key={row.cohort}>
                <td className="px-2 py-1 font-medium text-gray-700">
                  {formatMonth(row.cohort)}
                </td>
                <td className="px-2 py-1">
                  <div className="w-10 h-6 flex items-center justify-center rounded bg-indigo-100 text-indigo-700 font-medium">
                    {row.month0}
                  </div>
                </td>
                {monthOffsets.map((m) => {
                  const rate = row.retentionByMonth[m];
                  return (
                    <td key={m} className="px-1 py-1">
                      {rate !== undefined ? (
                        <div
                          className={`w-10 h-6 flex items-center justify-center rounded ${getRetentionColor(
                            rate
                          )}`}
                        >
                          {(rate * 100).toFixed(0)}%
                        </div>
                      ) : (
                        <div className="w-10 h-6 bg-gray-50"></div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UserCohortChart({
  data,
  height = 300,
}: UserCohortChartProps) {
  const chartData = useMemo(
    () => data.cohorts.slice(-12), // Show last 12 cohorts
    [data.cohorts]
  );

  if (!data.cohorts || data.cohorts.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No cohort data available
      </div>
    );
  }

  return (
    <div>
      <CohortSummary summary={data.summary} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="cohort"
            tickFormatter={formatMonth}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            domain={[0, 1]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <Tooltip
            content={
              <CustomTooltip
                avgRetentionRate={data.summary.avgRetentionRate}
                avgLifetimeDeposits={data.summary.avgLifetimeDeposits}
              />
            }
          />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="userCount"
            name="Users"
            fill={ANALYTICS_CHART_COLORS.cohortPrimary}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Bar
            yAxisId="left"
            dataKey="activeUsers"
            name="Active (30d)"
            fill={ANALYTICS_CHART_COLORS.retention}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
      <RetentionHeatmap retentionMatrix={data.retentionMatrix} />
    </div>
  );
}

export default UserCohortChart;
