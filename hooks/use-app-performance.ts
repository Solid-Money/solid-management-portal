"use client";

import { useCallback, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  APP_PERF_KEYS,
  appPerfFiltersQuery,
  getAppPerformanceSummary,
  getUserAppPerformance,
  parseAppPerfFilters,
  USER_SAMPLES_LIMIT,
  type AppPerfFilters,
} from "@/lib/app-performance";
import type {
  AppPerformanceSampleView,
  AppPerformanceSummary,
} from "@/types/app-performance";

/** One user's launch and resume timings, newest first. */
export function useUserAppPerformance(
  userId: string,
  limit: number = USER_SAMPLES_LIMIT
) {
  return useQuery<AppPerformanceSampleView[]>({
    queryKey: APP_PERF_KEYS.user(userId, limit),
    queryFn: () => getUserAppPerformance(userId, limit),
    enabled: Boolean(userId),
  });
}

/**
 * The fleet summary for some filters. Keeps the last summary on screen while
 * a new range or platform loads, so the tables do not collapse and jump.
 */
export function useAppPerformanceSummary(filters: AppPerfFilters) {
  return useQuery<AppPerformanceSummary>({
    queryKey: APP_PERF_KEYS.summary(filters),
    queryFn: () => getAppPerformanceSummary(filters),
    placeholderData: keepPreviousData,
  });
}

/**
 * The App performance page's filters, held in the query string so a view
 * ("Android, 2.1.0, last 30 days") can be pasted into Slack and open as the
 * sender saw it.
 */
export function useAppPerformanceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseAppPerfFilters(searchParams),
    [searchParams]
  );

  const update = useCallback(
    (next: Partial<AppPerfFilters>) => {
      const query = appPerfFiltersQuery({ ...filters, ...next });
      // `scroll: false` — a filter change should not throw the reader back
      // to the top of the page.
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [filters, pathname, router]
  );

  return { filters, update };
}
