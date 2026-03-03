"use client";

import { useExecutiveSummary } from "@/hooks/use-revenue";
import { KPICard } from "./kpi-card";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export function ExecutiveSummary() {
  const { data, isLoading, error, refetch, isRefetching } = useExecutiveSummary();

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
        <p className="text-gray-900 font-medium">Failed to load revenue data</p>
        <p className="text-gray-500 text-sm mb-4">
          {error instanceof Error ? error.message : "Unknown error occurred"}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        No revenue data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh indicator */}
      {isRefetching && (
        <div className="flex items-center justify-end gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Refreshing...
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue (30d)"
          value={data.totalRevenue.value}
          change={data.totalRevenue.change}
          trend={data.monthOverMonth.trend}
          sparkline={data.sparklineData}
        />
        <KPICard
          title="Month over Month"
          value={data.monthOverMonth.value}
          trend={data.monthOverMonth.trend}
        />
        <KPICard
          title="Revenue per User"
          value={data.revenuePerUser.value}
          change={data.revenuePerUser.change}
          trend={
            data.revenuePerUser.change?.startsWith("+")
              ? "up"
              : data.revenuePerUser.change?.startsWith("-")
              ? "down"
              : "flat"
          }
        />
        <KPICard
          title="Active Users"
          value={data.activeUsers.value}
          change={data.activeUsers.change}
          trend={
            data.activeUsers.change?.startsWith("+")
              ? "up"
              : data.activeUsers.change?.startsWith("-")
              ? "down"
              : "flat"
          }
        />
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Revenue Trend (30 days)
        </h3>
        <RevenueAreaChart data={data.sparklineData} />
      </div>
    </div>
  );
}

export default ExecutiveSummary;
