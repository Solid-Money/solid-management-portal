"use client";

import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Gauge, Loader2 } from "lucide-react";

import { RelativeTime } from "@/components/errors/error-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserAppPerformance } from "@/hooks/use-app-performance";
import {
  appLabel,
  balancesAfter,
  balancesPhrase,
  cacheSummary,
  countsLine,
  describeGate,
  formatMs,
  gateHint,
  heldUpByPhrase,
  holdUpDetails,
  platformLabel,
  sampleCounts,
  sampleHeadline,
  sampleNotes,
  sampleTimings,
  sampleTypeLabel,
  sawLabel,
  SEVERITY_TEXT_CLASS,
  severityClass,
  launchKindHint,
  tokenFetchDetails,
  waitMs,
} from "@/lib/app-performance";
import { userSectionHref } from "@/lib/search-index";
import { cn, formatDateTime } from "@/lib/utils";
import type { AppPerformanceSampleView } from "@/types/app-performance";

/** Rows the table shows before "Show all". */
const TABLE_ROWS = 20;
/** Rows the support panel shows; the rest are a click away on the user page. */
const COMPACT_ROWS = 6;

const TH_CLASS =
  "px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap";
const TD_CLASS = "px-2 py-2 align-top whitespace-nowrap";

const capitalize = (text: string) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

/** A cell that explains itself on hover, and looks like it does. */
function Explained({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title || undefined}
      className={cn(
        title && "cursor-help underline decoration-gray-300 decoration-dotted underline-offset-2",
        className
      )}
    >
      {children}
    </span>
  );
}

function BalancesAfterCell({ sample }: { sample: AppPerformanceSampleView }) {
  const { text, severity } = balancesAfter(sample);
  return (
    <span
      className={cn(
        "tabular-nums",
        severity ? SEVERITY_TEXT_CLASS[severity] : "text-gray-500"
      )}
    >
      {text}
    </span>
  );
}

