"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
  TooltipProps,
} from "recharts";
import { DailyYieldMetrics, YIELD_CHART_COLORS } from "@/types/yield-metrics";

interface RevenueSplitChartProps {
  data: DailyYieldMetrics[];
  height?: number;
}

const formatYAxis = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatPercent = (value: number) => `${value.toFixed(0)}%`;

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Target protocol share is 10%
const TARGET_PROTOCOL_SHARE = 10;

function getTargetStatus(protocolShare: number): {
  label: string;
  color: string;
  icon: string;
} {
  const variance = protocolShare - TARGET_PROTOCOL_SHARE;
  const absVariance = Math.abs(variance);

  if (absVariance <= 1) {
    return { label: "On Target", color: "text-emerald-600", icon: "✓" };
  }
  if (variance > 0) {
    return { label: "Above Target", color: "text-amber-600", icon: "↑" };
  }
  return { label: "Below Target", color: "text-red-600", icon: "↓" };
}

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const protocolRevenue = payload.find((p) => p.dataKey === "dailyProtocolRevenue")?.value as number || 0;
  const supplySideRevenue = payload.find((p) => p.dataKey === "dailySupplySideRevenue")?.value as number || 0;
  const protocolShare = payload.find((p) => p.dataKey === "protocolShare")?.value as number || 0;

  const totalRevenue = protocolRevenue + supplySideRevenue;
  const variance = protocolShare - TARGET_PROTOCOL_SHARE;
  const targetStatus = getTargetStatus(protocolShare);

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 max-w-xs">
      {/* Header with business context */}
      <div className="border-b border-gray-100 pb-2 mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>📅</span> {formatDate(label as string)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Revenue split between protocol treasury and vault stakers. Target: 10% to protocol.
        </p>
      </div>

      {/* Revenue breakdown */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: YIELD_CHART_COLORS.protocolRevenue }}
            />
            <span className="text-gray-600">Protocol Revenue</span>
          </span>
          <span className="font-medium text-purple-600">
            ${protocolRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: YIELD_CHART_COLORS.supplySideRevenue }}
            />
            <span className="text-gray-600">Stakers Revenue</span>
          </span>
          <span className="font-medium text-emerald-600">
            ${supplySideRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Total Yield</span>
          <span className="font-semibold text-gray-900">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Target comparison */}
      <div className="border-t border-gray-100 pt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-0.5"
              style={{ backgroundColor: YIELD_CHART_COLORS.yieldRate }}
            />
            <span className="text-gray-600">Protocol Share</span>
          </span>
          <span className={`font-medium ${targetStatus.color}`}>
            {protocolShare.toFixed(1)}% {targetStatus.icon}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">vs {TARGET_PROTOCOL_SHARE}% Target</span>
          <span className={`font-medium ${variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {variance >= 0 ? "+" : ""}{variance.toFixed(1)}% variance
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Status: {targetStatus.label}
        </p>
      </div>
    </div>
  );
}

export function RevenueSplitChart({ data, height = 350 }: RevenueSplitChartProps) {
  const chartData = useMemo(
    () =>
      data.map((item) => {
        const totalYield = item.dailyProtocolRevenue + item.dailySupplySideRevenue;
        const protocolShare = totalYield > 0
          ? (item.dailyProtocolRevenue / totalYield) * 100
          : 0;

        return {
          date: item.date,
          dailyProtocolRevenue: item.dailyProtocolRevenue,
          dailySupplySideRevenue: item.dailySupplySideRevenue,
          protocolShare,
        };
      }),
    [data]
  );

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No revenue split data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
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
          tickFormatter={formatYAxis}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#6b7280" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={formatPercent}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          domain={[0, 20]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: "10px" }}
          formatter={(value) => (
            <span className="text-sm text-gray-600">
              {value === "dailyProtocolRevenue"
                ? "Protocol"
                : value === "dailySupplySideRevenue"
                ? "Stakers"
                : "Protocol %"}
            </span>
          )}
        />
        <ReferenceLine
          yAxisId="right"
          y={10}
          stroke="#9CA3AF"
          strokeDasharray="3 3"
          label={{
            value: "10% Target",
            position: "right",
            fill: "#9CA3AF",
            fontSize: 10,
          }}
        />
        <Bar
          yAxisId="left"
          dataKey="dailySupplySideRevenue"
          stackId="revenue"
          fill={YIELD_CHART_COLORS.supplySideRevenue}
          name="dailySupplySideRevenue"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          yAxisId="left"
          dataKey="dailyProtocolRevenue"
          stackId="revenue"
          fill={YIELD_CHART_COLORS.protocolRevenue}
          name="dailyProtocolRevenue"
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="protocolShare"
          stroke={YIELD_CHART_COLORS.yieldRate}
          strokeWidth={2}
          dot={{ fill: YIELD_CHART_COLORS.yieldRate, strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5 }}
          name="protocolShare"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default RevenueSplitChart;
