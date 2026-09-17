"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "@/lib/api";
import {
  FeeRevenueDetailResponse,
  FeeRevenueGroupBy,
  FeeRevenueOverviewResponse,
  FeeRevenueType,
  FEE_REVENUE_QUERY_KEYS,
  REFRESH_INTERVALS,
} from "@/types/revenue";

/**
 * Per-product fee revenue: a row per product, overall totals, and the growth
 * series behind them.
 *
 * One request for the whole block rather than one per product, so the table,
 * the totals and the chart are always the same slice of time — three requests
 * could straddle a new fee landing and disagree.
 */
export function useFeeRevenueOverview(
  startDate: Date,
  endDate: Date,
  groupBy: FeeRevenueGroupBy = "day",
) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<FeeRevenueOverviewResponse>({
    queryKey: FEE_REVENUE_QUERY_KEYS.overview(start, end, groupBy),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
        groupBy,
      });
      const response = await api.get(`/admin/v1/revenue/fees?${params}`);
      return response.data;
    },
    refetchInterval: REFRESH_INTERVALS.dailyFlow,
    staleTime: REFRESH_INTERVALS.dailyFlow / 2,
  });
}

/**
 * The individual charges behind one fee product.
 *
 * Only fetched once a product row is expanded (`enabled`), because a busy month
 * is tens of thousands of fees and nobody needs them until they open the row.
 */
export function useFeeRevenueDetail(
  revenueType: FeeRevenueType | null,
  startDate: Date,
  endDate: Date,
  page = 1,
  limit = 25,
) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<FeeRevenueDetailResponse>({
    queryKey: FEE_REVENUE_QUERY_KEYS.detail(revenueType ?? "none", start, end, page),
    queryFn: async () => {
      const params = new URLSearchParams({
        revenueType: revenueType as string,
        startDate: start,
        endDate: end,
        page: String(page),
        limit: String(limit),
      });
      const response = await api.get(`/admin/v1/revenue/fees/detail?${params}`);
      return response.data;
    },
    enabled: Boolean(revenueType),
    staleTime: REFRESH_INTERVALS.dailyFlow / 2,
  });
}
