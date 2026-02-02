"use client";

import { Settings2, Info } from "lucide-react";
import { FeeConfigurationResponse } from "@/types/yield-metrics";
import { cn } from "@/lib/utils";

interface FeeConfigurationCardProps {
  config?: FeeConfigurationResponse;
  isLoading?: boolean;
  className?: string;
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const percentage = (value / max) * 100;

  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${percentage}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function FeeItem({
  label,
  value,
  description,
  color,
  maxValue,
}: {
  label: string;
  value: number;
  description: string;
  color: string;
  maxValue: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-lg font-semibold" style={{ color }}>
          {value}%
        </span>
      </div>
      <ProgressBar value={value} max={maxValue} color={color} />
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

export function FeeConfigurationCard({
  config,
  isLoading,
  className,
}: FeeConfigurationCardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "bg-white rounded-lg shadow-sm border border-gray-200 p-6",
          className
        )}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-gray-200 rounded" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-2 w-full bg-gray-200 rounded" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-2 w-full bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Use defaults if no config provided
  const performanceFeeRate = config?.performanceFeeRate ?? 10;
  const platformFeeRate = config?.platformFeeRate ?? 100;
  const platformFeeRatePercent = platformFeeRate / 100; // Convert bps to percent
  const lastUpdated = config?.lastUpdated
    ? new Date(config.lastUpdated).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "N/A";

  return (
    <div
      className={cn(
        "bg-white rounded-lg shadow-sm border border-gray-200 p-6",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Settings2 className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Fee Configuration</h3>
          <p className="text-xs text-gray-500">Current on-chain rates</p>
        </div>
      </div>

      {/* Fee Items */}
      <div className="space-y-6">
        <FeeItem
          label="Performance Fee"
          value={performanceFeeRate}
          description="Charged on yield earned. Taken when exchange rate increases."
          color="#f59e0b" // amber-500
          maxValue={20}
        />

        <FeeItem
          label="Platform Fee"
          value={platformFeeRatePercent}
          description="Annual management fee. Charged daily on total assets."
          color="#3b82f6" // blue-500
          maxValue={5}
        />
      </div>

      {/* Info Section */}
      <div className="mt-6 p-3 bg-gray-50 rounded-lg">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-600 space-y-1">
            <p>
              <strong>Performance fee</strong> is deducted when yields are generated.
              Stakers receive {100 - performanceFeeRate}% of generated yield.
            </p>
            <p>
              <strong>Platform fee</strong> is an annual rate of {platformFeeRatePercent}%,
              calculated and accrued daily (~{(platformFeeRatePercent / 365).toFixed(4)}%/day).
            </p>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-4 flex justify-between items-center text-xs text-gray-400">
        <span>Rate base: {config?.vaultRateBase || "1000000"}</span>
        <span>Updated: {lastUpdated}</span>
      </div>
    </div>
  );
}

export default FeeConfigurationCard;
