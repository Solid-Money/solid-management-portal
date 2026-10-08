import type { QueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type {
  ErrorBurst,
  ErrorEventRow,
  ErrorEventsResponse,
  ErrorFlow,
  ErrorGroupDetail,
  ErrorGroupRow,
  ErrorGroupStatus,
  ErrorGroupsResponse,
  ErrorGroupUpdate,
  ErrorSource,
  ErrorStats,
  Severity,
  UpdateErrorGroupBody,
  WhoActs,
} from "@/types/errors";

/**
 * The Errors page's API, vocabulary and the few rules both the tables and the
 * live feed have to agree on. The wire shapes live in `types/errors.ts`, copied
 * from the contract the backend implements.
 */

// --- Vocabulary -------------------------------------------------------------

type BadgeVariant =
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

export const ERROR_SOURCE_LABELS: Record<ErrorSource, string> = {
  app: "App",
  backend: "Backend",
  mongo: "Database",
  temporal: "Temporal",
  glitchtip: "GlitchTip",
  amplitude: "Amplitude",
  loki: "Loki",
};

export const ERROR_FLOW_LABELS: Record<ErrorFlow, string> = {
  deposit: "Deposit",
  withdraw: "Withdraw",
  send: "Send",
  swap: "Swap",
  bridge: "Bridge",
  card: "Card",
  card_deposit: "Card deposit",
  kyc: "KYC",
  signup: "Sign-up",
  login: "Login",
  buy_crypto: "Buy crypto",
  cash_out: "Cash out",
  savings: "Savings",
  rewards: "Rewards",
  tier: "Tier",
  app: "App",
  other: "Other",
};

export const WHO_ACTS_LABELS: Record<WhoActs, string> = {
  engineering: "Engineering",
  ops: "Ops",
  provider: "Provider",
  support: "Support",
  user: "User",
};

/** What each owner is expected to do, for the badge's tooltip. */
export const WHO_ACTS_HINTS: Record<WhoActs, string> = {
  engineering: "Needs a code fix",
  ops: "Needs someone on the team to act, e.g. top up a wallet",
  provider: "A partner is failing; chase them",
  support: "Support should reach out to the user",
  user: "The user can fix this themselves",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  error: "Error",
  warning: "Warning",
  info: "Info",
};

export const GROUP_STATUS_LABELS: Record<ErrorGroupStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  muted: "Muted",
};

/** `ErrorEventRow.platform` is a plain string on the wire; these are its values. */
export const PLATFORM_LABELS: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  web: "Web",
  server: "Server",
};

export const ERROR_SOURCES = Object.keys(ERROR_SOURCE_LABELS) as ErrorSource[];
export const ERROR_FLOWS = Object.keys(ERROR_FLOW_LABELS) as ErrorFlow[];
export const WHO_ACTS = Object.keys(WHO_ACTS_LABELS) as WhoActs[];
export const SEVERITIES = Object.keys(SEVERITY_LABELS) as Severity[];
export const GROUP_STATUSES = Object.keys(
  GROUP_STATUS_LABELS
) as ErrorGroupStatus[];
export const PLATFORMS = Object.keys(PLATFORM_LABELS);

export const WHO_ACTS_VARIANTS: Record<WhoActs, BadgeVariant> = {
  engineering: "danger",
  ops: "info",
  provider: "warning",
  support: "secondary",
  user: "muted",
};

export const SEVERITY_VARIANTS: Record<Severity, BadgeVariant> = {
  critical: "destructive",
  error: "danger",
  warning: "warning",
  info: "muted",
};

export const GROUP_STATUS_VARIANTS: Record<ErrorGroupStatus, BadgeVariant> = {
  open: "warning",
  acknowledged: "info",
  resolved: "success",
  muted: "muted",
};

/**
 * A label for a value, or the value itself when the backend has started
 * sending one this file does not know yet — shown raw rather than dropped.
 */
export function labelFor(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}

export function variantFor(
  variants: Record<string, BadgeVariant>,
  value: string
): BadgeVariant {
  return variants[value] ?? "outline";
}

// --- Time range -------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;

