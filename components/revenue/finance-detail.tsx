"use client";

import { useState } from "react";
import { useFinanceDetail, useDailyFlow, useRevenueExport } from "@/hooks/use-revenue";
import { DateRangePicker } from "./date-range-picker";
import { DailyFlowChart } from "./daily-flow-chart";
import { Loader2, AlertCircle, Download, CheckCircle, Clock, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { ReconciliationStatusType } from "@/types/revenue";

export function FinanceDetail() {
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });

  const { data, isLoading, error } = useFinanceDetail(
    dateRange.start,
    dateRange.end
  );
  const { data: flowData, isLoading: flowLoading } = useDailyFlow(
    dateRange.start,
    dateRange.end
  );
  const { exportData } = useRevenueExport();

  const handleExport = async () => {
    await exportData(dateRange.start, dateRange.end, "csv");
  };

  const getStatusBadge = (status: ReconciliationStatusType) => {
    const configs = {
      verified: {
        icon: CheckCircle,
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        label: "Verified",
      },
      pending: {
        icon: Clock,
        bg: "bg-amber-50",
        text: "text-amber-700",
        label: "Pending",
      },
      discrepancy: {
        icon: AlertTriangle,
        bg: "bg-red-50",
        text: "text-red-700",
        label: "Discrepancy",
      },
      resolved: {
        icon: CheckCircle,
        bg: "bg-blue-50",
        text: "text-blue-700",
        label: "Resolved",
      },
    };

    const config = configs[status] || configs.pending;
    const Icon = config.icon;

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
          config.bg,
          config.text
        )}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

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
        <p className="text-gray-900 font-medium">Failed to load finance data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onRangeChange={(start, end) => setDateRange({ start, end })}
        />
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Daily Net Flow Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Daily Net Flow</h3>
          {flowData?.totals && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-gray-600">Deposits:</span>
                <span className="font-medium text-emerald-600">
                  ${flowData.totals.totalDeposits.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-gray-600">Withdrawals:</span>
                <span className="font-medium text-red-600">
                  ${flowData.totals.totalWithdrawals.toLocaleString()}
                </span>
              </div>
              <div className="border-l border-gray-200 pl-4">
                <span className="text-gray-600">Net:</span>
                <span
                  className={cn(
                    "font-semibold ml-1",
                    flowData.totals.netChange >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  )}
                >
                  {flowData.totals.netChange >= 0 ? "+" : ""}$
                  {flowData.totals.netChange.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
        {flowLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <DailyFlowChart data={flowData?.dailyFlow || []} height={300} />
        )}
      </div>

      {/* Daily breakdown table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Daily Revenue Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Yield Share
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.dailyBreakdown.map((day) => (
                <tr key={day.date} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {day.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                    <span className="font-medium">${day.yieldShare.net}</span>
                    {day.yieldShare.gross !== day.yieldShare.net && (
                      <span className="text-gray-400 text-xs ml-1">
                        (gross: ${day.yieldShare.gross})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                    ${day.total}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {getStatusBadge(day.reconciliationStatus)}
                  </td>
                </tr>
              ))}
            </tbody>
            {data?.dailyBreakdown && data.dailyBreakdown.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    Total
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                    $
                    {data.dailyBreakdown
                      .reduce((sum, d) => sum + parseFloat(d.yieldShare.net), 0)
                      .toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                    $
                    {data.dailyBreakdown
                      .reduce((sum, d) => sum + parseFloat(d.total), 0)
                      .toFixed(2)}
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {(!data?.dailyBreakdown || data.dailyBreakdown.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            No revenue data for the selected period
          </div>
        )}
      </div>

      {/* Adjustments section */}
      {data?.adjustments && data.adjustments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Adjustments</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.adjustments.map((adj, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{adj.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{adj.type}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      {adj.amount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{adj.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default FinanceDetail;
