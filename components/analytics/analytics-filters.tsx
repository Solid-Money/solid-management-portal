"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, startOfMonth, subDays } from "date-fns";

/**
 * The filter state every Analytics panel reads.
 *
 * Held in the URL rather than React state so a view is shareable: the whole
 * point of a single source of truth is that two people looking at "revenue,
 * last 30 days, Wirex only" are looking at the same thing, which only works if
 * the filters travel in the link.
 */
export interface AnalyticsFilters {
  /** Inclusive, `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  /** Whether panels should also fetch the preceding equal-length window. */
  compare: boolean;
  country?: string;
  platform?: "web" | "android" | "ios";
  tier?: "core" | "prime" | "ultra";
  rail?: "rain" | "wirex";
}

export interface DatePreset {
  id: string;
  label: string;
  /** Days back from today, or null for month-to-date. */
  days: number | null;
}

export const DATE_PRESETS: DatePreset[] = [
  { id: "today", label: "Today", days: 0 },
  { id: "7d", label: "7d", days: 7 },
  { id: "30d", label: "30d", days: 30 },
  { id: "90d", label: "90d", days: 90 },
  { id: "mtd", label: "MTD", days: null },
];

const DEFAULT_PRESET_DAYS = 30;

const iso = (date: Date) => format(date, "yyyy-MM-dd");

interface AnalyticsFiltersContextValue {
  filters: AnalyticsFilters;
  /** Merge a partial change into the URL, preserving the current sub-tab. */
  setFilters: (next: Partial<AnalyticsFilters>) => void;
  /** Query string for an API call, without the leading `?`. */
  queryString: (extra?: Record<string, string | number | undefined>) => string;
}

const AnalyticsFiltersContext =
  createContext<AnalyticsFiltersContextValue | null>(null);

export function AnalyticsFiltersProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<AnalyticsFilters>(() => {
    const endDate = searchParams.get("endDate") ?? iso(new Date());
    const startDate =
      searchParams.get("startDate") ??
      iso(subDays(new Date(), DEFAULT_PRESET_DAYS));

    const platform = searchParams.get("platform");
    const tier = searchParams.get("tier");
    const rail = searchParams.get("rail");

    return {
      startDate,
      endDate,
      compare: searchParams.get("compare") === "true",
      country: searchParams.get("country") ?? undefined,
      platform:
        platform === "web" || platform === "android" || platform === "ios"
          ? platform
          : undefined,
      tier:
        tier === "core" || tier === "prime" || tier === "ultra"
          ? tier
          : undefined,
      rail: rail === "rain" || rail === "wirex" ? rail : undefined,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (next: Partial<AnalyticsFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(next)) {
        // An empty selection removes the param rather than writing "undefined",
        // so a cleared filter produces a clean, linkable URL.
        if (value === undefined || value === "" || value === false) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }

      // `scroll: false` — changing a date range should not throw the reader
      // back to the top of a long tab.
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const queryString = useCallback(
    (extra?: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      if (filters.compare) params.set("compare", "true");
      if (filters.country) params.set("country", filters.country);
      if (filters.platform) params.set("platform", filters.platform);
      if (filters.tier) params.set("tier", filters.tier);
      if (filters.rail) params.set("rail", filters.rail);

      for (const [key, value] of Object.entries(extra ?? {})) {
        if (value !== undefined) params.set(key, String(value));
      }

      return params.toString();
    },
    [filters]
  );

  const value = useMemo(
    () => ({ filters, setFilters, queryString }),
    [filters, setFilters, queryString]
  );

  return (
    <AnalyticsFiltersContext.Provider value={value}>
      {children}
    </AnalyticsFiltersContext.Provider>
  );
}

/**
 * The current filters.
 *
 * Throws outside the provider rather than returning defaults: a panel that
 * silently ignored the header's date range would show a different period from
 * every other panel on the page, which is precisely the problem this section
 * exists to fix.
 */
export function useAnalyticsFilters(): AnalyticsFiltersContextValue {
  const context = useContext(AnalyticsFiltersContext);
  if (!context) {
    throw new Error(
      "useAnalyticsFilters must be used inside the Analytics layout's AnalyticsFiltersProvider."
    );
  }
  return context;
}

/** The start date a preset resolves to, for highlighting the active one. */
export function presetRange(preset: DatePreset): {
  startDate: string;
  endDate: string;
} {
  const today = new Date();
  if (preset.days === null) {
    return { startDate: iso(startOfMonth(today)), endDate: iso(today) };
  }
  return { startDate: iso(subDays(today, preset.days)), endDate: iso(today) };
}
