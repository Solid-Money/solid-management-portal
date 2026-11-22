"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useState,
  type ReactNode,
} from "react";
import { Loader2, Tag } from "lucide-react";

import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAppPerformanceFilters,
  useAppPerformanceSummary,
} from "@/hooks/use-app-performance";
import { useDebounce } from "@/hooks/use-debounce";
import {
  APP_PERF_PLATFORMS,
  APP_PERF_RANGES,
  appPerfRangeLabel,
  bySamples,
  DEFAULT_APP_PERF_DAYS,
  describeCacheOutcome,
  describeGate,
  formatMs,
  formatShare,
  gateHint,
  isAppPerfPlatform,
  kindLabel,
  launchKindHint,
  platformHighlights,
  platformLabel,
  PLATFORM_LABELS,
  severity,
  severityClass,
  shareOf,
  sortGroups,
  type AppPerfFilters,
  type PlatformHighlight,
} from "@/lib/app-performance";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import type {
  AppPerformanceGroup,
  AppPerformanceSummary,
} from "@/types/app-performance";

const SELECT_CLASS =
  "block h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

const RANGE_OPTIONS = APP_PERF_RANGES.map((range) => ({
  value: String(range.days),
  label: range.label,
}));

const PLATFORM_OPTIONS = APP_PERF_PLATFORMS.map((platform) => ({
  value: platform,
  label: PLATFORM_LABELS[platform],
}));

const count = (value: number) => formatNumber(Math.round(value), 0, 0);

/** A duration for a tile; undefined (a grey dash) when there is none. */
const tileMs = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? undefined : formatMs(ms);

const tileShare = (share: number | null | undefined) =>
  share === null || share === undefined ? undefined : formatShare(share);

/** A slow or bad percentile tints its tile's border, so the eye finds it. */
const tileTone = (ms: number | null | undefined) => {
  if (ms === null || ms === undefined) return undefined;
  const level = severity(ms);
  return level === "bad"
    ? "border-red-200"
    : level === "slow"
      ? "border-amber-200"
      : undefined;
};

// --- Filters ----------------------------------------------------------------

function SelectField({
  label,
  value,
  options,
  anyLabel,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  /** The "no filter" option; omitted when one of the options must be chosen. */
  anyLabel?: string;
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        className={SELECT_CLASS}
      >
        {anyLabel !== undefined && <option value="">{anyLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The app version filter, committed to the URL once typing settles, so the
 * summary (and the link) follow it without a request per keystroke.
 */
function AppVersionField({
  value,
  onCommit,
}: {
  /** The committed value, from the URL. */
  value: string;
  onCommit: (value: string | undefined) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  // The URL value this field last saw, and the value it last sent there.
  // When the URL changes to anything but that (back/forward, a pasted link),
  // the draft shows the new value; replacing it also restarts the debounce,
  // so a draft typed before the navigation is never committed over it. The
  // field's own commit arriving leaves alone whatever was typed since.
  const [seen, setSeen] = useState(value);
  const [sent, setSent] = useState<string | null>(null);
  if (value !== seen) {
    setSeen(value);
    setSent(null);
    if (value !== sent && draft.trim() !== value) setDraft(value);
  }
  const settled = useDebounce(draft, 400);

  const commit = useEffectEvent((next: string) => {
    const trimmed = next.trim();
    if (trimmed === value) return;
    setSent(trimmed);
    onCommit(trimmed || undefined);
  });

  useEffect(() => {
    commit(settled);
  }, [settled]);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-500">
        App version
      </label>
      <div className="relative">
        <Tag className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          id={id}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Every version, or e.g. 2.1.0"
          className="w-52 bg-white pl-8"
        />
      </div>
    </div>
  );
}

function FiltersBar({
  filters,
  update,
}: {
  filters: AppPerfFilters;
  update: (next: Partial<AppPerfFilters>) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <SelectField
        label="Time"
        value={String(filters.days)}
        options={RANGE_OPTIONS}
        onChange={(days) =>
          update({
            days:
              APP_PERF_RANGES.find((range) => String(range.days) === days)?.days ??
              DEFAULT_APP_PERF_DAYS,
          })
        }
      />
      <SelectField
        label="Platform"
        value={filters.platform}
        options={PLATFORM_OPTIONS}
        anyLabel="All platforms"
        onChange={(platform) =>
          update({ platform: isAppPerfPlatform(platform) ? platform : undefined })
        }
      />
      <AppVersionField
        value={filters.appVersion ?? ""}
        onCommit={(appVersion) => update({ appVersion })}
      />
    </div>
  );
}

// --- Building blocks --------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-6 text-center text-xs text-gray-500">
        {children}
      </TableCell>
    </TableRow>
  );
}

/** A duration cell coloured by how bad it is. */
function MsCell({ ms }: { ms: number | null | undefined }) {
  return (
    <TableCell className={cn("text-right tabular-nums", severityClass(ms))}>
      {formatMs(ms)}
    </TableCell>
  );
}

const NUM_CELL = "text-right tabular-nums text-gray-900";
const NUM_HEAD = "text-right";

// --- Sections ---------------------------------------------------------------

function HowToRead() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
      <p className="mb-1 font-semibold text-gray-700">How to read this</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <strong className="font-medium text-gray-800">Launch</strong>: from the
          splash screen hiding until the home screen shows balances.{" "}
          <strong className="font-medium text-gray-800">Resume</strong>: from
          coming back to the app until balances show — often instantly, because
          they never left the screen.
        </li>
        <li>
          <strong className="font-medium text-gray-800">Balances after</strong>{" "}
          percentiles only cover launches and resumes that actually waited;
          those where balances were already on screen are left out, so they
          describe how long a wait is when there is one. <strong className="font-medium text-gray-800">Fresh</strong>{" "}
          is until every balance was refreshed.
        </li>
        <li>
          Fast resumes are sampled — only some are reported — so shares are
          weighted to stand for every launch and resume.{" "}
          <strong className="font-medium text-gray-800">Samples</strong> counts
          the reports received; <strong className="font-medium text-gray-800">est. total</strong>{" "}
          what they stand for once the sampling is undone.
        </li>
        <li>
          <strong className="font-medium text-gray-800">Skeleton</strong>: the
          user saw grey placeholders.{" "}
          <strong className="font-medium text-gray-800">Last-known</strong>: the
          app showed the last balances it had, marked &ldquo;Updating…&rdquo;,
          instead.
        </li>
      </ul>
    </div>
  );
}