/** Everything else the sample carries, under its row. */
function SampleDetails({ sample }: { sample: AppPerformanceSampleView }) {
  const timings = sampleTimings(sample);
  const gates = [...(sample.gateWaits ?? [])].sort((a, b) => b.ms - a.ms);
  const queries = [...(sample.slowQueries ?? [])].sort((a, b) => b.ms - a.ms);
  const tokens = tokenFetchDetails(sample.tokenFetch);
  const notes = sampleNotes(sample);

  return (
    <div className="space-y-3 text-xs">
      <p className="font-medium text-gray-900">{sampleHeadline(sample)}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <h4 className="mb-1 font-semibold text-gray-700">Timings</h4>
          {timings.length ? (
            <dl className="space-y-0.5">
              {timings.map((row) => (
                <div key={row.label} className="flex justify-between gap-3">
                  <dt className="text-gray-500">{row.label}</dt>
                  <dd className="tabular-nums text-gray-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-gray-400">None reported</p>
          )}
        </div>

        <div>
          <h4 className="mb-1 font-semibold text-gray-700">Waited on</h4>
          {gates.length ? (
            <ul className="space-y-0.5">
              {gates.map((wait) => (
                <li key={wait.gate} className="flex justify-between gap-3">
                  <span className="text-gray-500" title={gateHint(wait.gate)}>
                    {describeGate(wait.gate)}
                  </span>
                  <span className={cn("tabular-nums", severityClass(wait.ms))}>
                    {formatMs(wait.ms)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">Nothing held balances up</p>
          )}
          {queries.length > 0 && (
            <>
              <h4 className="mt-2 mb-1 font-semibold text-gray-700">Slow queries</h4>
              <ul className="space-y-0.5">
                {queries.map((query, index) => (
                  <li key={`${query.key}-${index}`} className="flex justify-between gap-3">
                    <span className="truncate font-mono text-gray-500" title={query.key}>
                      {query.key}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-900">
                      {formatMs(query.ms)}
                      {query.failed && <span className="ml-1 text-red-700">failed</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          <h4 className="mb-1 font-semibold text-gray-700">Wallet token fetch</h4>
          {tokens.length ? (
            <ul className="space-y-0.5 text-gray-700">
              {tokens.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">Not reported</p>
          )}
        </div>

        <div>
          <h4 className="mb-1 font-semibold text-gray-700">Context</h4>
          <ul className="space-y-0.5 text-gray-700">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
            <li>
              <span className="text-gray-500">Happened </span>
              {formatDateTime(sample.occurredAt, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23",
              })}
            </li>
            <li>
              <span className="text-gray-500">Received </span>
              {formatDateTime(sample.receivedAt, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23",
              })}
            </li>
            {sample.updateId && (
              <li className="break-all">
                <span className="text-gray-500">Update </span>
                <span className="font-mono">{sample.updateId}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SamplesTable({ samples }: { samples: AppPerformanceSampleView[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className={cn(TH_CLASS, "w-6")}>
              <span className="sr-only">Details</span>
            </th>
            <th className={TH_CLASS}>When</th>
            <th className={TH_CLASS}>Platform</th>
            <th className={TH_CLASS}>Type</th>
            <th className={TH_CLASS} title="Until the home screen showed balances">
              Balances after
            </th>
            <th className={TH_CLASS} title="Until every balance was refreshed">
              Fresh
            </th>
            <th className={TH_CLASS}>What the user saw</th>
            <th className={TH_CLASS} title="Whether the saved balances were restored at launch">
              Cache
            </th>
            <th className={TH_CLASS}>Held up by</th>
            <th className={TH_CLASS}>App</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {samples.map((sample) => {
            const expanded = open === sample.id;
            const toggle = () => setOpen(expanded ? null : sample.id);
            const saw = sawLabel(sample);
            const cache = cacheSummary(sample);
            const holdUp = [gateHint(sample.slowestGate), ...holdUpDetails(sample)]
              .filter(Boolean)
              .join("\n");
            const Chevron = expanded ? ChevronDown : ChevronRight;
            const detailsId = `app-perf-details-${sample.id}`;

            return (
              <Fragment key={sample.id}>
                {/* The row also toggles on click; the button is the control. */}
                <tr
                  onClick={toggle}
                  className={cn(
                    "cursor-pointer hover:bg-gray-50",
                    expanded && "bg-gray-50"
                  )}
                >
                  <td className={cn(TD_CLASS, "pr-0 text-gray-400")}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={expanded ? detailsId : undefined}
                      aria-label={`${expanded ? "Hide" : "Show"} details: ${sampleHeadline(sample)}`}
                      onClick={(event) => {
                        // The row's own click would toggle it back.
                        event.stopPropagation();
                        toggle();
                      }}
                      className="rounded p-0.5 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-indigo-500"
                    >
                      <Chevron className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </td>
                  <td className={cn(TD_CLASS, "text-gray-900")}>
                    <RelativeTime iso={sample.occurredAt} />
                    {sample.clockSkewed && (
                      <div
                        className="text-[10px] text-amber-700"
                        title="The device clock looked wrong, so this time may be off"
                      >
                        device clock off
                      </div>
                    )}
                  </td>
                  <td className={cn(TD_CLASS, "text-gray-700")}>
                    {platformLabel(sample.platform)}
                  </td>
                  <td className={cn(TD_CLASS, "text-gray-900")}>
                    <Explained title={launchKindHint(sample.launchKind)}>
                      {sampleTypeLabel(sample)}
                    </Explained>
                  </td>
                  <td className={TD_CLASS}>
                    <BalancesAfterCell sample={sample} />
                  </td>
                  <td className={cn(TD_CLASS, "tabular-nums", severityClass(sample.freshMs))}>
                    {formatMs(sample.freshMs)}
                  </td>
                  <td className={cn(TD_CLASS, "text-gray-700")}>
                    {saw ? <Explained title={saw.title}>{saw.label}</Explained> : "—"}
                  </td>
                  <td className={cn(TD_CLASS, "text-gray-700")}>
                    {cache ? (
                      <Explained title={cache.title}>{cache.label}</Explained>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={cn(TD_CLASS, "text-gray-700")}>
                    <Explained title={holdUp}>
                      {describeGate(sample.slowestGate)}
                    </Explained>
                  </td>
                  <td className={cn(TD_CLASS, "text-gray-700")}>
                    <span title={sample.updateId}>{appLabel(sample)}</span>
                  </td>
                </tr>
                {expanded && (
                  <tr id={detailsId} className="bg-gray-50">
                    <td />
                    <td colSpan={9} className="px-2 pt-1 pb-3">
                      <SampleDetails sample={sample} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The support panel's version: a line or two per sample, no table to scroll. */
function SamplesList({ samples }: { samples: AppPerformanceSampleView[] }) {
  return (
    <ul className="divide-y divide-gray-100">
      {samples.map((sample) => {
        const held = heldUpByPhrase(sample);
        return (
          <li key={sample.id} className="py-2 text-xs" title={holdUpDetails(sample).join("\n") || undefined}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium text-gray-900">
                {platformLabel(sample.platform)} · {sampleTypeLabel(sample)}
              </span>
              <RelativeTime iso={sample.occurredAt} className="shrink-0 text-gray-500" />
            </div>
            <div className="mt-0.5 text-gray-600">
              <span className={cn("tabular-nums", severityClass(waitMs(sample)))}>
                {capitalize(balancesPhrase(sample))}
              </span>
              {held && ` · ${held}`}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * How long this user's home screen took to show balances — at launch and on
 * coming back to the app — and what held it up: the answer to "the app is
 * stuck loading" before anyone asks them for a screen recording.
 *
 * `compact` is the support inbox's narrow side panel: the latest few as
 * lines, with the full table a link away on the user page.
 */
export default function UserAppPerformanceCard({
  userId,
  compact = false,
}: {
  userId: string;
  compact?: boolean;
}) {
  const { data, isLoading, isError } = useUserAppPerformance(userId);
  const [showAll, setShowAll] = useState(false);
  const samples = data ?? [];
  const limit = compact ? COMPACT_ROWS : TABLE_ROWS;
  const shown = showAll && !compact ? samples : samples.slice(0, limit);
  const counts = sampleCounts(samples);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-gray-400" />
          App performance
        </CardTitle>
        {compact ? (
          <Link
            href={userSectionHref(userId, "support", "user-app-performance")}
            className="text-xs text-indigo-600 hover:underline"
          >
            All details
          </Link>
        ) : (
          <Link
            href="/app-performance"
            className="text-xs text-indigo-600 hover:underline"
          >
            Across all users
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          </div>
        ) : isError ? (
          <p className="text-xs text-red-600">App performance could not be loaded.</p>
        ) : samples.length === 0 ? (
          <p className="text-xs text-gray-500">
            No launch or resume timings for this user yet. Only app versions
            that report them send any.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-gray-700">
                <span className="text-gray-500">Latest {samples.length}: </span>
                {countsLine(counts)}
              </p>
              {!compact && (
                <p className="text-xs text-gray-500">
                  Time from launch, or from coming back to the app, until the
                  home screen showed balances.{" "}
                  <span className={SEVERITY_TEXT_CLASS.bad}>Over 10s</span> in
                  red, <span className={SEVERITY_TEXT_CLASS.slow}>5–10s</span>{" "}
                  in amber. Fast resumes are only sometimes reported, so this
                  list leans towards the slow ones. Click a row for the full
                  breakdown.
                </p>
              )}
            </div>

            {compact ? (
              <SamplesList samples={shown} />
            ) : (
              <SamplesTable samples={shown} />
            )}

            {!compact && samples.length > TABLE_ROWS && (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline"
              >
                {showAll
                  ? `Show the latest ${TABLE_ROWS}`
                  : `Show all ${samples.length}`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
