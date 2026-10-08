"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Loader2, Pencil, User } from "lucide-react";
import { toast } from "sonner";

import {
  ErrorSourceBadge,
  GroupStatusBadge,
  NewErrorBadge,
  RelativeTime,
  SeverityBadge,
  WhoActsBadge,
} from "@/components/errors/error-badges";
import { LabelForm, TriagePanel } from "@/components/errors/error-group-forms";
import UserLink from "@/components/user-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CopyableValue } from "@/components/ui/copy-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  amplitudeUrl,
  ERROR_FLOW_LABELS,
  ERROR_KEYS,
  getErrorEvents,
  getErrorGroup,
  glitchtipIssueUrl,
  grafanaExploreUrl,
  labelFor,
  patchCachedGroup,
  PLATFORM_LABELS,
  rangeLabel,
  resolveRange,
  updateErrorGroup,
  type ErrorEventsQuery,
  type RangePreset,
} from "@/lib/errors";
import { temporalWorkflowUrl } from "@/lib/temporal";
import { cn, formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import { CHAIN_NAMES } from "@/types/deposit-fees";
import type {
  ErrorEventRow,
  ErrorGroupDetail,
  UpdateErrorGroupBody,
} from "@/types/errors";

/** Occurrences listed in the drawer: the first page, enough to see a pattern. */
const RECENT_LIMIT = 10;

const count = (value: number) => formatNumber(value, 0, 0);

interface ErrorDrawerProps {
  /** The group to show; null keeps the drawer closed. */
  fingerprint: string | null;
  range: RangePreset;
  /** The occurrence it was opened from, shown and highlighted. */
  occurrence?: ErrorEventRow | null;
  /** Opened from the "Needs a label" queue: the label form comes first. */
  labelMode?: boolean;
  onClose: () => void;
}

/**
 * One error group, in a panel over the page: what to do about it first, then
 * the evidence — one occurrence in full, links into the tools that hold the
 * rest, who it hits and where — and the controls to triage and label it.
 */
export function ErrorDrawer({
  fingerprint,
  range,
  occurrence = null,
  labelMode = false,
  onClose,
}: ErrorDrawerProps) {
  return (
    <Sheet
      open={fingerprint !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent>
        {fingerprint && (
          <DrawerBody
            key={`${fingerprint}:${occurrence?.id ?? ""}`}
            fingerprint={fingerprint}
            range={range}
            occurrence={occurrence}
            labelMode={labelMode}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

const isLabelUpdate = (body: UpdateErrorGroupBody) =>
  body.title !== undefined ||
  body.action !== undefined ||
  body.whoActs !== undefined ||
  body.severity !== undefined;

function describeUpdate(body: UpdateErrorGroupBody): string {
  if (isLabelUpdate(body)) return "Label saved";
  switch (body.status) {
    case "acknowledged":
      return "Acknowledged";
    case "resolved":
      return "Marked as resolved";
    case "muted":
      return "Muted for 24 hours";
    case "open":
      return "Reopened";
    default:
      return "Saved";
  }
}

function DrawerBody({
  fingerprint,
  range,
  occurrence,
  labelMode,
}: {
  fingerprint: string;
  range: RangePreset;
  occurrence: ErrorEventRow | null;
  labelMode: boolean;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ErrorEventRow | null>(occurrence);
  // From the label queue the form leads, until the label is saved.
  const [labelFirst, setLabelFirst] = useState(labelMode);
  const [editingLabel, setEditingLabel] = useState(false);

  const { data: group, isLoading, isError } = useQuery({
    queryKey: ERROR_KEYS.group(fingerprint, range),
    queryFn: () => getErrorGroup(fingerprint, resolveRange(range)),
  });

  const recentQuery: ErrorEventsQuery = {
    range,
    fingerprint,
    limit: RECENT_LIMIT,
  };
  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ERROR_KEYS.events(recentQuery),
    queryFn: () => getErrorEvents(recentQuery, resolveRange(range)),
  });

  const mutation = useMutation({
    mutationFn: (body: UpdateErrorGroupBody) =>
      updateErrorGroup(fingerprint, body),
    onSuccess: (row, body) => {
      // Only what triage and labelling change: the row's counts are for the
      // server's default window, not necessarily the one on screen.
      patchCachedGroup(queryClient, fingerprint, (cached) => ({
        ...cached,
        title: row.title,
        action: row.action,
        whoActs: row.whoActs,
        severity: row.severity,
        labelled: row.labelled,
        status: row.status,
        mutedUntil: row.mutedUntil,
        owner: row.owner,
        note: row.note,
        updatedBy: row.updatedBy,
      }));
      // Labels change how every occurrence reads, and status changes move
      // the tiles; re-read the lot.
      void queryClient.invalidateQueries({ queryKey: ERROR_KEYS.all });
      toast.success(describeUpdate(body));
      if (isLabelUpdate(body)) {
        setLabelFirst(false);
        setEditingLabel(false);
      }
    },
    onError: () => {
      // The API layer already toasts the server's message; the form keeps
      // what was typed so it can be retried.
    },
  });

  if (isLoading) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Loading error…</SheetTitle>
          <SheetDescription className="sr-only">
            Loading this error group
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </>
    );
  }

  if (isError || !group) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Error group</SheetTitle>
          <SheetDescription className="sr-only">
            This error group could not be loaded
          </SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Error loading this error group. Please try again.
          </div>
        </div>
      </>
    );
  }

  const recentRows = recent?.data ?? [];
  // The occurrence the evidence is about: the one clicked, else the latest.
  const focus = selected ?? recentRows[0] ?? null;
  const saving = mutation.isPending;
  const update = (body: UpdateErrorGroupBody) => mutation.mutate(body);

  return (
    <>
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={group.severity} />
          <WhoActsBadge whoActs={group.whoActs} />
          <GroupStatusBadge status={group.status} mutedUntil={group.mutedUntil} />
          {!group.labelled && <NewErrorBadge />}
        </div>
        <SheetTitle>{group.title}</SheetTitle>
        <SheetDescription>
          {labelFor(ERROR_FLOW_LABELS, group.flow)} ·{" "}
          {count(group.countInRange)} in the {rangeLabel(range).toLowerCase()} (
          {count(group.count)} all-time) · {count(group.usersInRange)}{" "}
          {group.usersInRange === 1 ? "user" : "users"} · first seen{" "}
          <RelativeTime iso={group.firstSeen} />
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {labelFirst && (
          <LabelForm group={group} saving={saving} onUpdate={update} autoFocus />
        )}

        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            What to do
          </h3>
          <p className="mt-1 text-sm text-emerald-950">{group.action}</p>
        </section>

        <TechnicalDetail group={group} occurrence={focus} />

        {focus && (
          <OccurrenceDetail row={focus} chosen={selected !== null} />
        )}

        <OpenIn occurrence={focus} />

        <Section title="Triage">
          <TriagePanel group={group} saving={saving} onUpdate={update} />
        </Section>

        {!labelFirst &&
          (!group.labelled || editingLabel ? (
            <LabelForm
              group={group}
              saving={saving}
              onUpdate={update}
              onCancel={group.labelled ? () => setEditingLabel(false) : undefined}
            />
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setEditingLabel(true)}
            >
              <Pencil />
              Edit label
            </Button>
          ))}

        <TopUsers group={group} />
        <Breakdown group={group} />

        <Section title="Recent occurrences">
          {recentLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          ) : recentRows.length === 0 ? (
            <p className="text-sm text-gray-500">None in this window.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
              {recentRows.map((row) => {
                const isSelected = row.id === focus?.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      aria-current={isSelected || undefined}
                      className={cn(
                        "flex w-full cursor-pointer items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50",
                        isSelected && "bg-indigo-50 hover:bg-indigo-50"
                      )}
                    >
                      <span>
                        <span className="tabular-nums text-gray-900">
                          {formatDateTime(row.ts)}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {[
                            row.platform && labelFor(PLATFORM_LABELS, row.platform),
                            row.appVersion,
                            row.step,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </span>
                      <span className="text-right text-xs text-gray-600">
                        {row.username ||
                          (row.claimedUsername
                            ? `typed: ${row.claimedUsername}`
                            : "Unknown user")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The raw text, for whoever has to fix it. Collapsed by default and never
 * opened for you: it is what the plain-English title exists to replace.
 */
function TechnicalDetail({
  group,
  occurrence,
}: {
  group: ErrorGroupDetail;
  occurrence: ErrorEventRow | null;
}) {
  const [open, setOpen] = useState(false);
  const message = occurrence?.message ?? group.sampleMessage;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900">
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform",
            !open && "-rotate-90"
          )}
        />
        Technical detail
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 text-xs">
          {group.code && (
            <>
              <dt className="text-gray-500">Code</dt>
              <dd className="font-mono text-gray-800">{group.code}</dd>
            </>
          )}
          {occurrence?.service && (
            <>
              <dt className="text-gray-500">Service</dt>
              <dd className="font-mono text-gray-800">{occurrence.service}</dd>
            </>
          )}
          <dt className="text-gray-500">Seen in</dt>
          <dd className="flex flex-wrap gap-1">
            {group.sources.map((source) => (
              <ErrorSourceBadge key={source} source={source} small />
            ))}
          </dd>
          <dt className="text-gray-500">Fingerprint</dt>
          <dd className="min-w-0">
            <CopyableValue value={group.fingerprint} label="Fingerprint" truncate />
          </dd>
        </dl>
        <pre className="max-h-72 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-800 whitespace-pre-wrap break-words">
          {message || "No message recorded"}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** One occurrence in full: who, what they saw, and where in the app. */
function OccurrenceDetail({
  row,
  chosen,
}: {
  row: ErrorEventRow;
  /** Picked by the reader, rather than simply the latest. */
  chosen: boolean;
}) {
  const facts: Array<[string, ReactNode]> = [
    [
      "User",
      <UserLink
        key="user"
        userId={row.userId}
        username={row.username}
        claimedUsername={row.claimedUsername}
      />,
    ],
  ];
  if (row.amountUsd !== undefined) facts.push(["Amount", formatUsd(row.amountUsd)]);
  if (row.chainId !== undefined) {
    facts.push(["Chain", CHAIN_NAMES[row.chainId] ?? `Chain ${row.chainId}`]);
  }
  if (row.platform) facts.push(["Platform", labelFor(PLATFORM_LABELS, row.platform)]);
  if (row.appVersion) facts.push(["App version", row.appVersion]);
  if (row.screen) {
    facts.push(["Screen", <span key="screen" className="font-mono text-xs">{row.screen}</span>]);
  }
  if (row.endpoint || row.httpStatus !== undefined) {
    facts.push([
      "Request",
      <span key="request" className="font-mono text-xs">
        {row.httpStatus !== undefined && (
          <Badge variant={row.httpStatus >= 500 ? "danger" : "warning"} className="mr-1.5">
            HTTP {row.httpStatus}
          </Badge>
        )}
        {row.endpoint}
      </span>,
    ]);
  }
  if (row.refs?.activityId) {
    facts.push([
      "Activity",
      <CopyableValue key="activity" value={row.refs.activityId} label="Activity ID" truncate />,
    ]);
  }

  return (
    <section className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-900">
        {chosen ? "This occurrence" : "Latest occurrence"} ·{" "}
        <time dateTime={row.ts} className="normal-case">
          {formatDateTime(row.ts)}
        </time>
      </h3>
      {row.userMessage && (
        <p className="text-sm text-gray-800">
          They were shown: <q className="italic">{row.userMessage}</q>
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-gray-500">{label}</dt>
            <dd className="min-w-0 text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Where the rest of the story is. Each link appears only when the occurrence
 * carries the id it needs and the tool's URL is configured.
 */
function OpenIn({ occurrence }: { occurrence: ErrorEventRow | null }) {
  const refs = occurrence?.refs;
  const links = [
    { label: "Temporal", href: temporalWorkflowUrl(refs?.temporalWorkflowId) },
    { label: "GlitchTip", href: glitchtipIssueUrl(refs?.glitchtipIssueId) },
    { label: "Grafana logs", href: grafanaExploreUrl(refs?.lokiQuery, occurrence?.ts) },
    { label: "Amplitude", href: occurrence?.userId ? amplitudeUrl() : null },
  ].filter((link): link is { label: string; href: string } => !!link.href);

  if (links.length === 0 && !occurrence?.userId) return null;

  return (
    <Section title="Open in">
      <div className="flex flex-wrap gap-2">
        {occurrence?.userId && (
          <Link
            href={`/users/${occurrence.userId}`}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800"
          >
            <User className="h-3 w-3" />
            User profile
          </Link>
        )}
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800"
          >
            <ExternalLink className="h-3 w-3" />
            {link.label}
          </a>
        ))}
      </div>
    </Section>
  );
}

function TopUsers({ group }: { group: ErrorGroupDetail }) {
  if (group.topUsers.length === 0) return null;
  return (
    <Section title="Users hit most">
      <ul className="divide-y divide-gray-100">
        {group.topUsers.map((user) => (
          <li
            key={user.userId}
            className="flex items-center justify-between gap-3 py-1.5 text-sm"
          >
            <UserLink userId={user.userId} username={user.username} />
            <span className="text-xs text-gray-500">
              {count(user.count)}× · last <RelativeTime iso={user.lastSeen} />
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Breakdown({ group }: { group: ErrorGroupDetail }) {
  if (group.byPlatform.length === 0 && group.byAppVersion.length === 0) {
    return null;
  }
  return (
    <Section title="Where it happens">
      {group.byPlatform.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {group.byPlatform.map((entry) => (
            <Badge key={entry.platform} variant="outline">
              {labelFor(PLATFORM_LABELS, entry.platform)} · {count(entry.count)}
            </Badge>
          ))}
        </div>
      )}
      {group.byAppVersion.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {group.byAppVersion.map((entry) => (
            <Badge key={entry.appVersion} variant="muted">
              {entry.appVersion} · {count(entry.count)}
            </Badge>
          ))}
        </div>
      )}
    </Section>
  );
}