function PlatformTiles({
  highlight,
  rangeLabel,
}: {
  highlight: PlatformHighlight;
  rangeLabel: string;
}) {
  const { platform, launch, resume } = highlight;
  const name = platformLabel(platform);
  const launches = platform === "web" ? "web page loads" : "cold launches";
  const home = launch?.homeReadyMs;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-900">
        {name}
        {launch && (
          <span className="ml-2 text-xs font-normal text-gray-500">
            {count(launch.samples)} {launches} from {count(launch.users)} users
          </span>
        )}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <AnalyticsKpiCard
          title="Launch: balances after (p50)"
          value={tileMs(home?.p50)}
          scope={`${rangeLabel}, ${name} ${launches} that waited`}
          className={tileTone(home?.p50)}
        />
        <AnalyticsKpiCard
          title="Launch: balances after (p90)"
          value={tileMs(home?.p90)}
          scope={`${rangeLabel}, ${name} ${launches} that waited`}
          className={tileTone(home?.p90)}
        />
        <AnalyticsKpiCard
          title="Launches over 10s"
          value={tileShare(launch?.over10sShare)}
          scope={`${rangeLabel}, share of ${name} ${launches}`}
        />
        <AnalyticsKpiCard
          title="Users with a launch over 10s"
          value={launch ? count(launch.over10sUsers) : undefined}
          scope={
            launch
              ? `${rangeLabel}, of ${count(launch.users)} ${name} users`
              : `${rangeLabel}, ${name}`
          }
        />
        <AnalyticsKpiCard
          title="Resumes showing loaders"
          value={tileShare(resume?.skeletonShare)}
          scope={`${rangeLabel}, ${name} resumes with grey placeholders, weighted`}
        />
        <AnalyticsKpiCard
          title="Resume: all fresh (p90)"
          value={tileMs(resume?.freshMs.p90)}
          scope={`${rangeLabel}, ${name} resumes, until every balance refreshed`}
          className={tileTone(resume?.freshMs.p90)}
        />
      </div>
    </section>
  );
}

