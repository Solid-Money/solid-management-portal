"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  FeeRevenueGrowthPoint,
  FeeRevenueGroupBy,
  FeeRevenueProductRow,
  FEE_REVENUE_COLORS,
} from "@/types/revenue";

import { formatUsd } from "@/lib/utils";
interface FeeRevenueChartProps {
  growth: FeeRevenueGrowthPoint[];
  /** Products in table order, so the stack order matches the rows beneath it. */
  products: FeeRevenueProductRow[];
  groupBy: FeeRevenueGroupBy;
  height?: number;
}

const formatYAxis = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

/**
 * Bucket label.
 *
 * Weeks and months are shown as stored (`2026-W07`, `2026-03`) because parsing
 * them back into a Date to reformat is where off-by-one week boundaries come
 * from; only the day form is safe to prettify.
 */
const formatPeriod = (period: string, groupBy: FeeRevenueGroupBy) => {
  if (groupBy !== "day") return period;
  const date = new Date(`${period}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

function FeeTooltip({
  active,
  payload,
  label,
  groupBy,
}: TooltipProps<number, string> & { groupBy: FeeRevenueGroupBy }) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + ((entry.value as number) || 0), 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium text-gray-900">
        {formatPeriod(label as string, groupBy)}
      </p>
      <div className="space-y-1">
        {/* Reversed so the tooltip reads top-down in the same order the stack
            is drawn bottom-up — otherwise the list and the bar disagree. */}
        {[...payload].reverse().map((entry) => (
          <div
            key={entry.dataKey as string}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}</span>
            </span>
            <span className="font-medium text-gray-900 tabular-nums">
              {formatUsd((entry.value as number) || 0)}
            </span>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between gap-4 border-t border-gray-200 pt-2 text-sm">
          <span className="text-gray-600">Total</span>
          <span className="font-semibold text-gray-900 tabular-nums">
            {formatUsd(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Fee revenue over time, stacked by product.
 *
 * One axis, in dollars. The cumulative total the API also returns is
 * deliberately not drawn here: on a second y-scale it would invent a trend, and
 * on this one it would flatten every bar into the baseline. It belongs in the
 * totals tiles above the chart, where it is a number rather than a shape.
 *
 * Every value is also in the table below, so the tooltip enhances rather than
 * gates — which is what makes the amber slot legible despite sitting under 3:1
 * against white on its own.
 */
export function FeeRevenueChart({
  growth,
  products,
  groupBy,
  height = 320,
}: FeeRevenueChartProps) {
  const data = useMemo(
    () =>
      growth.map((point) => ({
        period: point.period,
        ...Object.fromEntries(
          products.map((product) => [
            product.revenueType,
            point.byProduct?.[product.revenueType] ?? 0,
          ]),
        ),
      })),
    [growth, products],
  );

  if (growth.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-500"
        style={{ height }}
      >
        No fees charged in this period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        {/* Hairline, horizontal only, one shade off the surface. */}
        <CartesianGrid stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="period"
          tickFormatter={(value: string) => formatPeriod(value, groupBy)}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          stroke="#e5e7eb"
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          stroke="#e5e7eb"
          tickLine={false}
          width={64}
        />
        <Tooltip
          content={<FeeTooltip groupBy={groupBy} />}
          cursor={{ fill: "#f8fafc" }}
        />
        <Legend
          verticalAlign="bottom"
          height={32}
          iconType="square"
          iconSize={10}
          wrapperStyle={{ fontSize: 12 }}
          // Recharts tints legend labels with their series colour by default.
          // The swatch already carries identity, so the text stays in muted ink
          // — a label in amber on white is the one thing here that fails
          // contrast on its own.
          formatter={(value) => (
            <span className="text-gray-600">{value}</span>
          )}
        />
        {products.map((product, index) => (
          <Bar
            key={product.revenueType}
            dataKey={product.revenueType}
            name={product.name}
            stackId="fees"
            fill={FEE_REVENUE_COLORS[product.revenueType]}
            // A 2px surface gap separates the stacked segments instead of a
            // border, and only the top segment gets the rounded data-end.
            stroke="#ffffff"
            strokeWidth={2}
            radius={index === products.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
