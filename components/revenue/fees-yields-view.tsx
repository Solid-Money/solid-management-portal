"use client";

import { useState } from "react";
import { subDays } from "date-fns";

import { DateRangePicker } from "@/components/revenue/date-range-picker";
import { KPICard } from "@/components/revenue/kpi-card";
import { FeeConfigurationCard } from "@/components/revenue/fee-configuration-card";
import { DailyFeesChart } from "@/components/charts/daily-fees-chart";
import { RevenueSplitChart } from "@/components/charts/revenue-split-chart";
import { FeeBreakdownChart } from "@/components/charts/fee-breakdown-chart";
import { TvlYieldCorrelationChart } from "@/components/charts/tvl-yield-correlation-chart";
import { ExchangeRateChart } from "@/components/charts/exchange-rate-chart";

import {
  useYieldMetrics,
  useFeeBreakdown,
  useExchangeRateHistory,
  useTvlYieldCorrelation,
  useFeeConfiguration,
} from "@/hooks/use-yield-metrics";

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
}: {
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {isLoading ? <LoadingSpinner /> : children}
    </div>
  );
}

export function FeesYieldsView() {
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });

  // Fetch all data using React Query hooks
  const { data: yieldMetrics, isLoading: isLoadingMetrics } = useYieldMetrics(
    dateRange.start,
    dateRange.end
  );
  const { data: feeBreakdown, isLoading: isLoadingBreakdown } = useFeeBreakdown(
    dateRange.start,
    dateRange.end
  );
  const { data: rateHistory, isLoading: isLoadingRates } = useExchangeRateHistory(
    dateRange.start,
    dateRange.end
  );
  const { data: correlation, isLoading: isLoadingCorrelation } =
    useTvlYieldCorrelation(dateRange.start, dateRange.end);
  const { data: feeConfig, isLoading: isLoadingConfig } = useFeeConfiguration();

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };

  // Calculate change percentages for KPI cards
  const totalFees = yieldMetrics?.totals.totalFees || 0;
  const totalProtocolRevenue = yieldMetrics?.totals.totalProtocolRevenue || 0;
  const totalSupplySideRevenue = yieldMetrics?.totals.totalSupplySideRevenue || 0;
  const avgTvl = yieldMetrics?.totals.avgTvl || 0;

  return (
    <div className="space-y-6">
      {/* Header with Date Range Picker */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Fees & Yields</h2>
          <p className="text-sm text-gray-500">
            DefiLlama-style yield metrics from vault exchange rate updates
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
          title="Total Daily Fees"
          value={formatCurrency(totalFees)}
          trend={totalFees > 0 ? "up" : "flat"}
          sparkline={yieldMetrics?.metrics.map((m) => m.dailyFees)}
        />
        <KPICard
          title="Protocol Revenue"
          value={formatCurrency(totalProtocolRevenue)}
          trend={totalProtocolRevenue > 0 ? "up" : "flat"}
          sparkline={yieldMetrics?.metrics.map((m) => m.dailyProtocolRevenue)}
        />
        <KPICard
          title="Stakers Revenue"
          value={formatCurrency(totalSupplySideRevenue)}
          trend={totalSupplySideRevenue > 0 ? "up" : "flat"}
          sparkline={yieldMetrics?.metrics.map((m) => m.dailySupplySideRevenue)}
        />
        <KPICard
          title="Average TVL"
          value={formatCurrency(avgTvl)}
          trend={avgTvl > 0 ? "up" : "flat"}
          sparkline={yieldMetrics?.metrics.map((m) => m.tvl)}
        />
      </div>

      {/* Row 2: Daily Fees Chart + Fee Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Daily Fees"
          isLoading={isLoadingMetrics}
          className="lg:col-span-2"
        >
          <DailyFeesChart data={yieldMetrics?.metrics || []} height={300} />
        </ChartCard>
        <FeeConfigurationCard
          config={feeConfig}
          isLoading={isLoadingConfig}
        />
      </div>

      {/* Row 3: Revenue Split (full width) */}
      <ChartCard title="Revenue Split: Protocol vs Stakers" isLoading={isLoadingMetrics}>
        <RevenueSplitChart data={yieldMetrics?.metrics || []} height={350} />
      </ChartCard>

      {/* Row 4: Fee Breakdown + TVL Correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Fee Sources: Performance vs Platform" isLoading={isLoadingBreakdown}>
          <FeeBreakdownChart
            data={feeBreakdown?.breakdown || []}
            totals={feeBreakdown?.totals}
            height={350}
          />
        </ChartCard>
        <ChartCard title="TVL vs Yield Correlation" isLoading={isLoadingCorrelation}>
          <TvlYieldCorrelationChart
            data={correlation?.data || []}
            correlation={correlation?.stats.correlation}
            height={300}
          />
        </ChartCard>
      </div>

      {/* Row 5: Exchange Rate History */}
      <ChartCard title="Exchange Rate History" isLoading={isLoadingRates}>
        <ExchangeRateChart
          data={rateHistory?.history || []}
          summary={rateHistory?.summary}
          height={300}
        />
      </ChartCard>

      {/* Methodology Note */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-700 mb-2">Methodology Note</p>
        <p>
          These metrics follow the{" "}
          <span className="font-medium">DefiLlama adapter methodology</span>. Yields
          are calculated from exchange rate updates on-chain. The formula:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>
            <code className="bg-gray-200 px-1 rounded">supplySideYield</code> = TVL ×
            (newRate - oldRate) / rateBase
          </li>
          <li>
            <code className="bg-gray-200 px-1 rounded">totalYield</code> =
            supplySideYield / (1 - performanceFeeRate)
          </li>
          <li>
            <code className="bg-gray-200 px-1 rounded">platformFee</code> = TVL ×
            (annualRate/10000) / 365
          </li>
        </ul>
      </div>
    </div>
  );
}

export default FeesYieldsView;
