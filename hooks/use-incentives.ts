"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { isIncentivesResponse } from "@/lib/incentives";
import {
  OVERVIEW_QUERY_KEYS,
  OVERVIEW_REFRESH_MS,
  type IncentivesResponse,
} from "@/types/overview";

/**
 * The Incentives tab for the picked range. Only runs while the tab is open
 * (`enabled`), since it reads every payout, purchase and referral in the
 * range and the 13 weeks before it.
 */
export function useIncentives(from: string, to: string, enabled: boolean) {
  return useQuery<IncentivesResponse>({
    queryKey: OVERVIEW_QUERY_KEYS.incentives(from, to),
    queryFn: async () => {
      const response = await api.get<unknown>("/admin/v1/overview/incentives", {
        params: { from, to },
      });
      // A payload missing what the tab reads goes to the error and retry
      // path instead of breaking the page.
      if (!isIncentivesResponse(response.data)) {
        throw new Error("the response was missing Incentives fields");
      }
      return response.data;
    },
    enabled,
    refetchInterval: OVERVIEW_REFRESH_MS,
    staleTime: OVERVIEW_REFRESH_MS / 2,
    placeholderData: keepPreviousData,
  });
}
