"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import {
  CARD_RAILS,
  type CardDailyPoint,
  type CardDailySeries,
} from "@/types/analytics";

/**
 * Above this many bars the per-bar total label stops being readable and starts
 * being visual noise, so it is dropped rather than overlapped.
 */
const MAX_BARS_WITH_TOTAL_LABEL = 21;

interface CardDailyStackedChartProps {
  series: CardDailySeries;
  /** Shown when there is nothing in the window. */
  emptyLabel: string;
  height?: number;
}

/**
 * One bar per day, split by card rail, with the day's total above it.
 *
 * Stacked rather than grouped because the question is "how much moved on the
 * card that day", with the rail split as the secondary read — grouped bars make
 * the total something the reader has to add up by eye.
 *
 * Every day in the range gets a bar, including the quiet ones. The API returns
 * only days with activity; gap-filling here is what stops a fortnight's silence
 * from rendering as two adjacent bars and reading like consecutive days.
 */
export function CardDailyStackedChart({
  series,
  emptyLabel,
  height = 320,
}: CardDailyStackedChartProps) {
  const data = useMemo(() => fillGaps(series.byDay), [series.byDay]);

  /**
   * A rail is drawn only if it can carry data at all.
   *
   * Wirex has no deposit step, so on the deposits chart its segment would be a
   * permanent zero. Dropping it from the legend is the difference between "this
   * rail has no deposits" and "this rail cannot have deposits" — the panel
   * states the latter in words beneath the chart.
   */
  const rails = useMemo(() => {
    const unavailable = new Set(
      series.unavailableRails.map((entry) => entry.rail)
    );
    return CARD_RAILS.filter((rail) => !unavailable.has(rail.id));
  }, [series.unavailableRails]);

  if (series.byDay.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const showTotals = data.length <= MAX_BARS_WITH_TOTAL_LABEL;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatDay(value)}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          // A month of daily bars will not fit every label; Recharts drops the
          // ones that would collide rather than rotating them into a thicket.
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tickFormatter={(value: number) => formatUsd(value, 0)}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          width={72}
        />
        <Tooltip
          cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
          content={<StackedTooltip />}
        />
        <Legend
          wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
          formatter={(value) => (
            <span className="text-gray-600">{value}</span>
          )}
        />

        {rails.map((rail, index) => (
          <Bar
            key={rail.id}
            dataKey={rail.id === "rain" ? "rainUsd" : "wirexUsd"}
            name={rail.label}
            stackId="card"
            fill={rail.color}
            // Only the topmost segment gets the rounded cap, so the stack reads
            // as one bar rather than as separate blocks sitting on each other.
            radius={index === rails.length - 1 ? [3, 3, 0, 0] : undefined}
          >
            {showTotals && index === rails.length - 1 ? (
              <LabelList
                dataKey="totalUsd"
                position="top"
                offset={6}
                className="fill-gray-500"
                fontSize={10}
                formatter={(value: number) =>
                  value > 0 ? formatUsd(value, 0) : ""
                }
              />
            ) : null}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * The day's total, then each rail's share of it.
 *
 * Recharts' default tooltip lists the segments without a total, which is the
 * one number a stacked bar exists to show. Each row carries its own count as
 * well, because "$400 across 2 purchases" and "$400 across 40" are different
 * days.
 */
function StackedTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: CardDailyPoint }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <p className="text-sm font-semibold text-gray-900">
        {formatDay(String(label), true)}
      </p>

      <div className="mt-2 space-y-1">
        {CARD_RAILS.map((rail) => {
          const usd = rail.id === "rain" ? point.rainUsd : point.wirexUsd;
          const count =
            rail.id === "rain" ? point.rainCount : point.wirexCount;

          // A rail with nothing on this day is left out rather than shown as
          // $0.00 — the tooltip should read as what happened, not as a form.
          if (count === 0 && usd === 0) return null;

          return (
            <div
              key={rail.id}
              className="flex items-center justify-between gap-6 text-sm"
            >
              <span className="flex items-center gap-2 text-gray-600">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: rail.color }}
                />
                {rail.label}
              </span>
              <span className="font-medium text-gray-900">
                {formatUsd(usd)}
                <span className="ml-1.5 text-xs text-gray-400">
                  {formatNumber(count, 0, 0)}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-6 border-t border-gray-100 pt-2 text-sm">
        <span className="font-medium text-gray-700">Total</span>
        <span className="font-semibold text-gray-900">
          {formatUsd(point.totalUsd)}
          <span className="ml-1.5 text-xs text-gray-400">
            {formatNumber(point.totalCount, 0, 0)}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Insert an empty bar for every day the API skipped.
 *
 * The response carries only days with activity, deliberately — it is not the
 * API's job to decide how a caller draws a gap. On a daily bar chart the answer
 * is a zero-height bar, so the x-axis stays a real calendar and a quiet stretch
 * looks quiet rather than disappearing.
 */
function fillGaps(byDay: CardDailyPoint[]): CardDailyPoint[] {
  if (byDay.length < 2) return byDay;

  const known = new Map(byDay.map((point) => [point.date, point]));
  const filled: CardDailyPoint[] = [];

  const cursor = new Date(`${byDay[0].date}T00:00:00Z`);
  const last = new Date(`${byDay[byDay.length - 1].date}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) {
    return byDay;
  }

  while (cursor <= last) {
    const date = cursor.toISOString().slice(0, 10);
    filled.push(
      known.get(date) ?? {
        date,
        rainUsd: 0,
        wirexUsd: 0,
        totalUsd: 0,
        rainCount: 0,
        wirexCount: 0,
        totalCount: 0,
      }
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return filled;
}

/** A `YYYY-MM-DD` bucket as a label, read in UTC to match how it was grouped. */
function formatDay(value: string, withYear = false): string {
  return formatDateTime(`${value}T00:00:00Z`, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export default CardDailyStackedChart;
