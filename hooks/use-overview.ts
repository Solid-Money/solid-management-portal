"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  OVERVIEW_QUERY_KEYS,
  OVERVIEW_REFRESH_MS,
  type OverviewResponse,
} from "@/types/overview";

/**
 * The Overview page for one range. Refreshes every five minutes, the
 * backend's own cache, and keeps the last page on screen while a new range
 * loads so the layout does not jump.
 */
export function useOverview(from: string, to: string) {
  return useQuery<OverviewResponse>({
    queryKey: OVERVIEW_QUERY_KEYS.range(from, to),
    queryFn: async () => {
      const response = await api.get<OverviewResponse>("/admin/v1/overview", {
        params: { from, to },
      });
      return response.data;
    },
    refetchInterval: OVERVIEW_REFRESH_MS,
    staleTime: OVERVIEW_REFRESH_MS / 2,
    placeholderData: keepPreviousData,
  });
}
