"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_RANGE,
  ERROR_FLOWS,
  ERROR_SOURCES,
  GROUP_STATUSES,
  isRangePreset,
  PLATFORMS,
  SEVERITIES,
  WHO_ACTS,
  type ErrorFilters,
  type GroupSort,
} from "@/lib/errors";
import type { ErrorGroupStatus } from "@/types/errors";

export type ErrorsTab = "summary" | "feed" | "label";

const TABS: ErrorsTab[] = ["summary", "feed", "label"];
const SORTS: GroupSort[] = ["lastSeen", "count", "users"];

/** Everything the Errors page shows, as it is written in the URL. */
export interface ErrorsViewState extends ErrorFilters {
  tab: ErrorsTab;
  /** Summary only; unset is every status. */
  status?: ErrorGroupStatus;
  sort: GroupSort;
  page: number;
  /** The group open in the drawer. */
  group?: string;
}

/** Left out of the URL when they hold these, so the plain page has a plain link. */
const DEFAULTS: Partial<Record<keyof ErrorsViewState, string>> = {
  tab: "summary",
  range: DEFAULT_RANGE,
  sort: "lastSeen",
  page: "1",
};

/**
 * Changing anything but these sends the groups table back to page one — the
 * tab included, since Summary and Needs a label page through different lists.
 */
const KEEPS_PAGE = new Set<keyof ErrorsViewState>(["page", "group"]);

function pick<T extends string>(
  allowed: readonly T[],
  value: string | null
): T | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * The Errors page's tab, filters and open group, held in the query string so
 * a view can be shared: "Feed, card errors, last hour" or one group's drawer
 * pasted into Slack opens as the sender saw it. Unknown values are ignored
 * rather than sent on, so a stale link falls back to the defaults.
 */
export function useErrorsViewState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<ErrorsViewState>(() => {
    const range = searchParams.get("range");
    const page = Number.parseInt(searchParams.get("page") ?? "", 10);

    return {
      tab: pick(TABS, searchParams.get("tab")) ?? "summary",
      range: isRangePreset(range) ? range : DEFAULT_RANGE,
      source: pick(ERROR_SOURCES, searchParams.get("source")),
      flow: pick(ERROR_FLOWS, searchParams.get("flow")),
      whoActs: pick(WHO_ACTS, searchParams.get("whoActs")),
      severity: pick(SEVERITIES, searchParams.get("severity")),
      platform: pick(PLATFORMS, searchParams.get("platform")),
      user: searchParams.get("user")?.trim() || undefined,
      q: searchParams.get("q")?.trim() || undefined,
      status: pick(GROUP_STATUSES, searchParams.get("status")),
      sort: pick(SORTS, searchParams.get("sort")) ?? "lastSeen",
      page: Number.isFinite(page) && page > 0 ? page : 1,
      group: searchParams.get("group") || undefined,
    };
  }, [searchParams]);

  const update = useCallback(
    (next: Partial<ErrorsViewState>) => {
      const params = new URLSearchParams(searchParams.toString());
      let resetPage = false;

      for (const [name, value] of Object.entries(next)) {
        const key = name as keyof ErrorsViewState;
        const text = value === undefined ? "" : String(value);
        if (!text || DEFAULTS[key] === text) params.delete(key);
        else params.set(key, text);
        if (!KEEPS_PAGE.has(key)) resetPage = true;
      }
      if (resetPage) params.delete("page");

      const query = params.toString();
      // `scroll: false` — a filter change should not throw the reader back
      // to the top of a long table.
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  return { state, update };
}