export const RANGE_PRESETS = [
  { id: "1h", label: "Last hour", ms: HOUR_MS },
  { id: "24h", label: "Last 24 hours", ms: 24 * HOUR_MS },
  { id: "7d", label: "Last 7 days", ms: 7 * 24 * HOUR_MS },
  { id: "30d", label: "Last 30 days", ms: 30 * 24 * HOUR_MS },
  { id: "90d", label: "Last 90 days", ms: 90 * 24 * HOUR_MS },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["id"];

export const DEFAULT_RANGE: RangePreset = "24h";

export const isRangePreset = (value: unknown): value is RangePreset =>
  RANGE_PRESETS.some((preset) => preset.id === value);

export const rangeLabel = (range: RangePreset): string =>
  RANGE_PRESETS.find((preset) => preset.id === range)?.label ?? range;

export interface TimeWindow {
  from: string;
  to: string;
}

/**
 * The window a preset covers, ending now.
 *
 * Resolved when a request is made, never when a component renders: the query
 * keys hold the preset, so "last 24 hours" re-read on focus an hour later
 * covers the last 24 hours rather than the 24 hours before the page opened.
 */
export function resolveRange(
  range: RangePreset,
  now: number = Date.now()
): TimeWindow {
  const ms =
    RANGE_PRESETS.find((preset) => preset.id === range)?.ms ?? 24 * HOUR_MS;
  return {
    from: new Date(now - ms).toISOString(),
    to: new Date(now).toISOString(),
  };
}

// --- Queries ----------------------------------------------------------------

/** The filters every tab shares. Unset means "any". */
export interface ErrorFilters {
  range: RangePreset;
  source?: ErrorSource;
  flow?: ErrorFlow;
  whoActs?: WhoActs;
  severity?: Severity;
  platform?: string;
  /** Username, email or user id — the server resolves which. */
  user?: string;
  /** Free text in the title, message or code. */
  q?: string;
}

export type GroupSort = "lastSeen" | "count" | "users";

export const GROUP_SORT_LABELS: Record<GroupSort, string> = {
  lastSeen: "Last seen",
  count: "Count",
  users: "Users",
};

export interface ErrorGroupsQuery extends ErrorFilters {
  status?: ErrorGroupStatus;
  labelled?: boolean;
  sort?: GroupSort;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface ErrorEventsQuery extends ErrorFilters {
  fingerprint?: string;
  limit?: number;
}

/**
 * Query keys. Everything sits under `["errors"]` so a change to a group — or a
 * reconnect after a gap — can refresh the whole page with one invalidation.
 */
export const ERROR_KEYS = {
  all: ["errors"] as const,
  stats: (params: { range: RangePreset }) => ["errors", "stats", params] as const,
  groups: (params: ErrorGroupsQuery) => ["errors", "groups", params] as const,
  group: (fingerprint: string, range: RangePreset) =>
    ["errors", "group", fingerprint, range] as const,
  events: (params: ErrorEventsQuery) => ["errors", "events", params] as const,
  user: (userId: string, params: { range: RangePreset }) =>
    ["errors", "user", userId, params] as const,
};

type ParamValue = string | number | boolean | undefined;

/** Query params without the unset ones, so "any" is left off rather than sent as "". */
function toParams(values: Record<string, ParamValue>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    params[key] = String(value);
  }
  return params;
}

function filterParams(
  filters: ErrorFilters,
  window: TimeWindow
): Record<string, ParamValue> {
  return {
    from: window.from,
    to: window.to,
    source: filters.source,
    flow: filters.flow,
    whoActs: filters.whoActs,
    severity: filters.severity,
    platform: filters.platform,
    user: filters.user?.trim(),
    q: filters.q?.trim(),
  };
}

const groupPath = (fingerprint: string) =>
  `/admin/v1/errors/groups/${encodeURIComponent(fingerprint)}`;

/** Headline numbers for a window. Takes no other filter: they describe everything. */
export const getErrorStats = (window: TimeWindow) =>
  api
    .get<ErrorStats>("/admin/v1/errors/stats", { params: toParams({ ...window }) })
    .then((response) => response.data);

export const getErrorGroups = (query: ErrorGroupsQuery, window: TimeWindow) =>
  api
    .get<ErrorGroupsResponse>("/admin/v1/errors/groups", {
      params: toParams({
        ...filterParams(query, window),
        status: query.status,
        labelled: query.labelled,
        sort: query.sort,
        order: query.order,
        page: query.page,
        limit: query.limit,
      }),
    })
    .then((response) => response.data);

export const getErrorGroup = (fingerprint: string, window: TimeWindow) =>
  api
    .get<ErrorGroupDetail>(groupPath(fingerprint), {
      params: toParams({ ...window }),
    })
    .then((response) => response.data);

/**
 * Triage or label a group. The admin is taken from the Firebase token
 * server-side, which is what `updatedBy` comes back as.
 */
export const updateErrorGroup = (
  fingerprint: string,
  body: UpdateErrorGroupBody
) =>
  api
    .patch<ErrorGroupRow>(groupPath(fingerprint), body)
    .then((response) => response.data);

export const getErrorEvents = (
  query: ErrorEventsQuery,
  window: TimeWindow,
  cursor?: string
) =>
  api
    .get<ErrorEventsResponse>("/admin/v1/errors/events", {
      params: toParams({
        ...filterParams(query, window),
        fingerprint: query.fingerprint,
        cursor,
        limit: query.limit,
      }),
    })
    .then((response) => response.data);

export const getUserErrors = (
  userId: string,
  window: TimeWindow,
  cursor?: string,
  limit?: number
) =>
  api
    .get<ErrorEventsResponse>(
      `/admin/v1/users/${encodeURIComponent(userId)}/errors`,
      { params: toParams({ ...window, cursor, limit }) }
    )
    .then((response) => response.data);

/**
 * One page of a cursor feed, with the window it was read against.
 *
 * Later pages reuse the first page's window: the cursor is a position in one
 * result set, and asking for the next page of a window that has since moved
 * would skip or repeat rows at the seam.
 */
export interface ErrorEventsPage extends ErrorEventsResponse {
  window: TimeWindow;
}

export type ErrorEventsPageParam = { cursor: string; window: TimeWindow } | null;

export const nextEventsPageParam = (
  page: ErrorEventsPage
): ErrorEventsPageParam | undefined =>
  page.nextCursor ? { cursor: page.nextCursor, window: page.window } : undefined;

// --- Live feed --------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

export function isErrorEventRow(value: unknown): value is ErrorEventRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.ts === "string" &&
    typeof value.fingerprint === "string" &&
    typeof value.title === "string"
  );
}

