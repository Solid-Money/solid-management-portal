"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  APP_PERF_KEYS,
  appPerfFiltersQuery,
  effectiveAppPerfFilters,
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

  const urlFilters = useMemo(
    () => parseAppPerfFilters(searchParams),
    [searchParams]
  );

  // The filters last asked for, while the page's navigations are under way.
  // The router's navigations are transitions, so `navigating` stays true until
  // every one of them has settled. Until then the page (and the version field)
  // shows what was asked for, so a URL passing through an older request never
  // reads as a change; a second change builds on it, so neither is lost. Once
  // everything has settled the URL is the truth again: caught up, a request
  // the router dropped, or a change from outside (back/forward).
  const [requested, setRequested] = useState<AppPerfFilters | null>(null);
  const [navigating, startNavigation] = useTransition();
  if (!navigating && requested !== null) setRequested(null);
  const filters = effectiveAppPerfFilters(urlFilters, requested, navigating);

  const update = useCallback(
    (next: Partial<AppPerfFilters>) => {
      const merged = { ...filters, ...next };
      setRequested(merged);
      const query = appPerfFiltersQuery(merged);
      startNavigation(() => {
        // `scroll: false` — a filter change should not throw the reader back
        // to the top of the page.
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [filters, pathname, router]
  );

  return { filters, update };
}
