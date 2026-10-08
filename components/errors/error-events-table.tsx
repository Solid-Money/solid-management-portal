"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { ErrorSourceBadge } from "@/components/errors/error-badges";
import UserLink from "@/components/user-link";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import {
  ERROR_FLOW_LABELS,
  formatEventTime,
  labelFor,
  PLATFORM_LABELS,
} from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { ErrorEventRow } from "@/types/errors";

const TH_CLASS =
  "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";

/** Enter or Space on a focused row opens it; keys from a link inside it do not. */
export function onRowKeyDown(open: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };
}

/** "iOS · 2.4.1" — where the error happened, when the app said. */
function deviceLine(row: ErrorEventRow): string | null {
  const parts = [
    row.platform ? labelFor(PLATFORM_LABELS, row.platform) : null,
    row.appVersion,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

interface ErrorEventsTableProps {
  rows: ErrorEventRow[];
  isLoading: boolean;
  isError: boolean;
  emptyMessage: string;
  onOpen: (row: ErrorEventRow) => void;
  /** Rows just added by the live feed, highlighted for a moment. */
  fresh?: { has: (id: string) => boolean };
  /** On a user's own page: the device in place of the user column. */
  compact?: boolean;
  /** Above the rows: the live feed's notices. */
  header?: ReactNode;
  /** Under the rows: "Load more". */
  footer?: ReactNode;
}

/**
 * Error occurrences, newest first. Each row opens its group in the drawer.
 *
 * Plain English up front — the title the catalog gives the error and the flow
 * it broke — and nothing technical: the raw message is a click away, in the
 * drawer, for whoever needs it.
 */
export function ErrorEventsTable({
  rows,
  isLoading,
  isError,
  emptyMessage,
  onOpen,
  fresh,
  compact = false,
  header,
  footer,
}: ErrorEventsTableProps) {
  const now = useMinuteClock();

  if (isError && rows.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error loading errors. Please try again.
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {header}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={TH_CLASS}>Time</th>
              <th className={TH_CLASS}>{compact ? "Device" : "User"}</th>
              <th className={TH_CLASS}>What happened</th>
              <th className={TH_CLASS}>Source</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const { time, date } = formatEventTime(row.ts, now);
                const device = deviceLine(row);
                const open = () => onOpen(row);

                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={onRowKeyDown(open)}
                    className={cn(
                      // The slow transition is for a live row's highlight
                      // fading out; hover still lands at once.
                      "cursor-pointer align-top transition-colors duration-1000 hover:bg-gray-50 hover:duration-0 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500",
                      fresh?.has(row.id) && "bg-green-50"
                    )}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 tabular-nums">
                      <time dateTime={row.ts}>{time}</time>
                      {date && <div className="text-xs text-gray-500">{date}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {compact ? (
                        <span className="text-gray-700">{device ?? "—"}</span>
                      ) : (
                        <>
                          <UserLink
                            userId={row.userId}
                            username={row.username}
                            claimedUsername={row.claimedUsername}
                          />
                          {device && (
                            <div className="text-xs text-gray-500">{device}</div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">
                        {row.title}
                        {/* `repeat` counts the identical occurrences folded
                            into this row on top of the row itself. */}
                        {row.repeat !== undefined && row.repeat > 0 && (
                          <span
                            className="ml-1.5 text-xs font-normal text-gray-500"
                            title={`${row.repeat + 1} identical errors in a burst, shown once`}
                          >
                            ×{row.repeat + 1}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {labelFor(ERROR_FLOW_LABELS, row.flow)}
                        {row.step && ` · ${row.step}`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <ErrorSourceBadge source={row.source} />
                      {row.alsoSeenIn && row.alsoSeenIn.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-gray-400">also seen in</span>
                          {row.alsoSeenIn.map((source) => (
                            <ErrorSourceBadge key={source} source={source} small />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

/** The foot of a cursor feed: how much is showing, and the next page. */
export function LoadMoreFooter({
  shown,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  shown: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  if (shown === 0) return null;
  return (
    <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
      <div className="text-sm text-gray-500">
        {shown} {shown === 1 ? "error" : "errors"}
        {hasMore ? " so far" : ""}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="inline-flex items-center gap-1.5 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
        >
          {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Load more
        </button>
      )}
    </div>
  );
}
