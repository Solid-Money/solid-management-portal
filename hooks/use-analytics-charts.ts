"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "@/lib/api";
import {
  WithdrawalLatencyResponse,
  BridgeActivityResponse,
  SharePremiumResponse,
  UserCohortResponse,
  ANALYTICS_CHARTS_QUERY_KEYS,
  ANALYTICS_CHARTS_REFRESH_INTERVALS,
} from "@/types/analytics-charts";

/**
 * Hook for fetching withdrawal latency analysis
 * Returns processing time distribution and statistics
 */
export function useWithdrawalLatency(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<WithdrawalLatencyResponse>({
    queryKey: ANALYTICS_CHARTS_QUERY_KEYS.withdrawalLatency(start, end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const response = await api.get(
        `/admin/v1/revenue/withdrawal-latency?${params}`
      );
      return response.data;
    },
    refetchInterval: ANALYTICS_CHARTS_REFRESH_INTERVALS.withdrawalLatency,
    staleTime: ANALYTICS_CHARTS_REFRESH_INTERVALS.withdrawalLatency / 2,
  });
}

/**
 * Hook for fetching bridge activity timeline
 * Returns daily bridge counts and volumes
 */
export function useBridgeActivity(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<BridgeActivityResponse>({
    queryKey: ANALYTICS_CHARTS_QUERY_KEYS.bridgeActivity(start, end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const response = await api.get(
        `/admin/v1/revenue/bridge-activity?${params}`
      );
      return response.data;
    },
    refetchInterval: ANALYTICS_CHARTS_REFRESH_INTERVALS.bridgeActivity,
    staleTime: ANALYTICS_CHARTS_REFRESH_INTERVALS.bridgeActivity / 2,
  });
}

/**
 * Hook for fetching share premium/discount analysis
 * Returns daily premium percentages and exchange rate data
 */
export function useSharePremium(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<SharePremiumResponse>({
    queryKey: ANALYTICS_CHARTS_QUERY_KEYS.sharePremium(start, end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const response = await api.get(`/admin/v1/revenue/share-premium?${params}`);
      return response.data;
    },
    refetchInterval: ANALYTICS_CHARTS_REFRESH_INTERVALS.sharePremium,
    staleTime: ANALYTICS_CHARTS_REFRESH_INTERVALS.sharePremium / 2,
  });
}

/**
 * Hook for fetching user cohort analysis
 * Returns cohort data and retention matrix
 */
export function useUserCohorts(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<UserCohortResponse>({
    queryKey: ANALYTICS_CHARTS_QUERY_KEYS.userCohorts(start, end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const response = await api.get(
        `/admin/v1/revenue/user-cohorts?${params}`
      );
      return response.data;
    },
    refetchInterval: ANALYTICS_CHARTS_REFRESH_INTERVALS.userCohorts,
    staleTime: ANALYTICS_CHARTS_REFRESH_INTERVALS.userCohorts / 2,
  });
}
