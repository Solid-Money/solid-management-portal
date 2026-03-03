"use client";

import { useState } from "react";
import { subDays } from "date-fns";

import { DateRangePicker } from "@/components/revenue/date-range-picker";
import { KPICard } from "@/components/revenue/kpi-card";
import { WithdrawalLatencyChart } from "@/components/charts/withdrawal-latency-chart";
import { BridgeActivityChart } from "@/components/charts/bridge-activity-chart";
import { SharePremiumChart } from "@/components/charts/share-premium-chart";
import { UserCohortChart } from "@/components/charts/user-cohort-chart";

import {
  useWithdrawalLatency,
  useBridgeActivity,
  useSharePremium,
  useUserCohorts,
} from "@/hooks/use-analytics-charts";
import { formatLatency } from "@/types/analytics-charts";

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}

function ChartCard({
  title,
  children,
  isLoading,
  className = "",
  description,
}: {
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  description?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>
      {isLoading ? <LoadingSpinner /> : children}
    </div>
  );
}

export function AnalyticsChartsView() {
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });

  // Fetch all data using React Query hooks
  const { data: latencyData, isLoading: isLoadingLatency } = useWithdrawalLatency(
    dateRange.start,
    dateRange.end
  );
  const { data: bridgeData, isLoading: isLoadingBridge } = useBridgeActivity(
    dateRange.start,
    dateRange.end
  );
  const { data: premiumData, isLoading: isLoadingPremium } = useSharePremium(
    dateRange.start,
    dateRange.end
  );
  const { data: cohortData, isLoading: isLoadingCohorts } = useUserCohorts(
    dateRange.start,
    dateRange.end
  );

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };

  // Extract KPI values
  const avgLatency = latencyData?.summary.avgLatencySeconds || 0;
  const totalBridgeVolume = bridgeData?.summary.totalValueUsd || 0;
  const avgPremium = premiumData?.summary.avgPremiumPercent || 0;
  const totalUsers = cohortData?.summary.totalUsers || 0;

  return (
    <div className="space-y-6">
      {/* Header with Date Range Picker */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Advanced Analytics
          </h2>
          <p className="text-sm text-gray-500">
            Withdrawal latency, bridge activity, share premium, and user cohorts
          </p>
        </div>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onRangeChange={handleDateRangeChange}
        />
      </div>

      {/* Row 1: 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Avg Withdrawal Latency"
          value={formatLatency(avgLatency)}
          trend={avgLatency < 14400 ? "up" : "down"} // Green if < 4h
          description="Time to process withdrawals"
        />
        <KPICard
          title="Bridge Volume"
          value={formatCurrency(totalBridgeVolume)}
          trend={totalBridgeVolume > 0 ? "up" : "flat"}
          description="Cross-chain bridging activity"
        />
        <KPICard
          title="Avg Share Premium"
          value={`${avgPremium >= 0 ? "+" : ""}${avgPremium.toFixed(4)}%`}
          trend={avgPremium >= 0 ? "up" : "down"}
          description="Premium/discount on deposits"
        />
        <KPICard
          title="Total Users"
          value={totalUsers.toLocaleString()}
          trend="up"
          description="Unique depositors"
        />
      </div>

      {/* Row 2: Withdrawal Latency Chart */}
      <ChartCard
        title="Withdrawal Latency Analysis"
        description="Distribution of withdrawal processing times from request to settlement"
        isLoading={isLoadingLatency}
      >
        {latencyData && (
          <WithdrawalLatencyChart data={latencyData} height={350} />
        )}
      </ChartCard>

      {/* Row 3: Bridge Activity + Share Premium */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Bridge Activity Timeline"
          description="Cross-chain bridge events showing volume and user activity"
          isLoading={isLoadingBridge}
        >
          {bridgeData && (
            <BridgeActivityChart data={bridgeData} height={350} />
          )}
        </ChartCard>
        <ChartCard
          title="Share Premium/Discount"
          description="Actual shares received vs expected based on exchange rate"
          isLoading={isLoadingPremium}
        >
          {premiumData && (
            <SharePremiumChart data={premiumData} height={350} />
          )}
        </ChartCard>
      </div>

      {/* Row 4: User Cohorts (full width) */}
      <ChartCard
        title="User Cohort Analysis"
        description="User acquisition by month with retention tracking"
        isLoading={isLoadingCohorts}
      >
        {cohortData && (
          <UserCohortChart data={cohortData} height={350} />
        )}
      </ChartCard>

      {/* Insights Note */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-700 mb-2">Chart Insights</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>
            <strong>Withdrawal Latency:</strong> Shows how long withdrawals take
            to process. Lower is better - target under 4 hours.
          </li>
          <li>
            <strong>Bridge Activity:</strong> Tracks cross-chain activity.
            Spikes may indicate market movements or protocol upgrades.
          </li>
          <li>
            <strong>Share Premium:</strong> Values near 0% indicate fair
            pricing. Positive = users getting more shares than expected.
          </li>
          <li>
            <strong>User Cohorts:</strong> Shows retention by signup month.
            Higher retention in older cohorts indicates sticky users.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default AnalyticsChartsView;
