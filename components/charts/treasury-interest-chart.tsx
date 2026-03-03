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
  TooltipProps,
} from "recharts";
import { TreasuryInterestPeriodData, REVENUE_COLORS } from "@/types/revenue";

interface TreasuryInterestChartProps {
  data: TreasuryInterestPeriodData[];
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

  const interest =
    (payload.find((p) => p.dataKey === "treasuryInterest")?.value as number) ||
    0;
  const events =
    (payload.find((p) => p.dataKey === "eventCount")?.value as number) || 0;

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 max-w-xs">
      <div className="border-b border-gray-100 pb-2 mb-3">
        <p className="text-sm font-semibold text-gray-900">
          {formatDate(label as string)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Yield earned on company-owned treasury wallet holdings
        </p>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: REVENUE_COLORS.treasuryInterest }}
            />
            <span className="text-gray-600">Treasury Interest</span>
          </span>
          <span className="font-semibold text-gray-900">
            $
            {interest.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Rate Updates</span>
          <span className="font-medium text-gray-700">{events}</span>
        </div>
      </div>
    </div>
  );
}

export function TreasuryInterestChart({
  data,
  height = 300,
}: TreasuryInterestChartProps) {
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        date: item.period,
        treasuryInterest: item.treasuryInterest,
        eventCount: item.eventCount,
      })),
    [data]
  );

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No treasury interest data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient
            id="colorTreasuryInterest"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor={REVENUE_COLORS.treasuryInterest}
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor={REVENUE_COLORS.treasuryInterest}
              stopOpacity={0}
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
          tickFormatter={formatYAxis}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#6b7280" }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="treasuryInterest"
          stroke={REVENUE_COLORS.treasuryInterest}
          strokeWidth={2}
          fill="url(#colorTreasuryInterest)"
          name="Treasury Interest"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default TreasuryInterestChart;
