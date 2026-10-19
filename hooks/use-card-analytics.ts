"use client";

import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api";
import { REVENUE_QUERY_KEYS } from "@/types/revenue";
import {
  CARD_QUERY_KEYS,
  CARD_REFRESH_INTERVALS,
  type CardEconomicsResponse,
  type CardIssuanceResponse,
  type CardRevenueResponse,
  type CardSpendingResponse,
  type RecordCardPayoutInput,
  type RefreshRainReportResult,
} from "@/types/card-analytics";

/** Spend, foreign-currency share and declines over the header's window. */
export function useCardSpending(queryString: string) {
  return useQuery<CardSpendingResponse>({
    queryKey: CARD_QUERY_KEYS.spending(queryString),
    queryFn: async () => {
      const response = await api.get(
        `/admin/v1/analytics/card/spending?${queryString}`
      );
      return response.data;
    },
    refetchInterval: CARD_REFRESH_INTERVALS.spending,
    staleTime: CARD_REFRESH_INTERVALS.spending / 2,
  });
}

/** Cards issued in the window and how many got used. */
export function useCardIssuance(queryString: string) {
  return useQuery<CardIssuanceResponse>({
    queryKey: CARD_QUERY_KEYS.issuance(queryString),
    queryFn: async () => {
      const response = await api.get(
        `/admin/v1/analytics/card/issuance?${queryString}`
      );
      return response.data;
    },
    refetchInterval: CARD_REFRESH_INTERVALS.issuance,
    staleTime: CARD_REFRESH_INTERVALS.issuance / 2,
  });
}

/**
 * Issuer FX revenue and payouts by billing month.
 *
 * Takes a number of months, not the header's range: a payout belongs to a
 * whole billing month, and the default 30-day window would cut most in half.
 */
export function useCardRevenue(months: number) {
  return useQuery<CardRevenueResponse>({
    queryKey: CARD_QUERY_KEYS.revenue(months),
    queryFn: async () => {
      const response = await api.get(
        `/admin/v1/analytics/card/revenue?months=${months}`
      );
      return response.data;
    },
    refetchInterval: CARD_REFRESH_INTERVALS.revenue,
    staleTime: CARD_REFRESH_INTERVALS.revenue / 2,
  });
}

/** Revenue against contract costs, per rail, over the header's window. */
export function useCardEconomics(queryString: string) {
  return useQuery<CardEconomicsResponse>({
    queryKey: CARD_QUERY_KEYS.economics(queryString),
    queryFn: async () => {
      const response = await api.get(
        `/admin/v1/analytics/card/economics?${queryString}`
      );
      return response.data;
    },
    refetchInterval: CARD_REFRESH_INTERVALS.economics,
    staleTime: CARD_REFRESH_INTERVALS.economics / 2,
  });
}

/**
 * Card reads plus the revenue pages: a recorded payout or a fetched Rain report
 * is booked as revenue, which moves the economics view and revenue by business
 * line too.
 */
function invalidateCardRevenue(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: CARD_QUERY_KEYS.all }),
    queryClient.invalidateQueries({ queryKey: REVENUE_QUERY_KEYS.all }),
  ]);
}

/** Record (or correct) a payout an issuer sent. */
export function useRecordCardPayout() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: true }, Error, RecordCardPayoutInput>({
    mutationFn: async (input) => {
      const response = await api.post("/admin/v1/analytics/card/payouts", input);
      return response.data;
    },
    onSuccess: () => invalidateCardRevenue(queryClient),
  });
}

/** Fetch Rain's monthly report for one billing month now. */
export function useRefreshRainReport() {
  const queryClient = useQueryClient();
  return useMutation<RefreshRainReportResult, Error, string>({
    mutationFn: async (billingMonth) => {
      const response = await api.post(
        "/admin/v1/analytics/card/reports/rain/refresh",
        { billingMonth }
      );
      return response.data;
    },
    onSuccess: () => invalidateCardRevenue(queryClient),
  });
}
