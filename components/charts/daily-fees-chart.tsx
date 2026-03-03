"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  TooltipProps,
} from "recharts";
import { DailyYieldMetrics, YIELD_CHART_COLORS } from "@/types/yield-metrics";

interface DailyFeesChartProps {
  data: DailyYieldMetrics[];
  height?: number;
}

const formatYAxis = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const dailyFees = payload.find((p) => p.dataKey === "dailyFees")?.value as number || 0;
  const protocolRevenue = payload.find((p) => p.dataKey === "dailyProtocolRevenue")?.value as number || 0;
  const supplySideRevenue = payload.find((p) => p.dataKey === "dailySupplySideRevenue")?.value as number || 0;

  // Calculate split percentages
  const protocolPct = dailyFees > 0 ? (protocolRevenue / dailyFees) * 100 : 0;
  const stakersPct = dailyFees > 0 ? (supplySideRevenue / dailyFees) * 100 : 0;

  // Determine if split is healthy (protocol should get ~10%)
  const splitHealth = protocolPct >= 8 && protocolPct <= 12
    ? { label: "On Target", color: "text-emerald-600", icon: "✓" }
    : protocolPct < 8
    ? { label: "Below Target", color: "text-amber-600", icon: "↓" }
    : { label: "Above Target", color: "text-amber-600", icon: "↑" };

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 max-w-xs">
      {/* Header with business context */}
      <div className="border-b border-gray-100 pb-2 mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>📅</span> {formatDate(label as string)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          How fees flow: Daily Fees are split between Protocol (treasury) and Stakers (vault holders).
        </p>
      </div>

      {/* Fee breakdown */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: YIELD_CHART_COLORS.dailyFees }}
            />
            <span className="text-gray-600">Daily Fees</span>
          </span>
          <span className="font-semibold text-gray-900">
            ${dailyFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: YIELD_CHART_COLORS.protocolRevenue }}
            />
            <span className="text-gray-600">Protocol Revenue</span>
          </span>
          <span className="font-medium text-purple-600">
            ${protocolRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-gray-400 ml-1">({protocolPct.toFixed(0)}%)</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: YIELD_CHART_COLORS.supplySideRevenue }}
            />
            <span className="text-gray-600">Stakers Revenue</span>
          </span>
          <span className="font-medium text-emerald-600">
            ${supplySideRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-gray-400 ml-1">({stakersPct.toFixed(0)}%)</span>
          </span>
        </div>
      </div>

      {/* Split interpretation */}
      <div className="border-t border-gray-100 pt-2">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Split Status</span>
          <span className={`font-medium ${splitHealth.color}`}>
            {splitHealth.icon} {splitHealth.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Protocol takes {protocolPct.toFixed(0)}% of daily fees (target: ~10%)
        </p>
      </div>
    </div>
  );
}

export function DailyFeesChart({ data, height = 300 }: DailyFeesChartProps) {
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        date: item.date,
        dailyFees: item.dailyFees,
        dailyProtocolRevenue: item.dailyProtocolRevenue,
        dailySupplySideRevenue: item.dailySupplySideRevenue,
      })),
    [data]
  );

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No fee data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorDailyFees" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={YIELD_CHART_COLORS.dailyFees} stopOpacity={0.3} />
            <stop offset="95%" stopColor={YIELD_CHART_COLORS.dailyFees} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorProtocol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={YIELD_CHART_COLORS.protocolRevenue} stopOpacity={0.3} />
            <stop offset="95%" stopColor={YIELD_CHART_COLORS.protocolRevenue} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorSupplySide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={YIELD_CHART_COLORS.supplySideRevenue} stopOpacity={0.3} />
            <stop offset="95%" stopColor={YIELD_CHART_COLORS.supplySideRevenue} stopOpacity={0} />
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
          tickFormatter={formatYAxis}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#6b7280" }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: "10px" }}
          formatter={(value) => (
            <span className="text-sm text-gray-600">
              {value === "dailyFees"
                ? "Daily Fees"
                : value === "dailyProtocolRevenue"
                ? "Protocol"
                : "Stakers"}
            </span>
          )}
        />
        <Area
          type="monotone"
          dataKey="dailyFees"
          stroke={YIELD_CHART_COLORS.dailyFees}
          strokeWidth={2}
          fill="url(#colorDailyFees)"
          name="dailyFees"
        />
        <Area
          type="monotone"
          dataKey="dailyProtocolRevenue"
          stroke={YIELD_CHART_COLORS.protocolRevenue}
          strokeWidth={2}
          fill="url(#colorProtocol)"
          name="dailyProtocolRevenue"
        />
        <Area
          type="monotone"
          dataKey="dailySupplySideRevenue"
          stroke={YIELD_CHART_COLORS.supplySideRevenue}
          strokeWidth={2}
          fill="url(#colorSupplySide)"
          name="dailySupplySideRevenue"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default DailyFeesChart;
