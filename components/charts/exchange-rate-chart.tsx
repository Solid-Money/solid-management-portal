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
import { ExchangeRateHistoryData, YIELD_CHART_COLORS } from "@/types/yield-metrics";

interface ExchangeRateChartProps {
  data: ExchangeRateHistoryData[];
  summary?: {
    startRate: string;
    endRate: string;
    totalGrowth: number;
    avgDailyGrowth: number;
  };
  height?: number;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Helper to assess rate health
function getRateHealth(rate: number): {
  label: string;
  color: string;
  icon: string;
} {
  // Rate > 1.0 means accumulated yield since launch
  if (rate >= 1.05) {
    return { label: "Strong Growth", color: "text-emerald-600", icon: "🟢" };
  }
  if (rate >= 1.01) {
    return { label: "Healthy Growth", color: "text-teal-600", icon: "🟢" };
  }
  if (rate >= 1.0) {
    return { label: "At Par", color: "text-amber-600", icon: "🟡" };
  }
  return { label: "Below Par", color: "text-red-600", icon: "🔴" };
}

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const rateNormalized = payload[0]?.value as number || 0;
  const growth = payload[0]?.payload?.growthRate as number || 0;
  const txHash = payload[0]?.payload?.transactionHash as string || "";

  // Calculate user impact - what 100 shares would be worth
  const sharesExample = 100;
  const usdcValue = sharesExample * rateNormalized;

  // Accumulated yield since launch (rate starts at 1.0)
  const accumulatedYieldPct = (rateNormalized - 1.0) * 100;

  const rateHealth = getRateHealth(rateNormalized);

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 max-w-xs">
      {/* Header with business context */}
      <div className="border-b border-gray-100 pb-2 mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>📅</span> {formatDate(label as string)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Exchange rate shows vault share value vs USDC. Rate &gt; 1.0 means accumulated yield for holders.
        </p>
      </div>

      {/* Core metrics */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Exchange Rate</span>
          <span className="font-semibold text-teal-600">
            {rateNormalized.toFixed(6)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Daily Growth</span>
          <span className={`font-medium ${growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {growth >= 0 ? "+" : ""}{growth.toFixed(4)}% {growth >= 0 ? "🟢" : "🔴"}
          </span>
        </div>
      </div>

      {/* User impact and accumulated yield */}
      <div className="border-t border-gray-100 pt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">User Impact</span>
          <span className="font-medium text-indigo-600">
            {sharesExample} shares = ${usdcValue.toFixed(2)} USDC
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Accumulated Yield</span>
          <span className={`font-medium ${accumulatedYieldPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {accumulatedYieldPct >= 0 ? "+" : ""}{accumulatedYieldPct.toFixed(2)}% since launch
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Rate Health</span>
          <span className={`font-medium ${rateHealth.color}`}>
            {rateHealth.label} {rateHealth.icon}
          </span>
        </div>
      </div>

      {/* Transaction hash */}
      {txHash && (
        <div className="border-t border-gray-100 pt-2 mt-2">
          <p className="text-xs text-gray-400 truncate">
            tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </p>
        </div>
      )}
    </div>
  );
}

function GrowthSummary({
  summary,
}: {
  summary: ExchangeRateChartProps["summary"];
}) {
  if (!summary) return null;

  const startRateNorm = parseFloat(summary.startRate) / 1_000_000;
  const endRateNorm = parseFloat(summary.endRate) / 1_000_000;

  return (
    <div className="grid grid-cols-4 gap-4 mb-4">
      <div className="text-center p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">Start Rate</p>
        <p className="text-sm font-semibold text-gray-900">
          {startRateNorm.toFixed(6)}
        </p>
      </div>
      <div className="text-center p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">End Rate</p>
        <p className="text-sm font-semibold text-gray-900">
          {endRateNorm.toFixed(6)}
        </p>
      </div>
      <div className="text-center p-3 bg-emerald-50 rounded-lg">
        <p className="text-xs text-emerald-600">Total Growth</p>
        <p className="text-sm font-semibold text-emerald-700">
          +{summary.totalGrowth.toFixed(4)}%
        </p>
      </div>
      <div className="text-center p-3 bg-teal-50 rounded-lg">
        <p className="text-xs text-teal-600">Avg Daily</p>
        <p className="text-sm font-semibold text-teal-700">
          +{summary.avgDailyGrowth.toFixed(4)}%
        </p>
      </div>
    </div>
  );
}

export function ExchangeRateChart({
  data,
  summary,
  height = 300,
}: ExchangeRateChartProps) {
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        timestamp: item.timestamp,
        rateNormalized: parseFloat(item.exchangeRate) / 1_000_000,
        growthRate: item.growthRate,
        transactionHash: item.transactionHash,
      })),
    [data]
  );

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No exchange rate data available
      </div>
    );
  }

  // Calculate domain with some padding
  const minRate = Math.min(...chartData.map((d) => d.rateNormalized));
  const maxRate = Math.max(...chartData.map((d) => d.rateNormalized));
  const padding = (maxRate - minRate) * 0.1;

  return (
    <div>
      <GrowthSummary summary={summary} />
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorExchangeRate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={YIELD_CHART_COLORS.exchangeRate} stopOpacity={0.4} />
              <stop offset="95%" stopColor={YIELD_CHART_COLORS.exchangeRate} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => {
              const date = new Date(ts);
              return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            }}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <YAxis
            domain={[minRate - padding, maxRate + padding]}
            tickFormatter={(value) => value.toFixed(4)}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="rateNormalized"
            stroke={YIELD_CHART_COLORS.exchangeRate}
            strokeWidth={2}
            fill="url(#colorExchangeRate)"
            dot={{ fill: YIELD_CHART_COLORS.exchangeRate, strokeWidth: 0, r: 2 }}
            activeDot={{ r: 5, fill: YIELD_CHART_COLORS.exchangeRate }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ExchangeRateChart;
