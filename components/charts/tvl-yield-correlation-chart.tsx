"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  TooltipProps,
} from "recharts";
import { TvlYieldCorrelationData, YIELD_CHART_COLORS } from "@/types/yield-metrics";

interface TvlYieldCorrelationChartProps {
  data: TvlYieldCorrelationData[];
  correlation?: number;
  height?: number;
}

const formatTvlAxis = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatYieldAxis = (value: number) => `${value.toFixed(1)}%`;

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Helper to determine yield efficiency quality
function getYieldEfficiencyQuality(efficiencyPer1k: number): {
  label: string;
  color: string;
  icon: string;
} {
  // Efficiency is daily yield per $1,000 TVL
  // Higher efficiency means capital is working harder
  if (efficiencyPer1k >= 0.30) {
    return { label: "High Efficiency", color: "text-emerald-600", icon: "🟢" };
  }
  if (efficiencyPer1k >= 0.15) {
    return { label: "Good Efficiency", color: "text-teal-600", icon: "🟢" };
  }
  if (efficiencyPer1k >= 0.05) {
    return { label: "Average Efficiency", color: "text-amber-600", icon: "🟡" };
  }
  return { label: "Low Efficiency", color: "text-red-600", icon: "🔴" };
}

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const tvl = payload.find((p) => p.dataKey === "tvl")?.value as number || 0;
  const yieldRate = payload.find((p) => p.dataKey === "yieldRate")?.value as number || 0;
  const dailyYield = payload.find((p) => p.dataKey === "dailyYield")?.value as number || 0;

  // Calculate yield efficiency - daily yield per $1,000 TVL
  const yieldEfficiencyPer1k = tvl > 0 ? (dailyYield / tvl) * 1000 : 0;
  const efficiencyQuality = getYieldEfficiencyQuality(yieldEfficiencyPer1k);

  // Format TVL in millions for readability
  const tvlInMillions = tvl / 1_000_000;

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 max-w-xs">
      {/* Header with business context */}
      <div className="border-b border-gray-100 pb-2 mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>📅</span> {formatDate(label as string)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          TVL vs APY correlation shows how efficiently capital generates yield. Higher TVL should maintain or improve APY for healthy growth.
        </p>
      </div>

      {/* Core metrics */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: YIELD_CHART_COLORS.tvl }}
            />
            <span className="text-gray-600">TVL</span>
          </span>
          <span className="font-medium text-blue-600">
            ${tvlInMillions >= 1
              ? `${tvlInMillions.toFixed(2)}M`
              : tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-0.5"
              style={{ backgroundColor: YIELD_CHART_COLORS.yieldRate }}
            />
            <span className="text-gray-600">APY Rate</span>
          </span>
          <span className="font-medium text-pink-600">
            {yieldRate.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Daily Yield</span>
          <span className="font-medium text-gray-900">
            ${dailyYield.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Yield efficiency insight */}
      <div className="border-t border-gray-100 pt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Yield Efficiency</span>
          <span className="font-medium text-indigo-600">
            ${yieldEfficiencyPer1k.toFixed(2)} per $1K TVL/day
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Capital Efficiency</span>
          <span className={`font-medium ${efficiencyQuality.color}`}>
            {efficiencyQuality.label} {efficiencyQuality.icon}
          </span>
        </div>
      </div>
    </div>
  );
}

function CorrelationBadge({ correlation }: { correlation: number }) {
  const getCorrelationColor = () => {
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.7) return "bg-emerald-100 text-emerald-800";
    if (absCorr >= 0.4) return "bg-amber-100 text-amber-800";
    return "bg-gray-100 text-gray-600";
  };

  const getCorrelationLabel = () => {
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.7) return correlation > 0 ? "Strong positive" : "Strong negative";
    if (absCorr >= 0.4) return correlation > 0 ? "Moderate positive" : "Moderate negative";
    return "Weak";
  };

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getCorrelationColor()}`}>
      <span>r = {correlation.toFixed(3)}</span>
      <span className="text-gray-400">|</span>
      <span>{getCorrelationLabel()}</span>
    </div>
  );
}

export function TvlYieldCorrelationChart({
  data,
  correlation,
  height = 300,
}: TvlYieldCorrelationChartProps) {
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        date: item.date,
        tvl: item.tvl,
        yieldRate: item.yieldRate,
        dailyYield: item.dailyYield,
      })),
    [data]
  );

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No correlation data available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {correlation !== undefined && (
        <div className="flex justify-end">
          <CorrelationBadge correlation={correlation} />
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTvl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={YIELD_CHART_COLORS.tvl} stopOpacity={0.3} />
              <stop offset="95%" stopColor={YIELD_CHART_COLORS.tvl} stopOpacity={0} />
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
            tickFormatter={formatTvlAxis}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatYieldAxis}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            domain={[0, "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: "10px" }}
            formatter={(value) => (
              <span className="text-sm text-gray-600">
                {value === "tvl" ? "TVL" : "APY Rate"}
              </span>
            )}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="tvl"
            stroke={YIELD_CHART_COLORS.tvl}
            strokeWidth={2}
            fill="url(#colorTvl)"
            name="tvl"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="yieldRate"
            stroke={YIELD_CHART_COLORS.yieldRate}
            strokeWidth={2}
            dot={{ fill: YIELD_CHART_COLORS.yieldRate, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5 }}
            name="yieldRate"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TvlYieldCorrelationChart;
