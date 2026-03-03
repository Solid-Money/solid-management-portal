"use client";

import { useMemo, useCallback } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  TooltipProps,
} from "recharts";
import { DailyFlowData, DAILY_FLOW_COLORS } from "@/types/revenue";

interface DailyFlowChartProps {
  data: DailyFlowData[];
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

  const deposits =
    (payload.find((p) => p.dataKey === "deposits")?.value as number) || 0;
  const withdrawalsNegative =
    (payload.find((p) => p.dataKey === "withdrawalsNegative")?.value as number) || 0;
  const withdrawals = Math.abs(withdrawalsNegative);
  const netFlow =
    (payload.find((p) => p.dataKey === "netFlow")?.value as number) || 0;

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-3">
      <p className="text-sm font-medium text-gray-900 mb-2">
        {formatDate(label as string)}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: DAILY_FLOW_COLORS.deposits }}
            />
            <span className="text-gray-600">Deposits</span>
          </span>
          <span className="font-medium text-emerald-600">
            +$
            {deposits.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: DAILY_FLOW_COLORS.withdrawals }}
            />
            <span className="text-gray-600">Withdrawals</span>
          </span>
          <span className="font-medium text-red-600">
            -$
            {withdrawals.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="border-t border-gray-200 pt-1 mt-1">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span
                className="w-3 h-0.5"
                style={{ backgroundColor: DAILY_FLOW_COLORS.netFlow }}
              />
              <span className="text-gray-600">Net Flow</span>
            </span>
            <span
              className={`font-semibold ${
                netFlow >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {netFlow >= 0 ? "+" : ""}$
              {netFlow.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DailyFlowChart({ data, height = 300 }: DailyFlowChartProps) {
  // Transform data for stacked bars (withdrawals as negative for visual effect)
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        // Keep withdrawals positive for the chart but stack them below zero line
        withdrawalsNegative: -item.withdrawals,
      })),
    [data]
  );

  const legendFormatter = useCallback((value: string) => {
    const labels: Record<string, string> = {
      deposits: "Deposits",
      withdrawalsNegative: "Withdrawals",
      netFlow: "Net Flow",
    };
    return (
      <span className="text-sm text-gray-600">{labels[value] || value}</span>
    );
  }, []);

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No flow data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
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
        <Legend wrapperStyle={{ paddingTop: "10px" }} formatter={legendFormatter} />
        <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} />
        <Bar
          dataKey="deposits"
          fill={DAILY_FLOW_COLORS.deposits}
          name="deposits"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="withdrawalsNegative"
          fill={DAILY_FLOW_COLORS.withdrawals}
          name="withdrawalsNegative"
          radius={[0, 0, 4, 4]}
        />
        <Line
          type="monotone"
          dataKey="netFlow"
          stroke={DAILY_FLOW_COLORS.netFlow}
          strokeWidth={2}
          dot={{ fill: DAILY_FLOW_COLORS.netFlow, strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5 }}
          name="netFlow"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default DailyFlowChart;
