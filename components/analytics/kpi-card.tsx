"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricLabel } from "@/components/analytics/metric-label";
import { SourceBadge, type AnalyticsSourceId } from "@/components/analytics/source-badge";
import { NotInstrumentedValue } from "@/components/analytics/not-instrumented";
import type { GlossaryKey } from "@/lib/glossary";

interface AnalyticsKpiCardProps {
  title: string;
  /** Undefined while loading; null when the metric is not instrumented. */
  value: string | null | undefined;
  /**
   * The scope of the number, in the reader's words — "last 30 days, both
   * rails".
   *
   * Required rather than optional: the dashboard's three revenue totals
   * disagreed because none of them said what window or which products they
   * covered, so a KPI here always states its own scope.
   */
  scope: string;
  /** Glossary entry backing the title, shown on hover. */
  metric?: GlossaryKey;
  change?: string;
  trend?: "up" | "down" | "flat";
  /**
   * Set when a rise is bad — cost, liability, decline rate.
   *
   * Without it an incentive bill doubling would render in the same reassuring
   * green as revenue doubling.
   */
  invertTrendColor?: boolean;
  source?: AnalyticsSourceId;
  updatedAt?: string;
  sparkline?: number[];
  className?: string;
}

export function AnalyticsKpiCard({
  title,
  value,
  scope,
  metric,
  change,
  trend,
  invertTrendColor = false,
  source,
  updatedAt,
  sparkline,
  className,
}: AnalyticsKpiCardProps) {
  const trendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4" aria-hidden />;
      case "down":
        return <TrendingDown className="h-4 w-4" aria-hidden />;
      case "flat":
        return <Minus className="h-4 w-4" aria-hidden />;
      default:
        return null;
    }
  };

  const trendColor = () => {
    if (!trend || trend === "flat") return "text-gray-500";
    const good = invertTrendColor ? trend === "down" : trend === "up";
    return good ? "text-emerald-600" : "text-red-600";
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 bg-white p-6 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-gray-500">
            {metric ? <MetricLabel metric={metric} label={title} /> : title}
          </p>

          <p className="text-2xl font-bold text-gray-900">
            {value === undefined ? (
              <span className="text-gray-300">—</span>
            ) : value === null ? (
              <NotInstrumentedValue />
            ) : (
              value
            )}
          </p>

          <p className="text-xs text-gray-400">{scope}</p>

          {change ? (
            <div className={cn("flex items-center gap-1 pt-1", trendColor())}>
              {trendIcon()}
              <span className="text-sm font-medium">{change}</span>
              <span className="text-sm text-gray-400">vs previous period</span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {source ? <SourceBadge source={source} updatedAt={updatedAt} /> : null}
          {sparkline && sparkline.length > 1 ? (
            <Sparkline data={sparkline} trend={trend} inverted={invertTrendColor} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Sparkline({
  data,
  trend,
  inverted,
}: {
  data: number[];
  trend?: "up" | "down" | "flat";
  inverted?: boolean;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const width = 80;
  const height = 32;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y =
      height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const good = inverted ? trend === "down" : trend === "up";
  const stroke =
    !trend || trend === "flat" ? "#6b7280" : good ? "#10b981" : "#ef4444";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
    </svg>
  );
}

export default AnalyticsKpiCard;
