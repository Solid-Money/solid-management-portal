"use client";

import { useMemo } from "react";
import {
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  TooltipProps,
  Legend,
  ComposedChart,
} from "recharts";
import {
  DailyBridgeActivity,
  BridgeActivityResponse,
  ANALYTICS_CHART_COLORS,
} from "@/types/analytics-charts";

interface BridgeActivityChartProps {
  data: BridgeActivityResponse;
  height?: number;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0]?.payload as DailyBridgeActivity;
  const avgPerUser = item.uniqueUsers > 0 ? item.totalValueUsd / item.uniqueUsers : 0;
  const bridgesPerUser = item.uniqueUsers > 0 ? item.count / item.uniqueUsers : 0;
  const avgTransaction = item.count > 0 ? item.totalValueUsd / item.count : 0;

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 max-w-xs">
      {/* Header */}
      <div className="border-b border-gray-100 pb-2 mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>📅</span> {formatDate(label as string)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Cross-chain transfers moving assets between blockchains. High activity indicates strong multi-chain adoption.
        </p>
      </div>

      {/* Primary metrics */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Bridge Events</span>
          <span className="font-medium text-emerald-600">
            {item.count.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Volume</span>
          <span className="font-medium text-blue-600">
            ${item.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Unique Users</span>
          <span className="font-medium text-violet-600">
            {item.uniqueUsers.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Derived insights */}
      <div className="border-t border-gray-100 pt-2 space-y-1">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Avg per User</span>
          <span className="font-medium text-gray-700">
            ${avgPerUser.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({bridgesPerUser.toFixed(1)} bridges)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Avg Transaction</span>
          <span className="font-medium text-gray-700">
            ${avgTransaction.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    </div>
  );
}

function BridgeSummary({
  summary,
}: {
  summary: BridgeActivityResponse["summary"];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      <div className="text-center p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">Total Events</p>
        <p className="text-sm font-semibold text-gray-900">
          {summary.totalEvents.toLocaleString()}
        </p>
      </div>
      <div className="text-center p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-600">Total Volume</p>
        <p className="text-sm font-semibold text-blue-700">
          ${summary.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>
      <div className="text-center p-3 bg-emerald-50 rounded-lg">
        <p className="text-xs text-emerald-600">Unique Users</p>
        <p className="text-sm font-semibold text-emerald-700">
          {summary.uniqueUsers.toLocaleString()}
        </p>
      </div>
      <div className="text-center p-3 bg-violet-50 rounded-lg">
        <p className="text-xs text-violet-600">Avg Daily</p>
        <p className="text-sm font-semibold text-violet-700">
          {summary.avgDailyCount.toFixed(1)}
        </p>
      </div>
      <div className="text-center p-3 bg-amber-50 rounded-lg">
        <p className="text-xs text-amber-600">Avg per User</p>
        <p className="text-sm font-semibold text-amber-700">
          ${(summary.totalValueUsd / Math.max(1, summary.uniqueUsers)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>
    </div>
  );
}

export function BridgeActivityChart({
  data,
  height = 300,
}: BridgeActivityChartProps) {
  const chartData = useMemo(() => data.dailyActivity, [data.dailyActivity]);

  if (!data.dailyActivity || data.dailyActivity.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No bridge activity data available
      </div>
    );
  }

  return (
    <div>
      <BridgeSummary summary={data.summary} />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorBridgeVolume" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={ANALYTICS_CHART_COLORS.bridgeVolume}
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor={ANALYTICS_CHART_COLORS.bridgeVolume}
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
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
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="totalValueUsd"
            name="Volume (USD)"
            stroke={ANALYTICS_CHART_COLORS.bridgeVolume}
            strokeWidth={2}
            fill="url(#colorBridgeVolume)"
          />
          <Bar
            yAxisId="left"
            dataKey="count"
            name="Bridge Events"
            fill={ANALYTICS_CHART_COLORS.bridgeCount}
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BridgeActivityChart;
