"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { isGoodCustomersResponse } from "@/lib/good-customers";
import {
  OVERVIEW_QUERY_KEYS,
  OVERVIEW_REFRESH_MS,
  type GoodCustomersResponse,
} from "@/types/overview";

/**
 * The Good customers tab, as of the range's last day. Only runs while the tab
 * is open (`enabled`), since it follows every cardholder over four months.
 */
export function useGoodCustomers(from: string, to: string, enabled: boolean) {
  return useQuery<GoodCustomersResponse>({
    queryKey: OVERVIEW_QUERY_KEYS.goodCustomers(from, to),
    queryFn: async () => {
      const response = await api.get<unknown>(
        "/admin/v1/overview/good-customers",
        { params: { from, to } },
      );
      // A payload missing what the tab reads goes to the error and retry
      // path instead of breaking the page.
      if (!isGoodCustomersResponse(response.data)) {
        throw new Error("the response was missing Good customers fields");
      }
      return response.data;
    },
    enabled,
    refetchInterval: OVERVIEW_REFRESH_MS,
    staleTime: OVERVIEW_REFRESH_MS / 2,
    placeholderData: keepPreviousData,
  });
}
