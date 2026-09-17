"use client";

import { useSyncExternalStore } from "react";
import { formatDistanceStrict } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * A shared clock that ticks once a minute.
 *
 * The badge needs "how old is this data", which means reading the clock — an
 * external mutable source, not a pure input. `useSyncExternalStore` is the
 * sanctioned way to read one: the snapshot is stable between ticks (so renders
 * are idempotent), the server snapshot is null (so nothing is rendered against
 * the build machine's clock), and one interval is shared by every badge on the
 * page rather than one per badge.
 */
const clock = (() => {
  let tick = Date.now();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      timer ??= setInterval(() => {
        tick = Date.now();
        for (const notify of listeners) notify();
      }, 60_000);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    getSnapshot: () => tick,
    /** No clock on the server: the age resolves after hydration. */
    getServerSnapshot: () => null,
  };
})();

/**
 * Where a panel's numbers come from.
 *
 * Mirrors `AnalyticsSource` in the backend so a response can drive the badge
 * directly instead of the label being hardcoded next to the chart — a chart
 * whose source moved and whose badge did not is worse than no badge.
 */
export type AnalyticsSourceId =
  | "database"
  | "amplitude"
  | "brevo"
  | "on-chain"
  | "intercom"
  | "sentry"
  | "rain"
  | "wirex"
  | "manual"
  | "derived";

const SOURCE_LABELS: Record<AnalyticsSourceId, string> = {
  database: "Database",
  amplitude: "Amplitude",
  brevo: "Brevo",
  "on-chain": "On-chain",
  intercom: "Intercom",
  sentry: "Sentry",
  rain: "Rain",
  wirex: "Wirex",
  manual: "Manual",
  derived: "Derived",
};

/**
 * Colour carries no meaning beyond telling the sources apart at a glance, so
 * the label is always present — the badge never relies on hue alone.
 */
const SOURCE_STYLES: Record<AnalyticsSourceId, string> = {
  database: "bg-slate-100 text-slate-700 border-slate-200",
  amplitude: "bg-sky-50 text-sky-700 border-sky-200",
  brevo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "on-chain": "bg-violet-50 text-violet-700 border-violet-200",
  intercom: "bg-blue-50 text-blue-700 border-blue-200",
  sentry: "bg-rose-50 text-rose-700 border-rose-200",
  rain: "bg-indigo-50 text-indigo-700 border-indigo-200",
  wirex: "bg-amber-50 text-amber-800 border-amber-200",
  manual: "bg-orange-50 text-orange-800 border-orange-200",
  derived: "bg-gray-100 text-gray-600 border-gray-200",
};

/** Beyond this, the data is stale enough that the reader should be told. */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

interface SourceBadgeProps {
  source: AnalyticsSourceId;
  /** ISO timestamp of the data itself, not of the request. */
  updatedAt?: string;
  className?: string;
}

export function SourceBadge({ source, updatedAt, className }: SourceBadgeProps) {
  const now = useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot
  );

  const age =
    updatedAt && now !== null ? now - new Date(updatedAt).getTime() : null;
  const isStale = age !== null && Number.isFinite(age) && age > STALE_AFTER_MS;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
          SOURCE_STYLES[source]
        )}
      >
        {SOURCE_LABELS[source]}
      </span>
      {/* Held back until the clock is known, so the server and the first client
          render agree and the age is measured against the reader's own clock. */}
      {updatedAt && now !== null ? (
        <span
          className={cn(
            "text-[11px]",
            // Stale data is called out rather than shown in the same grey as
            // fresh data: the whole reason for the timestamp is to stop someone
            // reading a six-hour-old number as live.
            isStale ? "font-medium text-amber-700" : "text-gray-400"
          )}
          title={new Date(updatedAt).toISOString()}
        >
          {isStale ? "stale · " : ""}
          {relativeAge(updatedAt, now)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * How long ago `updatedAt` was, relative to a caller-supplied `now`.
 *
 * `formatDistanceStrict` rather than `formatDistanceToNowStrict`: the base date
 * is an argument, which keeps this a pure function of its inputs — the same
 * reason the component holds the clock in state instead of reading it during
 * render.
 */
function relativeAge(updatedAt: string, now: number): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDistanceStrict(date, now)} ago`;
}

export default SourceBadge;
