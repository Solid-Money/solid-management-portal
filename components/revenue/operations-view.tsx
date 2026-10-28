"use client";

import { useState } from "react";
import { useRevenueByProduct } from "@/hooks/use-revenue";
import { DateRangePicker } from "./date-range-picker";
import {
  Loader2,
  AlertCircle,
  Users,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from "lucide-react";
import { subDays } from "date-fns";
import { cn, formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import {
  FEE_REVENUE_COLORS,
  REVENUE_COLORS,
  type FeeRevenueType,
  type ProductRevenue,
  type RevenueBusinessLine,
} from "@/types/revenue";

/** Business lines in display order, with their headings. */
const BUSINESS_LINES: Array<{ id: RevenueBusinessLine; label: string }> = [
  { id: "savings", label: "Savings" },
  { id: "swaps", label: "Swaps" },
  { id: "card", label: "Card" },
  { id: "banking", label: "Banking" },
  { id: "stocks", label: "Stocks" },
  { id: "buy_crypto", label: "Buy crypto" },
];

/** Issuer FX payouts have no fee colour of their own. */
const CARD_FX_PAYOUT_COLOR = "#0891b2"; // cyan-600

function rowColor(product: ProductRevenue): string {
  if (product.revenueType === "yield_share") return REVENUE_COLORS.yieldShare;
  if (product.revenueType === "card_fx_payout") return CARD_FX_PAYOUT_COLOR;
  return (
    FEE_REVENUE_COLORS[product.revenueType as FeeRevenueType] ??
    REVENUE_COLORS.borrowingFees
  );
}

export function OperationsView() {
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 90),
    end: new Date(),
  });

  const {
    data: productsData,
    isLoading,
    error,
  } = useRevenueByProduct(dateRange.start, dateRange.end);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-gray-900 font-medium">Failed to load operations data</p>
      </div>
    );
  }

  const total = productsData?.totalRevenue ?? 0;
  const lines = BUSINESS_LINES.map((line) => {
    const rows = (productsData?.products ?? []).filter(
      (product) => product.businessLine === line.id
    );
    return {
      ...line,
      rows,
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    };
  }).filter((line) => line.rows.length > 0);

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex justify-between items-center">
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onRangeChange={(start, end) => {
            setDateRange({ start, end });
          }}
        />
      </div>

      {/* Product Comparison */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900">
          Revenue by business line
        </h3>
        {/* The scope, spelled out. This total is grouped by business line
            over the range above — 90 days by default — while the executive
            card is all revenue types over a fixed 30 days. Both are correct;
            they answer different questions, and the labels say which. */}
        <p className="text-sm text-gray-500">
          Every revenue line over the selected range, grouped by business line.
          Card includes the FX fee Rain and Wirex pay out to us. This total will
          not match the 30-day executive figure above.
        </p>
        {productsData?.period ? (
          <p className="mb-4 mt-1 text-xs text-gray-400">
            Trends compare with the{" "}
            {formatDateTime(productsData.period.previousStartDate, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            –{" "}
            {formatDateTime(productsData.period.previousEndDate, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            window of the same length.
          </p>
        ) : null}

        {lines.length > 0 ? (
          <div className="space-y-6">
            {lines.map((line) => (
              <div key={line.id} className="space-y-3">
                <div className="flex items-baseline justify-between border-b border-gray-100 pb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {line.label}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {formatUsd(line.revenue)}
                  </span>
                </div>
                {line.rows.map((product) => (
                  <ProductRow
                    key={product.revenueType}
                    product={product}
                    total={total}
                  />
                ))}
              </div>
            ))}

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatUsd(total)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No product data available
          </div>
        )}
      </div>
    </div>
  );
}

function ProductRow({
  product,
  total,
}: {
  product: ProductRevenue;
  total: number;
}) {
  const percentage = total > 0 ? (product.revenue / total) * 100 : 0;
  const color = rowColor(product);
  const isNew = product.changePercent === null && product.revenue > 0;
  const isPositive = (product.changePercent ?? 0) >= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-medium text-gray-900">
            {product.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">
            {formatUsd(product.revenue)}
          </span>
          {isNew ? (
            // No baseline: a percentage would be invented, so say what it is.
            <span className="flex items-center text-xs font-medium text-indigo-600">
              <Sparkles className="h-3 w-3 mr-1" aria-hidden />
              new
            </span>
          ) : product.changePercent === null ? (
            <span className="text-xs text-gray-400">—</span>
          ) : (
            <span
              className={cn(
                "flex items-center text-xs font-medium",
                isPositive ? "text-emerald-600" : "text-red-600"
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3 mr-1" aria-hidden />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" aria-hidden />
              )}
              {product.trend}
            </span>
          )}
        </div>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{percentage.toFixed(1)}% of total</span>
        {product.usersAttributable === false ? (
          <span className="text-gray-400">Not attributable to users</span>
        ) : (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden />
            {formatNumber(product.users, 0, 0)} users
          </span>
        )}
      </div>
    </div>
  );
}

export default OperationsView;