export function isErrorGroupUpdate(value: unknown): value is ErrorGroupUpdate {
  return (
    isRecord(value) &&
    typeof value.fingerprint === "string" &&
    typeof value.count === "number" &&
    typeof value.lastSeen === "string"
  );
}

export function isErrorBurst(value: unknown): value is ErrorBurst {
  return (
    isRecord(value) &&
    typeof value.dropped === "number" &&
    typeof value.windowSec === "number"
  );
}

/**
 * Whether a live row belongs in the feed the filters describe.
 *
 * The socket sends every error and the server only filters what it reads, so
 * the feed applies the same filters to what arrives. A `user` filter can be an
 * email, which no row carries; `userIds` is the ids the server resolved it to,
 * taken from the rows it returned.
 */
export function matchesErrorFilters(
  row: ErrorEventRow,
  filters: ErrorEventsQuery,
  userIds?: ReadonlySet<string>
): boolean {
  if (
    filters.source &&
    row.source !== filters.source &&
    !row.alsoSeenIn?.includes(filters.source)
  ) {
    return false;
  }
  if (filters.flow && row.flow !== filters.flow) return false;
  if (filters.whoActs && row.whoActs !== filters.whoActs) return false;
  if (filters.severity && row.severity !== filters.severity) return false;
  if (filters.platform && row.platform !== filters.platform) return false;
  if (filters.fingerprint && row.fingerprint !== filters.fingerprint) {
    return false;
  }

  const user = filters.user?.trim().toLowerCase();
  if (user) {
    const sameUser =
      (row.userId &&
        (row.userId.toLowerCase() === user || userIds?.has(row.userId))) ||
      row.username?.toLowerCase() === user ||
      row.claimedUsername?.toLowerCase() === user;
    if (!sameUser) return false;
  }

  const q = filters.q?.trim().toLowerCase();
  if (q) {
    const text = [row.title, row.message, row.code]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    if (!text.includes(q)) return false;
  }

  return true;
}

/**
 * A group with a live update applied.
 *
 * The update carries all-time totals only. Every new occurrence is a recent
 * one, so the in-range count moves by however much the all-time count did; the
 * in-range user count cannot be derived and waits for the next read.
 */
