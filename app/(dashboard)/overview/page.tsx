"use client";

import { Suspense, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useOverview } from "@/hooks/use-overview";
import { useUrlTab } from "@/hooks/use-url-tab";
import { describeApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  parseRange,
  rangeQuery,
  rangeSentence,
  utcToday,
  type OverviewRangeState,
} from "@/lib/overview-range";
import { OverviewDateRangePicker } from "@/components/overview/date-range-picker";
import { AttentionCard } from "@/components/overview/attention-card";
import { KpiTiles } from "@/components/overview/kpi-tiles";
import { SpendChart } from "@/components/overview/spend-chart";
import { NewUsersCard } from "@/components/overview/new-users-card";
import { MoneyInCard } from "@/components/overview/money-in-card";
import { SupportPulse } from "@/components/overview/support-pulse";
import { OverviewFooter } from "@/components/overview/overview-footer";
import { GoodCustomersTab } from "@/components/overview/good-customers";
import { IncentivesTab } from "@/components/overview/incentives/incentives-tab";

const OVERVIEW_TABS = ["summary", "good-customers", "incentives"] as const;
type OverviewTab = (typeof OVERVIEW_TABS)[number];
const TAB_LABELS: Record<OverviewTab, string> = {
  summary: "Summary",
  "good-customers": "Good customers",
  incentives: "Incentives",
};
/** The tab marked "New" until people know it is there. */
const NEW_TAB: OverviewTab = "incentives";

/**
 * The admin landing page: what changed in the picked range, what is broken and
 * what looks like abuse, each with a real number that links to its rows.
 */
export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <OverviewView />
    </Suspense>
  );
}

function OverviewView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = utcToday();
  const range = parseRange(searchParams, today);
  const { data, error, isLoading, isFetching, refetch } = useOverview(range.from, range.to);
  const [tab, setTab] = useUrlTab(OVERVIEW_TABS, "summary");

  // A new range keeps the open tab.
  const apply = (next: OverviewRangeState) => {
    const params = new URLSearchParams(rangeQuery(next, today));
    if (tab !== "summary") params.set("tab", tab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // Arrow keys, Home and End move between tabs, as the WAI tabs pattern has it.
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, from: OverviewTab) => {
    const key = event.key;
    const index = OVERVIEW_TABS.indexOf(from);
    const last = OVERVIEW_TABS.length - 1;
    const next =
      key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : key === "Home" ? 0
      : key === "End" ? last
      : null;
    if (next === null) return;
    // Home/End would scroll the page and arrows the tab strip; these keys only move between tabs.
    event.preventDefault();
    const target = OVERVIEW_TABS[next];
    setTab(target);
    document.getElementById(`overview-tab-${target}`)?.focus();
  };

  return (
    <div className="mx-auto flex max-w-[1376px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.3px] text-gray-900">Overview</h1>
          <p className="mt-1 text-[13px] text-gray-500">{rangeSentence(range, today)}</p>
        </div>
        <div className="flex items-center gap-3">
          {data ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`size-[7px] rounded-full ${isFetching ? "bg-amber-400" : "bg-[#16a34a]"}`} />
              {isFetching ? "Updating…" : `Live · updated ${data.generatedAt.slice(11, 16)} UTC`}
            </span>
          ) : null}
          <OverviewDateRangePicker value={range} today={today} onApply={apply} />
        </div>
      </header>

      <div
        role="tablist"
        className="-mt-1 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_#e6e8ee] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {OVERVIEW_TABS.map((t) => (
          <button
            key={t}
            id={`overview-tab-${t}`}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={`overview-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(event) => moveTab(event, t)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 pt-1.5 pb-2.5 text-[13.5px] whitespace-nowrap",
              tab === t
                ? "border-gray-900 font-semibold text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {TAB_LABELS[t]}
            {t === NEW_TAB ? (
              <span className="rounded-full bg-[#eef0ff] px-1.5 text-[10.5px] font-semibold text-[#3b3bd6]">
                New
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "good-customers" ? (
        <div
          role="tabpanel"
          id="overview-panel-good-customers"
          aria-labelledby="overview-tab-good-customers"
        >
          <GoodCustomersTab from={range.from} to={range.to} />
        </div>
      ) : null}

      {tab === "incentives" ? (
        <div
          role="tabpanel"
          id="overview-panel-incentives"
          aria-labelledby="overview-tab-incentives"
        >
          <IncentivesTab from={range.from} to={range.to} compare={range.compare} />
        </div>
      ) : null}

      {tab === "summary" ? (
        <div
          role="tabpanel"
          id="overview-panel-summary"
          aria-labelledby="overview-tab-summary"
          className="flex flex-col gap-5"
        >
          <AttentionCard />

          {error && !data ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              The Overview could not load: {describeApiError(error)}.{" "}
              <button type="button" onClick={() => void refetch()} className="font-medium underline">
                Try again
              </button>
            </div>
          ) : null}

          {isLoading && !data ? <PageSpinner /> : null}

          {data ? (
            <>
              <KpiTiles data={data} compare={range.compare} />
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <SpendChart data={data} />
                </div>
                <NewUsersCard data={data} compare={range.compare} />
              </div>
              <MoneyInCard data={data} compare={range.compare} />
              <SupportPulse data={data} compare={range.compare} />
              <OverviewFooter data={data} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PageSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-6 animate-spin text-gray-400" />
    </div>
  );
}
