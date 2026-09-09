import { Suspense, type ReactNode } from "react";
import { AnalyticsFiltersProvider } from "@/components/analytics/analytics-filters";
import { AnalyticsHeader } from "@/components/analytics/analytics-header";

/**
 * The Analytics section shell: header, tab bar and the shared filter state.
 *
 * The filters live here rather than on each page so they survive a tab change —
 * the date range and segment are a property of what you are looking at, not of
 * which tab you happen to be on.
 *
 * `Suspense` because everything below reads search params, which opts those
 * subtrees into client rendering; without a boundary the whole section would
 * have to be dynamic.
 */
export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsFiltersProvider>
        <div className="space-y-6">
          <AnalyticsHeader />
          {children}
        </div>
      </AnalyticsFiltersProvider>
    </Suspense>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 animate-pulse rounded bg-gray-100" />
      <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
      <div className="h-48 w-full animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}
