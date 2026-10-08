"use client";

import { useMemo, type RefObject } from "react";

import {
  ErrorEventsTable,
  LoadMoreFooter,
} from "@/components/errors/error-events-table";
import {
  MAX_LIVE_ROWS,
  mergeFeedRows,
  type LiveFeedState,
} from "@/components/errors/live-feed-state";
import { useErrorEventPages } from "@/hooks/use-error-event-pages";
import {
  ERROR_KEYS,
  getErrorEvents,
  type ErrorEventsQuery,
} from "@/lib/errors";
import { formatNumber } from "@/lib/utils";
import type { ErrorEventRow } from "@/types/errors";

interface ErrorFeedProps {
  filters: ErrorEventsQuery;
  live: LiveFeedState;
  liveOn: boolean;
  /** The feed's top, which decides whether a live row goes straight in. */
  containerRef: RefObject<HTMLDivElement | null>;
  onShowPending: () => void;
  onRefresh: () => void;
  onOpen: (row: ErrorEventRow) => void;
}

/**
 * Every error as it happens, newest first: the server's pages for the
 * filters, with what the socket has delivered since on top.
 */
export function ErrorFeed({
  filters,
  live,
  liveOn,
  containerRef,
  onShowPending,
  onRefresh,
  onOpen,
}: ErrorFeedProps) {
  const { query, rows: serverRows } = useErrorEventPages(
    ERROR_KEYS.events(filters),
    filters.range,
    (window, cursor) => getErrorEvents(filters, window, cursor)
  );

  const rows = useMemo(
    () => mergeFeedRows(live.rows, serverRows),
    [live.rows, serverRows]
  );

  const pending = live.pending.length;

  return (
    <div ref={containerRef} className="scroll-mt-4">
      <ErrorEventsTable
        rows={rows}
        isLoading={query.isLoading}
        isError={query.isError}
        emptyMessage={
          liveOn
            ? "No errors in this window. New ones will appear here as they happen."
            : "No errors in this window"
        }
        onOpen={onOpen}
        fresh={live.fresh}
        header={
          <>
            {/* Polite: a burst of errors should not talk over a screen reader.
                Sticky, so the count follows the reader down the feed. */}
            <div aria-live="polite" className="sticky top-2 z-10">
              {pending > 0 && (
                <div className="pointer-events-none flex justify-center py-2">
                  <button
                    type="button"
                    onClick={onShowPending}
                    className="pointer-events-auto cursor-pointer rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow hover:bg-indigo-700"
                  >
                    ↑ {pending >= MAX_LIVE_ROWS ? `${MAX_LIVE_ROWS}+` : pending}{" "}
                    new {pending === 1 ? "error" : "errors"}
                  </button>
                </div>
              )}
            </div>
            <div aria-live="polite">
              {live.burst && (
                <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
                  +{formatNumber(live.burst.dropped, 0, 0)} more errors in the
                  last {live.burst.windowSec}s were rate-limited —{" "}
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="cursor-pointer underline hover:text-gray-700"
                  >
                    refresh to see all
                  </button>
                </p>
              )}
            </div>
          </>
        }
        footer={
          <LoadMoreFooter
            shown={rows.length}
            hasMore={query.hasNextPage}
            isLoadingMore={query.isFetchingNextPage}
            onLoadMore={() => void query.fetchNextPage()}
          />
        }
      />
    </div>
  );
}
