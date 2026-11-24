import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import api from "@/lib/api";
import { GENERAL_CONFIG_QUERY_KEY } from "@/hooks/use-general-config";
import { isRunWorking } from "@/lib/rain-sunset-bulk-cancel";
import type {
  RainSunsetBulkCancelItemFilter,
  RainSunsetBulkCancelItemPage,
  RainSunsetBulkCancelMode,
  RainSunsetBulkCancelOverview,
  RainSunsetBulkCancelRun,
} from "@/types";

const BASE = "/admin/v1/general-config/rain-sunset/bulk-cancel";
export const BULK_CANCEL_QUERY_KEY = ["rain-sunset-bulk-cancel"] as const;
const ITEMS_QUERY_KEY = ["rain-sunset-bulk-cancel-items"] as const;

/** How often a run that is reading balances or closing cards is re-read. */
const WORKING_POLL_MS = 3_000;

/**
 * The latest Rain card bulk cancel run and the recent ones. Polls while a run
 * is reading balances or closing cards, so progress moves on its own; idle
 * otherwise.
 */
export function useRainSunsetBulkCancel() {
  return useQuery<RainSunsetBulkCancelOverview>({
    queryKey: BULK_CANCEL_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<RainSunsetBulkCancelOverview>(BASE);
      return response.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.run?.status;
      return status && isRunWorking(status) ? WORKING_POLL_MS : false;
    },
  });
}

export interface BulkCancelItemsQuery {
  filter: RainSunsetBulkCancelItemFilter;
  search: string;
  page: number;
  limit: number;
}

/** One page of a run's cards. Re-read alongside the run while it works. */
export function useRainSunsetBulkCancelItems(
  runId: string | undefined,
  query: BulkCancelItemsQuery,
  working: boolean,
) {
  return useQuery<RainSunsetBulkCancelItemPage>({
    queryKey: [...ITEMS_QUERY_KEY, runId, query],
    enabled: !!runId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await api.get<RainSunsetBulkCancelItemPage>(
        `${BASE}/${runId}/items`,
        {
          params: {
            filter: query.filter,
            page: query.page,
            limit: query.limit,
            ...(query.search.trim() && { search: query.search.trim() }),
          },
        },
      );
      return response.data;
    },
    refetchInterval: working ? WORKING_POLL_MS * 2 : false,
  });
}

/** Every card in a run, page by page, for the CSV export. */
export async function fetchAllBulkCancelItems(runId: string) {
  const limit = 200;
  const items: RainSunsetBulkCancelItemPage["items"] = [];
  for (let page = 1; ; page++) {
    const response = await api.get<RainSunsetBulkCancelItemPage>(
      `${BASE}/${runId}/items`,
      { params: { filter: "all", page, limit } },
    );
    items.push(...response.data.items);
    if (
      response.data.items.length < limit ||
      items.length >= response.data.total
    ) {
      return items;
    }
  }
}

/**
 * After any change to a run: the run, its cards, and the sunset's summary
 * counts ("Rain cards held" drops as cards close) are all stale.
 */
function useRefreshAfter() {
  const queryClient = useQueryClient();
  return (run: RainSunsetBulkCancelRun) => {
    queryClient.setQueryData<RainSunsetBulkCancelOverview>(
      BULK_CANCEL_QUERY_KEY,
      (previous) => ({ run, recentRuns: previous?.recentRuns ?? [] }),
    );
    void queryClient.invalidateQueries({ queryKey: BULK_CANCEL_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: GENERAL_CONFIG_QUERY_KEY });
  };
}

/** Preview the Rain cards still held. Changes no card. */
export function usePreviewRainSunsetBulkCancel() {
  const refresh = useRefreshAfter();
  return useMutation<RainSunsetBulkCancelRun, Error, void>({
    mutationFn: async () => {
      const response = await api.post<RainSunsetBulkCancelRun>(
        `${BASE}/preview`,
      );
      return response.data;
    },
    onSuccess: refresh,
  });
}

/** Close the previewed cards at Rain. Irreversible. */
export function useConfirmRainSunsetBulkCancel() {
  const refresh = useRefreshAfter();
  return useMutation<
    RainSunsetBulkCancelRun,
    Error,
    { runId: string; mode: RainSunsetBulkCancelMode; expectedCount: number }
  >({
    mutationFn: async ({ runId, mode, expectedCount }) => {
      const response = await api.post<RainSunsetBulkCancelRun>(
        `${BASE}/${runId}/confirm`,
        { mode, expectedCount },
      );
      return response.data;
    },
    onSuccess: refresh,
  });
}

/** Discard a preview, or stop closing cards. */
export function useStopRainSunsetBulkCancel() {
  const refresh = useRefreshAfter();
  return useMutation<RainSunsetBulkCancelRun, Error, string>({
    mutationFn: async (runId) => {
      const response = await api.post<RainSunsetBulkCancelRun>(
        `${BASE}/${runId}/stop`,
      );
      return response.data;
    },
    onSuccess: refresh,
  });
}
