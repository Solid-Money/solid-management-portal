"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useOverview } from "@/hooks/use-overview";
import { describeApiError } from "@/lib/api";
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

  const apply = (next: OverviewRangeState) => {
    const query = rangeQuery(next, today);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
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
  );
}

function PageSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-6 animate-spin text-gray-400" />
    </div>
  );
}