export function applyGroupUpdate<T extends ErrorGroupRow>(
  row: T,
  update: ErrorGroupUpdate
): T {
  return {
    ...row,
    title: update.title,
    severity: update.severity,
    whoActs: update.whoActs,
    status: update.status,
    count: update.count,
    usersAffected: update.usersAffected,
    lastSeen: update.lastSeen,
    countInRange: row.countInRange + Math.max(update.count - row.count, 0),
  };
}

/**
 * Change one group wherever it is cached — every page of the groups tables,
 * and its drawer — so a change shows at once rather than after the re-read.
 */
export function patchCachedGroup(
  queryClient: QueryClient,
  fingerprint: string,
  patch: <T extends ErrorGroupRow>(row: T) => T
): void {
  queryClient.setQueriesData<ErrorGroupsResponse>(
    { queryKey: ["errors", "groups"] },
    (old) =>
      old && {
        ...old,
        data: old.data.map((row) =>
          row.fingerprint === fingerprint ? patch(row) : row
        ),
      }
  );
  queryClient.setQueriesData<ErrorGroupDetail>(
    { queryKey: ["errors", "group", fingerprint] },
    (old) => old && patch(old)
  );
}

// --- Formatting -------------------------------------------------------------

/**
 * A change against the previous period, or null when there is nothing to
 * compare with — "up from zero" is not a percentage.
 */
export function percentChange(
  current: number,
  previous: number
): { label: string; trend: "up" | "down" | "flat" } | null {
  if (!previous || !Number.isFinite(current)) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { label: "0%", trend: "flat" };
  return {
    label: `${pct > 0 ? "+" : ""}${formatNumber(pct, 0, 0)}%`,
    trend: pct > 0 ? "up" : "down",
  };
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/**
 * "14:03:27", with "Oct 7" beside it when it was not today — a feed is read
 * from now backwards, and today's date on every row is noise.
 *
 * `now` comes from the minute clock; null (before hydration) shows the date.
 */
export function formatEventTime(
  iso: string,
  now: number | null
): { time: string; date: string | null } {
  const date = new Date(iso);
  const time = formatDateTime(date, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const today = now !== null && sameDay(date, new Date(now));
  return {
    time,
    date: today ? null : formatDateTime(date, { month: "short", day: "numeric" }),
  };
}

// --- Links out --------------------------------------------------------------

const baseUrl = (value?: string) => value?.trim().replace(/\/+$/, "") || null;

/** Each is optional: a link is hidden, not broken, when its env is unset. */
const GLITCHTIP_URL = baseUrl(process.env.NEXT_PUBLIC_GLITCHTIP_URL);
const GRAFANA_URL = baseUrl(process.env.NEXT_PUBLIC_GRAFANA_URL);
const AMPLITUDE_ORG_URL = baseUrl(process.env.NEXT_PUBLIC_AMPLITUDE_ORG_URL);

export function glitchtipIssueUrl(issueId?: string): string | null {
  if (!issueId || !GLITCHTIP_URL) return null;
  return `${GLITCHTIP_URL}/issues/${encodeURIComponent(issueId)}`;
}

/**
 * Grafana Explore with the backend's LogQL for this line in the left pane,
 * around the occurrence when there is one and the last hour otherwise.
 */
export function grafanaExploreUrl(
  lokiQuery?: string,
  around?: string
): string | null {
  if (!lokiQuery || !GRAFANA_URL) return null;
  const at = around ? new Date(around).getTime() : Number.NaN;
  const range = Number.isFinite(at)
    ? { from: String(at - 15 * 60_000), to: String(at + 15 * 60_000) }
    : { from: "now-1h", to: "now" };
  const panes = {
    a: {
      datasource: "loki",
      queries: [{ refId: "A", expr: lokiQuery }],
      range,
    },
  };
  return `${GRAFANA_URL}/explore?schemaVersion=1&panes=${encodeURIComponent(
    JSON.stringify(panes)
  )}`;
}

/**
 * The Amplitude org, not the user's page in it: the analytics user id is not
 * ours, so a deep link would land on "user not found" as often as not.
 */
export const amplitudeUrl = (): string | null => AMPLITUDE_ORG_URL;
