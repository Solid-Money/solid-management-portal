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
  Cell,
} from "recharts";
import {
  LatencyBucket,
  WithdrawalLatencyResponse,
  ANALYTICS_CHART_COLORS,
  formatLatency,
} from "@/types/analytics-charts";

interface WithdrawalLatencyChartProps {
  data: WithdrawalLatencyResponse;
  height?: number;
}

interface CustomTooltipProps extends TooltipProps<number, string> {
  totalWithdrawals: number;
}

function getLatencyPerformance(maxSeconds: number): {
  label: string;
  color: string;
  icon: string;
} {
  if (maxSeconds <= 60) {
    return { label: "Excellent (<1 min)", color: "text-emerald-600", icon: "✓" };
  }
  if (maxSeconds <= 300) {
    return { label: "Good (<5 min)", color: "text-emerald-600", icon: "✓" };
  }
  if (maxSeconds <= 3600) {
    return { label: "Within target (<1 hour)", color: "text-teal-600", icon: "✓" };
  }
  if (maxSeconds <= 86400) {
    return { label: "Slow (>1 hour)", color: "text-amber-600", icon: "⚠" };
  }
  return { label: "Needs attention (>1 day)", color: "text-red-600", icon: "✗" };
}

function CustomTooltip({
  active,
  payload,
  totalWithdrawals,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const bucket = payload[0]?.payload as LatencyBucket;
  const avgTransaction = bucket.count > 0 ? bucket.totalAmount / bucket.count : 0;
  const shareOfTotal = totalWithdrawals > 0 ? (bucket.count / totalWithdrawals) * 100 : 0;
  const performance = getLatencyPerformance(bucket.maxSeconds);

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 max-w-xs">
      {/* Header */}
      <div className="border-b border-gray-100 pb-2 mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>⏱</span> Latency: {bucket.range}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Time from withdrawal request to settlement. Lower is better for user experience.
        </p>
      </div>

      {/* Primary metrics */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Withdrawals</span>
          <span className="font-medium text-indigo-600">
            {bucket.count.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Total Value</span>
          <span className="font-medium text-emerald-600">
            ${bucket.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Avg Transaction</span>
          <span className="font-medium text-blue-600">
            ${avgTransaction.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Performance insights */}
      <div className="border-t border-gray-100 pt-2 space-y-1">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Performance</span>
          <span className={`font-medium ${performance.color}`}>
            {performance.icon} {performance.label}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Share of Total</span>
          <span className="font-medium text-gray-700">
            {shareOfTotal.toFixed(1)}% of all withdrawals
          </span>
        </div>
      </div>
    </div>
  );
}

function LatencySummary({
  summary,
}: {
  summary: WithdrawalLatencyResponse["summary"];
}) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
      <div className="text-center p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">Total</p>
        <p className="text-sm font-semibold text-gray-900">
          {summary.totalWithdrawals.toLocaleString()}
        </p>
      </div>
      <div className="text-center p-3 bg-indigo-50 rounded-lg">
        <p className="text-xs text-indigo-600">Average</p>
        <p className="text-sm font-semibold text-indigo-700">
          {formatLatency(summary.avgLatencySeconds)}
        </p>
      </div>
      <div className="text-center p-3 bg-violet-50 rounded-lg">
        <p className="text-xs text-violet-600">Median</p>
        <p className="text-sm font-semibold text-violet-700">
          {formatLatency(summary.medianLatencySeconds)}
        </p>
      </div>
      <div className="text-center p-3 bg-amber-50 rounded-lg">
        <p className="text-xs text-amber-600">P95</p>
        <p className="text-sm font-semibold text-amber-700">
          {formatLatency(summary.p95LatencySeconds)}
        </p>
      </div>
      <div className="text-center p-3 bg-emerald-50 rounded-lg">
        <p className="text-xs text-emerald-600">Min</p>
        <p className="text-sm font-semibold text-emerald-700">
          {formatLatency(summary.minLatencySeconds)}
        </p>
      </div>
      <div className="text-center p-3 bg-red-50 rounded-lg">
        <p className="text-xs text-red-600">Max</p>
        <p className="text-sm font-semibold text-red-700">
          {formatLatency(summary.maxLatencySeconds)}
        </p>
      </div>
    </div>
  );
}

export function WithdrawalLatencyChart({
  data,
  height = 300,
}: WithdrawalLatencyChartProps) {
  const chartData = useMemo(() => data.distribution, [data.distribution]);

  if (!data.distribution || data.distribution.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No withdrawal latency data available
      </div>
    );
  }

  const maxCount = Math.max(...chartData.map((d) => d.count));

  return (
    <div>
      <LatencySummary summary={data.summary} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="range"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <Tooltip
            content={
              <CustomTooltip totalWithdrawals={data.summary.totalWithdrawals} />
            }
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.count === maxCount
                    ? ANALYTICS_CHART_COLORS.latencyLine
                    : ANALYTICS_CHART_COLORS.latencyBar
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default WithdrawalLatencyChart;
