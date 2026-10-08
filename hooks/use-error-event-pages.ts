"use client";

import { useMemo } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  type QueryKey,
} from "@tanstack/react-query";
import {
  nextEventsPageParam,
  resolveRange,
  type ErrorEventsPage,
  type ErrorEventsPageParam,
  type RangePreset,
  type TimeWindow,
} from "@/lib/errors";
import type { ErrorEventsResponse } from "@/types/errors";

/**
 * A cursor-paged list of error occurrences, flattened, with "Load more".
 *
 * The window is resolved when the first page is read and carried to the
 * pages after it (see `ErrorEventsPage`), so paging never straddles two
 * different "last 24 hours".
 */
export function useErrorEventPages(
  queryKey: QueryKey,
  range: RangePreset,
  fetchPage: (window: TimeWindow, cursor?: string) => Promise<ErrorEventsResponse>
) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }): Promise<ErrorEventsPage> => {
      const window = pageParam?.window ?? resolveRange(range);
      const page = await fetchPage(window, pageParam?.cursor);
      return { ...page, window };
    },
    initialPageParam: null as ErrorEventsPageParam,
    getNextPageParam: nextEventsPageParam,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data]
  );

  return { query, rows };
}
