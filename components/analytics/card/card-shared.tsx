"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import {
  RAIL_COLORS,
  RAIL_LABELS,
  type CardPayoutStatus,
  type CardRail,
} from "@/types/card-analytics";

/** A fraction as a percentage, or a dash when there is nothing to divide. */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** A count, en-US, no decimals. */
export function formatCount(value: number): string {
  return formatNumber(value, 0, 0);
}

/** `YYYY-MM` as "Sep 2026", read in UTC so a month never shifts by a day. */
export function formatMonth(billingMonth: string): string {
  return formatDateTime(`${billingMonth}-01T00:00:00Z`, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A `YYYY-MM-DD` bucket as an axis label, in UTC to match how it was grouped. */
export function formatDay(value: string, withYear = false): string {
  return formatDateTime(`${value}T00:00:00Z`, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** The rail's name beside its series swatch — identity is never colour alone. */
export function RailLabel({ rail, className }: { rail: CardRail; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: RAIL_COLORS[rail] }}
        aria-hidden
      />
      {RAIL_LABELS[rail]}
    </span>
  );
}

const PAYOUT_STATUS: Record<
  CardPayoutStatus,
  { label: string; variant: "success" | "info" | "warning" | "danger" | "muted" }
> = {
  accruing: { label: "Accruing", variant: "info" },
  awaiting_report: { label: "Awaiting report", variant: "warning" },
  awaiting_payout: { label: "Awaiting payout", variant: "warning" },
  overdue: { label: "Overdue", variant: "danger" },
  received: { label: "Received", variant: "success" },
  received_variance: { label: "Received — variance", variant: "warning" },
  nothing_owed: { label: "Nothing owed", variant: "muted" },
};

export function PayoutStatusBadge({ status }: { status: CardPayoutStatus }) {
  const { label, variant } = PAYOUT_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

/** The empty state a panel shows when the window has nothing in it. */
export function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-gray-400">
      {children}
    </div>
  );
}

/** A compact two-column table for "top N" lists. */
export function RankedTable<T>({
  rows,
  label,
  value,
  secondary,
  headers,
}: {
  rows: T[];
  label: (row: T) => ReactNode;
  value: (row: T) => string;
  secondary?: (row: T) => string;
  headers: [string, string, string?];
}) {
  if (rows.length === 0) return <EmptyPanel>Nothing in this window.</EmptyPanel>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="pb-2 font-medium">{headers[0]}</th>
          <th className="pb-2 text-right font-medium">{headers[1]}</th>
          {secondary ? <th className="pb-2 text-right font-medium">{headers[2]}</th> : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map((row, index) => (
          <tr key={index}>
            <td className="py-1.5 pr-2 text-gray-900">{label(row)}</td>
            <td className="py-1.5 text-right tabular-nums text-gray-900">{value(row)}</td>
            {secondary ? (
              <td className="py-1.5 text-right tabular-nums text-gray-500">
                {secondary(row)}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Daily rows, one per (date, rail), pivoted to one row per date with a column
 * per rail — the shape a stacked bar wants.
 */
export function pivotByRail<R extends { date: string; rail: CardRail }>(
  rows: R[],
  value: (row: R) => number
): Array<Record<string, number | string>> {
  const byDate = new Map<string, Record<string, number | string>>();
  for (const row of rows) {
    const entry = byDate.get(row.date) ?? { date: row.date };
    entry[row.rail] = ((entry[row.rail] as number | undefined) ?? 0) + value(row);
    byDate.set(row.date, entry);
  }
  return [...byDate.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
}

/** The rails present in a set of rows, in display order. */
export function railsIn(rows: Array<{ rail: CardRail }>): CardRail[] {
  const present = new Set(rows.map((row) => row.rail));
  return (["rain", "wirex", "legacy"] as CardRail[]).filter((rail) =>
    present.has(rail)
  );
}
