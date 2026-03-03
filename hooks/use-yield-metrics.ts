"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "@/lib/api";
import {
  YieldMetricsResponse,
  FeeBreakdownResponse,
  ExchangeRateHistoryResponse,
  TvlYieldCorrelationResponse,
  FeeConfigurationResponse,
  YIELD_METRICS_QUERY_KEYS,
  YIELD_METRICS_REFRESH_INTERVALS,
} from "@/types/yield-metrics";

/**
 * Hook for fetching daily yield metrics
 * Returns DefiLlama-style metrics: dailyFees, dailyProtocolRevenue, dailySupplySideRevenue
 */
export function useYieldMetrics(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<YieldMetricsResponse>({
    queryKey: YIELD_METRICS_QUERY_KEYS.yieldMetrics(start, end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const response = await api.get(`/admin/v1/revenue/yield-metrics?${params}`);
      return response.data;
    },
    refetchInterval: YIELD_METRICS_REFRESH_INTERVALS.yieldMetrics,
    staleTime: YIELD_METRICS_REFRESH_INTERVALS.yieldMetrics / 2,
  });
}

/**
 * Hook for fetching fee breakdown (performance vs platform fees)
 * Shows how protocol revenue is split between performance fees and platform fees
 */
export function useFeeBreakdown(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<FeeBreakdownResponse>({
    queryKey: YIELD_METRICS_QUERY_KEYS.feeBreakdown(start, end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const response = await api.get(`/admin/v1/revenue/fee-breakdown?${params}`);
      return response.data;
    },
    refetchInterval: YIELD_METRICS_REFRESH_INTERVALS.feeBreakdown,
    staleTime: YIELD_METRICS_REFRESH_INTERVALS.feeBreakdown / 2,
  });
}

/**
 * Hook for fetching exchange rate history
 * Shows vault rate progression over time with growth calculations
 */
export function useExchangeRateHistory(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<ExchangeRateHistoryResponse>({
    queryKey: YIELD_METRICS_QUERY_KEYS.exchangeRateHistory(start, end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const response = await api.get(
        `/admin/v1/revenue/exchange-rate-history?${params}`
      );
      return response.data;
    },
    refetchInterval: YIELD_METRICS_REFRESH_INTERVALS.exchangeRateHistory,
    staleTime: YIELD_METRICS_REFRESH_INTERVALS.exchangeRateHistory / 2,
  });
}

/**
 * Hook for fetching TVL vs Yield correlation data
 * Shows the relationship between deposits and yield rate
 */
export function useTvlYieldCorrelation(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery<TvlYieldCorrelationResponse>({
    queryKey: YIELD_METRICS_QUERY_KEYS.tvlYieldCorrelation(start, end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const response = await api.get(
        `/admin/v1/revenue/tvl-yield-correlation?${params}`
      );
      return response.data;
    },
    refetchInterval: YIELD_METRICS_REFRESH_INTERVALS.tvlYieldCorrelation,
    staleTime: YIELD_METRICS_REFRESH_INTERVALS.tvlYieldCorrelation / 2,
  });
}

/**
 * Hook for fetching current fee configuration from accountant contract
 * Shows current performance fee rate (10%) and platform fee rate (1% annual)
 */
export function useFeeConfiguration() {
  return useQuery<FeeConfigurationResponse>({
    queryKey: YIELD_METRICS_QUERY_KEYS.feeConfiguration,
    queryFn: async () => {
      const response = await api.get(`/admin/v1/revenue/fee-configuration`);
      return response.data;
    },
    refetchInterval: YIELD_METRICS_REFRESH_INTERVALS.feeConfiguration,
    staleTime: YIELD_METRICS_REFRESH_INTERVALS.feeConfiguration / 2,
  });
}
