"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  ExecutiveSummaryResponse,
  RevenueSummaryResponse,
  RevenueSummaryQuery,
  FinanceDetailResponse,
  PaginatedUserRevenueResponse,
  ProductRevenueResponse,
  InvestorReportResponse,
  DailyFlowResponse,
  REVENUE_QUERY_KEYS,
  REFRESH_INTERVALS,
} from "@/types/revenue";
import { format } from "date-fns";

/**
 * Hook for fetching executive summary data
 * Provides high-level KPIs and 30-day trends
 */
export function useExecutiveSummary() {
  return useQuery<ExecutiveSummaryResponse>({
    queryKey: REVENUE_QUERY_KEYS.executiveSummary,
    queryFn: async () => {
      const response = await api.get("/admin/v1/revenue/executive-summary");
      return response.data;
    },
    refetchInterval: REFRESH_INTERVALS.executiveSummary,
    staleTime: REFRESH_INTERVALS.executiveSummary / 2,
  });
}

/**
 * Hook for fetching revenue summary with period breakdown
 * Supports daily, weekly, and monthly aggregations
 */
export function useRevenueSummary(
  startDate: Date,
  endDate: Date,
  period: "daily" | "weekly" | "monthly" = "daily"
) {
  const query: RevenueSummaryQuery = {
    period,
    startDate: format(startDate, "yyyy-MM-dd"),
    endDate: format(endDate, "yyyy-MM-dd"),
  };

  return useQuery<RevenueSummaryResponse>({
    queryKey: REVENUE_QUERY_KEYS.summary(query),
    queryFn: async () => {
      const params = new URLSearchParams({
        period: query.period,
        startDate: query.startDate,
        endDate: query.endDate,
      });
      const response = await api.get(`/admin/v1/revenue/summary?${params}`);
      return response.data;
    },
    staleTime: REFRESH_INTERVALS.financeDetail / 2,
  });
}

/**
 * Hook for fetching daily finance breakdown
 * Includes reconciliation status for each day
 */
export function useFinanceDetail(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<FinanceDetailResponse>({
    queryKey: REVENUE_QUERY_KEYS.financeDetail(start, end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const response = await api.get(`/admin/v1/revenue/finance-detail?${params}`);
      return response.data;
    },
    refetchInterval: REFRESH_INTERVALS.financeDetail,
    staleTime: REFRESH_INTERVALS.financeDetail / 2,
  });
}

/**
 * Hook for fetching daily deposit/withdrawal flow
 * Shows daily net flow (deposits - withdrawals) from subgraph data
 */
export function useDailyFlow(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<DailyFlowResponse>({
    queryKey: REVENUE_QUERY_KEYS.dailyFlow(start, end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const response = await api.get(`/admin/v1/revenue/daily-flow?${params}`);
      return response.data;
    },
    refetchInterval: REFRESH_INTERVALS.dailyFlow,
    staleTime: REFRESH_INTERVALS.dailyFlow / 2,
  });
}

/**
 * Hook for fetching revenue by user (paginated)
 * Shows top revenue-generating users
 */
export function useRevenueByUser(
  page: number = 1,
  limit: number = 20,
  sortBy: string = "totalRevenue",
  order: "asc" | "desc" = "desc",
  startDate?: Date,
  endDate?: Date
) {
  return useQuery<PaginatedUserRevenueResponse>({
    queryKey: [
      ...REVENUE_QUERY_KEYS.byUser(page, limit),
      sortBy,
      order,
      startDate,
      endDate,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        order,
      });
      if (startDate) {
        params.set("startDate", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        params.set("endDate", format(endDate, "yyyy-MM-dd"));
      }
      const response = await api.get(`/admin/v1/revenue/by-user?${params}`);
      return response.data;
    },
    refetchInterval: REFRESH_INTERVALS.operationsView,
    staleTime: REFRESH_INTERVALS.operationsView / 2,
  });
}

/**
 * Hook for fetching revenue by product
 */
export function useRevenueByProduct(startDate?: Date, endDate?: Date) {
  const start = startDate ? format(startDate, "yyyy-MM-dd") : undefined;
  const end = endDate ? format(endDate, "yyyy-MM-dd") : undefined;

  return useQuery<ProductRevenueResponse>({
    queryKey: REVENUE_QUERY_KEYS.byProduct(start || "", end || ""),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (start) params.set("startDate", start);
      if (end) params.set("endDate", end);
      const response = await api.get(`/admin/v1/revenue/by-product?${params}`);
      return response.data;
    },
    refetchInterval: REFRESH_INTERVALS.operationsView,
    staleTime: REFRESH_INTERVALS.operationsView / 2,
  });
}

/**
 * Hook for fetching investor report
 * Monthly summary with unit economics
 */
export function useInvestorReport(month: string) {
  return useQuery<InvestorReportResponse>({
    queryKey: REVENUE_QUERY_KEYS.investorReport(month),
    queryFn: async () => {
      const params = new URLSearchParams({ month });
      const response = await api.get(`/admin/v1/revenue/investor-report?${params}`);
      return response.data;
    },
    refetchInterval: REFRESH_INTERVALS.investorReport,
    staleTime: REFRESH_INTERVALS.investorReport / 2,
  });
}

/**
 * Hook for exporting revenue data
 * Supports CSV format
 */
export function useRevenueExport() {
  const exportData = async (
    startDate: Date,
    endDate: Date,
    format: "csv" = "csv"
  ) => {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      format,
    });
    const response = await api.get(`/admin/v1/revenue/export?${params}`, {
      responseType: "blob",
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `revenue_${startDate.toISOString().split("T")[0]}_${
        endDate.toISOString().split("T")[0]
      }.${format}`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return { exportData };
}
