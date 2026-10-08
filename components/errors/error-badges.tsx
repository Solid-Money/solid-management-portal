"use client";

import { formatDistanceStrict } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import {
  ERROR_SOURCE_LABELS,
  GROUP_STATUS_LABELS,
  GROUP_STATUS_VARIANTS,
  labelFor,
  SEVERITY_LABELS,
  SEVERITY_VARIANTS,
  variantFor,
  WHO_ACTS_HINTS,
  WHO_ACTS_LABELS,
  WHO_ACTS_VARIANTS,
} from "@/lib/errors";
import { cn, formatDateTime } from "@/lib/utils";
import type {
  ErrorGroupStatus,
  ErrorSource,
  Severity,
  WhoActs,
} from "@/types/errors";

/*
 * Every badge carries its meaning in words; colour only helps the eye find
 * the engineering and critical ones in a long list.
 */

export function WhoActsBadge({ whoActs }: { whoActs: WhoActs }) {
  return (
    <Badge
      variant={variantFor(WHO_ACTS_VARIANTS, whoActs)}
      title={WHO_ACTS_HINTS[whoActs]}
    >
      {labelFor(WHO_ACTS_LABELS, whoActs)}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant={variantFor(SEVERITY_VARIANTS, severity)}>
      {labelFor(SEVERITY_LABELS, severity)}
    </Badge>
  );
}

export function GroupStatusBadge({
  status,
  mutedUntil,
}: {
  status: ErrorGroupStatus;
  mutedUntil?: string | null;
}) {
  return (
    <Badge
      variant={variantFor(GROUP_STATUS_VARIANTS, status)}
      title={
        status === "muted" && mutedUntil
          ? `Muted until ${formatDateTime(mutedUntil)}`
          : undefined
      }
    >
      {labelFor(GROUP_STATUS_LABELS, status)}
    </Badge>
  );
}

export function ErrorSourceBadge({
  source,
  small = false,
}: {
  source: ErrorSource;
  /** For the "also seen in" list under the main source. */
  small?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(small && "px-1.5 py-0 text-[10px] text-gray-500")}
    >
      {labelFor(ERROR_SOURCE_LABELS, source)}
    </Badge>
  );
}

/** A group nobody has explained yet: its title and action are placeholders. */
export function NewErrorBadge() {
  return (
    <Badge variant="info" title="New error, not yet explained — needs a label">
      New
    </Badge>
  );
}

/**
 * "5 minutes ago", from the shared minute clock, with the exact time on hover.
 * Shows the date itself until the page has hydrated and has a clock to read.
 */
export function RelativeTime({
  iso,
  className,
}: {
  iso?: string | null;
  className?: string;
}) {
  const now = useMinuteClock();
  const date = iso ? new Date(iso) : null;

  if (!iso || !date || Number.isNaN(date.getTime())) {
    return <span className="text-gray-400">—</span>;
  }

  let label: string;
  if (now === null) label = formatDateTime(date);
  // The clock is up to a minute behind, so anything within it is "just now"
  // rather than "in 20 seconds".
  else if (now - date.getTime() < 60_000) label = "just now";
  else label = `${formatDistanceStrict(date, now)} ago`;

  return (
    <time dateTime={iso} title={formatDateTime(date)} className={className}>
      {label}
    </time>
  );
}
