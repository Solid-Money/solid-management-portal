"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_TABS,
  analyticsHref,
  analyticsTab,
  resolveSubTab,
} from "@/lib/analytics-navigation";
import {
  DATE_PRESETS,
  presetRange,
  useAnalyticsFilters,
} from "@/components/analytics/analytics-filters";

/** Segment filters, kept in one list so the row is data-driven. */
const SEGMENT_FILTERS = [
  {
    key: "rail" as const,
    label: "Rail",
    options: [
      { value: "rain", label: "Rain" },
      { value: "wirex", label: "Wirex" },
    ],
  },
  {
    key: "platform" as const,
    label: "Platform",
    options: [
      { value: "web", label: "Web" },
      { value: "android", label: "Android" },
      { value: "ios", label: "iOS" },
    ],
  },
  {
    key: "tier" as const,
    label: "Tier",
    options: [
      { value: "core", label: "Core" },
      { value: "prime", label: "Prime" },
      { value: "ultra", label: "Ultra" },
    ],
  },
];

export function AnalyticsHeader() {
  const pathname = usePathname();
  const activeTabId = pathname.split("/")[2] ?? "overview";
  const activeTab = analyticsTab(activeTabId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2">
            <BarChart3 className="h-6 w-6 text-indigo-600" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500">
              {activeTab?.question ??
                "One definition of every number, in one place."}
            </p>
          </div>
        </div>

        <Link
          href="/analytics/glossary"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          Glossary
        </Link>
      </div>

      <TabBar activeTabId={activeTabId} />
      <FilterRow />
    </div>
  );
}

function TabBar({ activeTabId }: { activeTabId: string }) {
  return (
    <nav
      aria-label="Analytics sections"
      className="-mb-px flex flex-wrap gap-1 border-b border-gray-200"
    >
      {ANALYTICS_TABS.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <Link
            key={tab.id}
            href={analyticsHref(tab)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Date range, compare toggle and segment filters.
 *
 * Persisted in the URL and rendered once in the layout rather than per page, so
 * switching tabs keeps the slice — the filters are a property of what you are
 * looking at, not of which tab you are on.
 */
function FilterRow() {
  const { filters, setFilters } = useAnalyticsFilters();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-1">
        {DATE_PRESETS.map((preset) => {
          const range = presetRange(preset);
          const isActive =
            filters.startDate === range.startDate &&
            filters.endDate === range.endDate;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setFilters(range)}
              className={cn(
                "cursor-pointer rounded px-2.5 py-1 text-sm transition-colors",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <input
          type="date"
          value={filters.startDate}
          max={filters.endDate}
          onChange={(event) => setFilters({ startDate: event.target.value })}
          className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-700"
          aria-label="Start date"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={filters.endDate}
          min={filters.startDate}
          onChange={(event) => setFilters({ endDate: event.target.value })}
          className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-700"
          aria-label="End date"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={filters.compare}
          onChange={(event) => setFilters({ compare: event.target.checked })}
          className="cursor-pointer rounded border-gray-300"
        />
        Compare to previous period
      </label>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {SEGMENT_FILTERS.map((filter) => (
          <select
            key={filter.key}
            value={filters[filter.key] ?? ""}
            onChange={(event) =>
              setFilters({ [filter.key]: event.target.value || undefined })
            }
            className="cursor-pointer rounded border border-gray-200 px-2 py-1 text-sm text-gray-700"
            aria-label={`${filter.label} filter`}
          >
            <option value="">All {filter.label.toLowerCase()}s</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}

/**
 * The sub-tab bar for a tab.
 *
 * Rendered by each page rather than the layout, because the layout is a server
 * component boundary and the active sub-tab is a search param — reading it here
 * keeps the pages free of their own routing code.
 */
export function SubTabBar({ tabId }: { tabId: string }) {
  const searchParams = useSearchParams();
  const tab = analyticsTab(tabId);
  if (!tab || tab.subTabs.length === 0) return null;

  const active = resolveSubTab(tab, searchParams.get("tab") ?? undefined);

  return (
    <nav aria-label={`${tab.label} views`} className="flex flex-wrap gap-1">
      {tab.subTabs.map((subTab) => {
        const isActive = subTab.id === active?.id;
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", subTab.id);

        return (
          <Link
            key={subTab.id}
            href={`/analytics/${tab.id}?${params.toString()}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            {subTab.label}
            {subTab.pending ? (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-400">
                P{subTab.pending.phase}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
