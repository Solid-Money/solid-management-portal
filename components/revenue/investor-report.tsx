"use client";

import { useState } from "react";
import { useInvestorReport } from "@/hooks/use-revenue";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, TrendingUp, DollarSign, Users, Clock } from "lucide-react";
import { format, subMonths, addMonths, isFuture, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

export function InvestorReport() {
  const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));
  const month = format(selectedDate, "yyyy-MM");

  const { data, isLoading, error } = useInvestorReport(month);

  const goToPreviousMonth = () => {
    setSelectedDate((d) => subMonths(d, 1));
  };

  const goToNextMonth = () => {
    const next = addMonths(selectedDate, 1);
    if (!isFuture(next)) {
      setSelectedDate(next);
    }
  };

  const canGoNext = !isFuture(addMonths(selectedDate, 1));

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
        <p className="text-gray-900 font-medium">Failed to load investor report</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        No data available for this month
      </div>
    );
  }

  const isPositiveMoM = data.summary.growth.mom.startsWith("+");
  const isPositiveYoY = data.summary.growth.yoy.startsWith("+");

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-semibold text-gray-900 min-w-[180px] text-center">
          {data.month}
        </h2>
        <button
          onClick={goToNextMonth}
          disabled={!canGoNext}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm font-medium">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data.summary.totalRevenue}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">Growth</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span
              className={cn(
                "text-xl font-bold",
                isPositiveMoM ? "text-emerald-600" : "text-red-600"
              )}
            >
              {data.summary.growth.mom}
            </span>
            <span className="text-sm text-gray-500">MoM</span>
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span
              className={cn(
                "text-lg font-medium",
                isPositiveYoY ? "text-emerald-600" : "text-red-600"
              )}
            >
              {data.summary.growth.yoy}
            </span>
            <span className="text-sm text-gray-500">YoY</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Revenue per User</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data.summary.revenuePerUser}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Daily Revenue
          </h3>
          {data.chartData && data.chartData.length > 0 ? (
            <RevenueAreaChart
              data={data.chartData.map((d) => ({
                period: format(new Date(d.date), "MMM d"),
                yieldShare: 0,
                borrowingFees: 0,
                total: d.revenue,
              }))}
              height={280}
            />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400">
              No chart data available
            </div>
          )}
        </div>

        {/* Unit Economics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Unit Economics
          </h3>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-500">Lifetime Value (LTV)</span>
                <span className="text-lg font-semibold text-gray-900">
                  {data.unitEconomics.ltv}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                Average revenue per user over lifetime
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-500">
                  Customer Acquisition Cost (CAC)
                </span>
                <span className="text-lg font-semibold text-gray-900">
                  {data.unitEconomics.cac}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                Cost to acquire one new user
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  LTV:CAC Ratio
                </span>
                <span
                  className={cn(
                    "text-xl font-bold",
                    parseFloat(data.unitEconomics.ltvCacRatio) >= 3
                      ? "text-emerald-600"
                      : parseFloat(data.unitEconomics.ltvCacRatio) >= 1
                      ? "text-amber-600"
                      : "text-red-600"
                  )}
                >
                  {data.unitEconomics.ltvCacRatio}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                {parseFloat(data.unitEconomics.ltvCacRatio) >= 3
                  ? "Excellent - sustainable growth"
                  : parseFloat(data.unitEconomics.ltvCacRatio) >= 1
                  ? "Good - room for improvement"
                  : "Warning - unsustainable unit economics"}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Payback Period
                </span>
                <span className="text-lg font-semibold text-gray-900">
                  {data.unitEconomics.paybackMonths} months
                </span>
              </div>
              <div className="text-xs text-gray-400">
                Time to recover acquisition cost
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvestorReport;