function GroupsTable({ groups }: { groups: AppPerformanceGroup[] }) {
  const rows = sortGroups(groups);
  return (
    <Section
      title="Every platform and launch type"
      description="Balances after: launches and resumes that waited only. Shares are weighted for sampling."
    >
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2}>Platform</TableHead>
            <TableHead rowSpan={2}>Type</TableHead>
            <TableHead rowSpan={2} className={NUM_HEAD}>Samples</TableHead>
            <TableHead
              rowSpan={2}
              className={NUM_HEAD}
              title="What the samples stand for once sampling is undone"
            >
              Est. total
            </TableHead>
            <TableHead rowSpan={2} className={NUM_HEAD}>Users</TableHead>
            <TableHead
              rowSpan={2}
              className={NUM_HEAD}
              title="Samples where balances were not already on screen"
            >
              Waited
            </TableHead>
            <TableHead colSpan={3} className="h-7 text-center">
              Balances after
            </TableHead>
            <TableHead colSpan={3} className="h-7 text-center">
              Fresh
            </TableHead>
            <TableHead rowSpan={2} className={NUM_HEAD}>Over 10s</TableHead>
            <TableHead rowSpan={2} className={NUM_HEAD}>Users over 10s</TableHead>
            <TableHead rowSpan={2} className={NUM_HEAD}>Skeleton</TableHead>
            <TableHead rowSpan={2} className={NUM_HEAD}>Last-known</TableHead>
          </TableRow>
          <TableRow>
            {["p50", "p90", "p95", "p50", "p90", "p95"].map((label, index) => (
              <TableHead key={index} className={cn(NUM_HEAD, "h-7")}>
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={16}>No samples</EmptyRow>
          ) : (
            rows.map((group) => (
              <TableRow
                key={`${group.platform}-${group.kind}-${group.launchKind ?? ""}`}
              >
                <TableCell className="text-gray-700">
                  {platformLabel(group.platform)}
                </TableCell>
                <TableCell
                  className="text-gray-900"
                  title={launchKindHint(group.launchKind)}
                >
                  {kindLabel(group.kind, group.launchKind)}
                </TableCell>
                <TableCell className={NUM_CELL}>{count(group.samples)}</TableCell>
                <TableCell className={NUM_CELL}>
                  {count(group.estimatedTotal)}
                </TableCell>
                <TableCell className={NUM_CELL}>{count(group.users)}</TableCell>
                <TableCell className={NUM_CELL}>{count(group.waited)}</TableCell>
                <MsCell ms={group.homeReadyMs.p50} />
                <MsCell ms={group.homeReadyMs.p90} />
                <MsCell ms={group.homeReadyMs.p95} />
                <MsCell ms={group.freshMs.p50} />
                <MsCell ms={group.freshMs.p90} />
                <MsCell ms={group.freshMs.p95} />
                <TableCell className={NUM_CELL}>
                  {formatShare(group.over10sShare)}
                </TableCell>
                <TableCell className={NUM_CELL}>
                  {count(group.over10sUsers)}
                </TableCell>
                <TableCell className={NUM_CELL}>
                  {formatShare(group.skeletonShare)}
                </TableCell>
                <TableCell className={NUM_CELL}>
                  {formatShare(group.snapshotShare)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Section>
  );
}

function GatesTable({ gates }: { gates: AppPerformanceSummary["slowestGates"] }) {
  const rows = bySamples(gates);
  const total = rows.reduce((sum, row) => sum + row.samples, 0);
  return (
    <Section
      title="What held it up"
      description="The part of the home screen balances waited on longest, per sample that waited."
    >
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Waiting on</TableHead>
            <TableHead className={NUM_HEAD}>Samples</TableHead>
            <TableHead className={NUM_HEAD}>Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={3}>Nothing held balances up</EmptyRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.gate}>
                <TableCell className="whitespace-normal">
                  <div className="font-medium text-gray-900">
                    {describeGate(row.gate)}
                  </div>
                  {gateHint(row.gate) && (
                    <div className="text-gray-500">{gateHint(row.gate)}</div>
                  )}
                </TableCell>
                <TableCell className={NUM_CELL}>{count(row.samples)}</TableCell>
                <TableCell className={NUM_CELL}>
                  {formatShare(shareOf(row.samples, total))}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Section>
  );
}

function QueriesTable({
  queries,
}: {
  queries: AppPerformanceSummary["slowQueries"];
}) {
  const rows = bySamples(queries);
  return (
    <Section
      title="Slowest queries"
      description="The app's data queries most often reported slow, with their typical (p50) time when they were."
    >
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Query</TableHead>
            <TableHead className={NUM_HEAD}>Samples</TableHead>
            <TableHead className={NUM_HEAD}>Typical</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={3}>No slow queries reported</EmptyRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell
                  className="max-w-72 truncate font-mono text-gray-900"
                  title={row.key}
                >
                  {row.key}
                </TableCell>
                <TableCell className={NUM_CELL}>{count(row.samples)}</TableCell>
                <MsCell ms={row.p50Ms} />
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Section>
  );
}

const RAW_SHARE_HINT =
  "Of the reports received. Fast resumes are only sometimes reported, so compare rows rather than reading it as a rate.";

function CacheTable({
  outcomes,
}: {
  outcomes: AppPerformanceSummary["cacheOutcomes"];
}) {
  const rows = bySamples(outcomes);
  return (
    <Section
      title="Why the cache wasn't restored"
      description="At launch the app restores the balances it saved last time; when it can't, the user waits for every one. Restored launches are listed for comparison."
    >
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Platform</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className={NUM_HEAD}>Samples</TableHead>
            <TableHead className={NUM_HEAD} title="Samples that waited over 10s">
              Over 10s
            </TableHead>
            <TableHead className={NUM_HEAD} title={RAW_SHARE_HINT}>
              Share over 10s
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={5}>No launches reported a cache outcome</EmptyRow>
          ) : (
            rows.map((row) => (
              <TableRow key={`${row.platform}-${row.outcome}`}>
                <TableCell className="text-gray-700">
                  {platformLabel(row.platform)}
                </TableCell>
                <TableCell className="whitespace-normal text-gray-900">
                  {describeCacheOutcome(row.outcome)}
                </TableCell>
                <TableCell className={NUM_CELL}>{count(row.samples)}</TableCell>
                <TableCell className={NUM_CELL}>{count(row.over10s)}</TableCell>
                <TableCell className={NUM_CELL}>
                  {formatShare(shareOf(row.over10s, row.samples))}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Section>
  );
}

function VersionsTable({
  versions,
}: {
  versions: AppPerformanceSummary["appVersions"];
}) {
  const rows = bySamples(versions);
  return (
    <Section
      title="By app version"
      description="Reports per release, launches and resumes together. The share is of reports received, not weighted: fast resumes are only sometimes reported, so a release's mix can move it. For a release's weighted rates, filter by its version above."
    >
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>App version</TableHead>
            <TableHead className={NUM_HEAD}>Samples</TableHead>
            <TableHead className={NUM_HEAD} title="Samples that waited over 10s">
              Over 10s
            </TableHead>
            <TableHead className={NUM_HEAD} title={RAW_SHARE_HINT}>
              Share of reports
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={4}>No versions reported</EmptyRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.appVersion}>
                <TableCell className="font-mono text-gray-900">
                  {row.appVersion || "—"}
                </TableCell>
                <TableCell className={NUM_CELL}>{count(row.samples)}</TableCell>
                <TableCell className={NUM_CELL}>{count(row.over10s)}</TableCell>
                <TableCell className={NUM_CELL}>
                  {formatShare(shareOf(row.over10s, row.samples))}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Section>
  );
}

const dayLabel = (iso: string) =>
  formatDateTime(iso, { month: "short", day: "numeric", year: "numeric" });

// --- Page -------------------------------------------------------------------

/**
 * The App performance page: fleet-wide, how long the home screen takes to
 * show balances at launch and on return, and what holds it up. Filters live
 * in the URL. The summary carries no user ids; one user's samples are on
 * their user page (Support tab).
 */
export default function AppPerformancePage() {
  const { filters, update } = useAppPerformanceFilters();
  const { data, isLoading, isError, isPlaceholderData } =
    useAppPerformanceSummary(filters);

  let body: ReactNode;
  // While new filters load, `data` is still the previous filters' summary:
  // never show the empty state for the new ones off it, never label it with them.
  if ((isLoading && !data) || (isPlaceholderData && data?.groups.length === 0)) {
    body = (
      <div className="flex justify-center py-12" aria-busy>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  } else if (isError && !data) {
    body = (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        App performance could not be loaded. Please try again.
      </div>
    );
  } else if (data && data.groups.length === 0) {
    body = (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        No launch or resume timings in this window
        {filters.platform || filters.appVersion ? " for these filters" : ""}.
      </div>
    );
  } else if (data) {
    const highlights = platformHighlights(data);
    body = (
      <div
        aria-busy={isPlaceholderData}
        className={cn(
          "space-y-6 transition-opacity",
          isPlaceholderData && "opacity-60"
        )}
      >
        {isPlaceholderData ? (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Updating for the new filters; the figures below are the previous ones.
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            {dayLabel(data.from)} – {dayLabel(data.to)}
            {filters.platform && ` · ${platformLabel(filters.platform)}`}
            {filters.appVersion && ` · app version ${filters.appVersion}`}
          </p>
        )}

        {highlights.map((highlight) => (
          <PlatformTiles
            key={highlight.platform}
            highlight={highlight}
            rangeLabel={appPerfRangeLabel(data.days)}
          />
        ))}

        <GroupsTable groups={data.groups} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <GatesTable gates={data.slowestGates} />
          <QueriesTable queries={data.slowQueries} />
          <CacheTable outcomes={data.cacheOutcomes} />
          <VersionsTable versions={data.appVersions} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow">
        <FiltersBar filters={filters} update={update} />
      </div>
      <HowToRead />
      {body}
    </div>
  );
}
