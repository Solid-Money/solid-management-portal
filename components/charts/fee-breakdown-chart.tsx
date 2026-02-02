"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  TooltipProps,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { FeeBreakdownData, YIELD_CHART_COLORS } from "@/types/yield-metrics";

interface FeeBreakdownChartProps {
  data: FeeBreakdownData[];
  totals?: {
    totalPerformanceFee: number;
    totalPlatformFee: number;
    total: number;
  };
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

  const performanceFee = payload.find((p) => p.dataKey === "performanceFee")?.value as number || 0;
  const platformFee = payload.find((p) => p.dataKey === "platformFee")?.value as number || 0;
  const total = performanceFee + platformFee;

  // Calculate contribution percentages
  const perfPct = total > 0 ? (performanceFee / total) * 100 : 0;
  const platPct = total > 0 ? (platformFee / total) * 100 : 0;

  // Determine dominant fee type
  const dominant = performanceFee >= platformFee
    ? { name: "Performance Fee", pct: perfPct }
    : { name: "Platform Fee", pct: platPct };

  // Fee health indicator - performance fees should typically dominate
  const feeHealth = perfPct >= 60
    ? { label: "Healthy", color: "text-emerald-600", icon: "🟢" }
    : perfPct >= 40
    ? { label: "Balanced", color: "text-amber-600", icon: "🟡" }
    : { label: "Low Performance", color: "text-red-600", icon: "🔴" };

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 max-w-xs">
      {/* Header with business context */}
      <div className="border-b border-gray-100 pb-2 mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>📅</span> {formatDate(label as string)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Protocol fee sources: Performance Fee (10% of profits) and Platform Fee (1% annual on TVL).
        </p>
      </div>

      {/* Fee breakdown */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: YIELD_CHART_COLORS.performanceFee }}
            />
            <span className="text-gray-600">Performance Fee (10%)</span>
          </span>
          <span className="font-medium text-amber-600">
            ${performanceFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-gray-400 ml-1">({perfPct.toFixed(0)}%)</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: YIELD_CHART_COLORS.platformFee }}
            />
            <span className="text-gray-600">Platform Fee (1%/yr)</span>
          </span>
          <span className="font-medium text-blue-600">
            ${platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-gray-400 ml-1">({platPct.toFixed(0)}%)</span>
          </span>
        </div>
      </div>

      {/* Total and insights */}
      <div className="border-t border-gray-100 pt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600 font-medium">Total Protocol Fee</span>
          <span className="font-semibold text-gray-900">
            ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Dominant</span>
          <span className="font-medium text-indigo-600">
            {dominant.name} ({dominant.pct.toFixed(0)}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Fee Mix</span>
          <span className={`font-medium ${feeHealth.color}`}>
            {feeHealth.label} {feeHealth.icon}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FeeBreakdownChart({ data, totals, height = 350 }: FeeBreakdownChartProps) {
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        date: item.date,
        performanceFee: item.performanceFee,
        platformFee: item.platformFee,
      })),
    [data]
  );

  const pieData = useMemo(() => {
    if (!totals) return [];
    return [
      { name: "Performance Fee", value: totals.totalPerformanceFee, color: YIELD_CHART_COLORS.performanceFee },
      { name: "Platform Fee", value: totals.totalPlatformFee, color: YIELD_CHART_COLORS.platformFee },
    ];
  }, [totals]);

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No fee breakdown data available
      </div>
    );
  }

  return (
    <div className="flex gap-4" style={{ height }}>
      {/* Bar Chart - 70% width */}
      <div className="flex-[7]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  {value === "performanceFee" ? "Performance (10%)" : "Platform (1%/yr)"}
                </span>
              )}
            />
            <Bar
              dataKey="platformFee"
              stackId="fees"
              fill={YIELD_CHART_COLORS.platformFee}
              name="platformFee"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="performanceFee"
              stackId="fees"
              fill={YIELD_CHART_COLORS.performanceFee}
              name="performanceFee"
              radius={[4, 4, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart - 30% width */}
      {totals && totals.total > 0 && (
        <div className="flex-[3] flex flex-col items-center justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) =>
                  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center mt-2">
            <p className="text-xs text-gray-500">Total Protocol Fees</p>
            <p className="text-lg font-semibold text-gray-900">
              ${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeeBreakdownChart;
