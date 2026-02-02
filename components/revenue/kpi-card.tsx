"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "flat";
  sparkline?: number[];
  className?: string;
  description?: string;
}

export function KPICard({
  title,
  value,
  change,
  trend,
  sparkline,
  className,
  description,
}: KPICardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "flat":
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    if (!trend || !change) return "text-gray-500";
    if (trend === "up") return "text-emerald-600";
    if (trend === "down") return "text-red-600";
    return "text-gray-500";
  };

  return (
    <div
      className={cn(
        "bg-white rounded-lg shadow-sm border border-gray-200 p-6",
        className
      )}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {description && (
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          )}
          {change && (
            <div className="flex items-center gap-1 mt-2">
              {getTrendIcon()}
              <span className={cn("text-sm font-medium", getTrendColor())}>
                {change}
              </span>
              <span className="text-sm text-gray-400">vs last period</span>
            </div>
          )}
        </div>
        {sparkline && sparkline.length > 0 && (
          <MiniSparkline data={sparkline} trend={trend} />
        )}
      </div>
    </div>
  );
}

interface MiniSparklineProps {
  data: number[];
  trend?: "up" | "down" | "flat";
}

function MiniSparkline({ data, trend }: MiniSparklineProps) {
  if (data.length < 2) return null;

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

  const strokeColor =
    trend === "up"
      ? "#10b981"
      : trend === "down"
      ? "#ef4444"
      : "#6b7280";

  return (
    <svg
      width={width}
      height={height}
      className="flex-shrink-0"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
    </svg>
  );
}

export default KPICard;
