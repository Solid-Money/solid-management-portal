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
  ReferenceLine,
} from "recharts";
import {
  DailySharePremium,
  SharePremiumResponse,
  ANALYTICS_CHART_COLORS,
} from "@/types/analytics-charts";

interface SharePremiumChartProps {
  data: SharePremiumResponse;
  height?: number;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

function getPremiumHealth(premium: number): {
  label: string;
  color: string;
  icon: string;
} {
  if (premium >= 0.5) {
    return { label: "Strong Growth", color: "text-emerald-600", icon: "🟢" };
  }
  if (premium >= 0) {
    return { label: "Healthy", color: "text-emerald-600", icon: "🟢" };
  }
  if (premium >= -0.5) {
    return { label: "Slight Discount", color: "text-amber-600", icon: "🟡" };
  }
  return { label: "Needs Review", color: "text-red-600", icon: "🔴" };
}

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0]?.payload as DailySharePremium;
  const premium = item.avgPremiumPercent;
  const isPremium = premium >= 0;
  const exchangeRate = parseInt(item.avgExchangeRate) / 1_000_000;
  const sharesPerHundred = exchangeRate > 0 ? (100 / exchangeRate).toFixed(1) : "—";
  const avgDeposit = item.depositCount > 0 ? item.totalDepositAmount / item.depositCount : 0;
  const health = getPremiumHealth(premium);

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 max-w-xs">
      {/* Header */}
      <div className="border-b border-gray-100 pb-2 mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>📅</span> {formatDate(label as string)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Share Premium shows if vault shares trade above (+) or below (-) their net asset value. Positive premium = healthy yield accumulation.
        </p>
      </div>

      {/* Premium & Exchange Rate */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Premium</span>
          <span className={`font-medium ${isPremium ? "text-emerald-600" : "text-red-600"}`}>
            {isPremium ? "+" : ""}{premium.toFixed(4)}% {health.icon}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Exchange Rate</span>
          <span className="font-medium text-gray-700">
            {exchangeRate.toFixed(6)}x
          </span>
        </div>
        <div className="text-xs text-gray-500 pl-4">
          └─ Users receive {sharesPerHundred} shares per 100 USDC
        </div>
      </div>

      {/* Deposit metrics */}
      <div className="space-y-1.5 mb-3 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Deposits</span>
          <span className="font-medium text-indigo-600">
            {item.depositCount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Total Deposited</span>
          <span className="font-medium text-blue-600">
            ${item.totalDepositAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">Avg Deposit</span>
          <span className="font-medium text-gray-700">
            ${avgDeposit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Yield insight */}
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs text-gray-500">
          <span className={health.color}>Yield Impact:</span> {isPremium ? "+" : ""}{premium.toFixed(4)}% accumulated since vault launch
        </p>
      </div>
    </div>
  );
}

function PremiumSummary({
  summary,
}: {
  summary: SharePremiumResponse["summary"];
}) {
  const isPremium = summary.avgPremiumPercent >= 0;
  const initialRate = parseInt(summary.initialExchangeRate) / 1_000_000;
  const currentRate = parseInt(summary.currentExchangeRate) / 1_000_000;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      <div className="text-center p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">Total Deposits</p>
        <p className="text-sm font-semibold text-gray-900">
          {summary.totalDeposits.toLocaleString()}
        </p>
      </div>
      <div
        className={`text-center p-3 rounded-lg ${
          isPremium ? "bg-emerald-50" : "bg-red-50"
        }`}
      >
        <p className={`text-xs ${isPremium ? "text-emerald-600" : "text-red-600"}`}>
          Avg Premium
        </p>
        <p
          className={`text-sm font-semibold ${
            isPremium ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {isPremium ? "+" : ""}
          {summary.avgPremiumPercent.toFixed(4)}%
        </p>
      </div>
      <div className="text-center p-3 bg-indigo-50 rounded-lg">
        <p className="text-xs text-indigo-600">Initial Rate</p>
        <p className="text-sm font-semibold text-indigo-700">
          {initialRate.toFixed(6)}
        </p>
      </div>
      <div className="text-center p-3 bg-violet-50 rounded-lg">
        <p className="text-xs text-violet-600">Current Rate</p>
        <p className="text-sm font-semibold text-violet-700">
          {currentRate.toFixed(6)}
        </p>
      </div>
      <div className="text-center p-3 bg-teal-50 rounded-lg">
        <p className="text-xs text-teal-600">Rate Growth</p>
        <p className="text-sm font-semibold text-teal-700">
          +{summary.exchangeRateGrowth.toFixed(4)}%
        </p>
      </div>
    </div>
  );
}

export function SharePremiumChart({
  data,
  height = 300,
}: SharePremiumChartProps) {
  const chartData = useMemo(() => data.dailyData, [data.dailyData]);

  if (!data.dailyData || data.dailyData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        No share premium data available
      </div>
    );
  }

  // Calculate domain with padding
  const premiums = chartData.map((d) => d.avgPremiumPercent);
  const minPremium = Math.min(...premiums);
  const maxPremium = Math.max(...premiums);
  const padding = Math.max(Math.abs(maxPremium - minPremium) * 0.2, 0.01);

  return (
    <div>
      <PremiumSummary summary={data.summary} />
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPremium" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={ANALYTICS_CHART_COLORS.premium}
                stopOpacity={0.4}
              />
              <stop
                offset="95%"
                stopColor={ANALYTICS_CHART_COLORS.premium}
                stopOpacity={0.05}
              />
            </linearGradient>
            <linearGradient id="colorDiscount" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={ANALYTICS_CHART_COLORS.discount}
                stopOpacity={0.4}
              />
              <stop
                offset="95%"
                stopColor={ANALYTICS_CHART_COLORS.discount}
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
            domain={[minPremium - padding, maxPremium + padding]}
            tickFormatter={(value) => `${value.toFixed(3)}%`}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={0}
            stroke={ANALYTICS_CHART_COLORS.neutral}
            strokeDasharray="3 3"
          />
          <Area
            type="monotone"
            dataKey="avgPremiumPercent"
            stroke={
              data.summary.avgPremiumPercent >= 0
                ? ANALYTICS_CHART_COLORS.premium
                : ANALYTICS_CHART_COLORS.discount
            }
            strokeWidth={2}
            fill={
              data.summary.avgPremiumPercent >= 0
                ? "url(#colorPremium)"
                : "url(#colorDiscount)"
            }
            dot={{ strokeWidth: 0, r: 2 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SharePremiumChart;
