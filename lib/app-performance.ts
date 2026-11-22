import api from "@/lib/api";
import type {
  AppPerfKind,
  AppPerfPlatform,
  AppPerformanceGroup,
  AppPerformanceSampleView,
  AppPerformanceSummary,
  AppPerformanceSummaryResponse,
  UserAppPerformanceResponse,
} from "@/types/app-performance";

/**
 * App performance: how long the app's home screen took to show balances at
 * launch ("startup") and on return to the foreground ("resume"), and what held
 * it up. The API, the vocabulary and the wording both the user card and the
 * fleet page use, kept free of React so it is tested once. The wire shapes
 * live in `types/app-performance.ts`, copied from the backend's contract.
 */

type Sample = AppPerformanceSampleView;

// --- Thresholds -------------------------------------------------------------

/** From here a wait is noticeable. */
export const SLOW_MS = 5_000;
/** Past this a wait is the problem this page exists for. */
export const BAD_MS = 10_000;

export type PerfSeverity = "ok" | "slow" | "bad";

/** Under 5s is fine, 5–10s is slow, over 10s is bad. */
export function severity(ms: number): PerfSeverity {
  if (ms > BAD_MS) return "bad";
  if (ms >= SLOW_MS) return "slow";
  return "ok";
}

export const SEVERITY_TEXT_CLASS: Record<PerfSeverity, string> = {
  ok: "text-emerald-700",
  slow: "text-amber-700",
  bad: "font-semibold text-red-700",
};

/** The text colour for a duration; grey when there is none. */
export function severityClass(ms: number | null | undefined): string {
  return ms === null || ms === undefined || !Number.isFinite(ms)
    ? "text-gray-400"
    : SEVERITY_TEXT_CLASS[severity(ms)];
}

// --- Formatting -------------------------------------------------------------

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const pair = (big: number, bigUnit: string, small: number, smallUnit: string) =>
  small ? `${big}${bigUnit} ${small}${smallUnit}` : `${big}${bigUnit}`;

/**
 * A duration the way a person says it: "0.9s", "12.4s", "1m 35s", "2h 5m",
 * "3d 4h". Tenths of a second below a minute, because the difference between
 * 4.6s and 5.4s is the difference between fine and slow. "—" when there is no
 * value (or a negative one, which only a confused clock produces).
 */
export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) {
    return "—";
  }
  if (ms === 0) return "0s";
  const tenths = Math.round(ms / 100);
  if (tenths === 0) return "<0.1s";
  if (tenths < 600) return `${(tenths / 10).toFixed(1)}s`;
  const seconds = Math.round(ms / SECOND);
  if (seconds < 60 * 60) {
    return pair(Math.floor(seconds / 60), "m", seconds % 60, "s");
  }
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 24 * 60) {
    return pair(Math.floor(minutes / 60), "h", minutes % 60, "m");
  }
  const hours = Math.round(ms / HOUR);
  return pair(Math.floor(hours / 24), "d", hours % 24, "h");
}

/**
 * A 0–1 share as "12.3%"; "<0.1%" for a share too small to round to one but
 * not zero, so a rare problem never reads as none. "—" when there is no share
 * (nothing to take it of).
 */
export function formatShare(share: number | null | undefined): string {
  if (share === null || share === undefined || !Number.isFinite(share)) {
    return "—";
  }
  if (share > 0 && share < 0.0005) return "<0.1%";
  return `${(share * 100).toFixed(1)}%`;
}

/** `part / whole`, or null when there is no whole to take it of. */
export const shareOf = (part: number, whole: number): number | null =>
  whole > 0 ? part / whole : null;

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const lowerFirst = (text: string) =>
  text ? text.charAt(0).toLowerCase() + text.slice(1) : text;

// --- Vocabulary -------------------------------------------------------------

export const APP_PERF_PLATFORMS: AppPerfPlatform[] = ["ios", "android", "web"];

export const PLATFORM_LABELS: Record<AppPerfPlatform, string> = {
  ios: "iOS",
  android: "Android",
  web: "Web",
};

/** A platform's name, or the raw value for one this file does not know yet. */
export const platformLabel = (platform: string): string =>
  PLATFORM_LABELS[platform as AppPerfPlatform] ?? platform;

export const isAppPerfPlatform = (value: unknown): value is AppPerfPlatform =>
  APP_PERF_PLATFORMS.includes(value as AppPerfPlatform);

const LAUNCH_KINDS: Record<string, { label: string; hint: string }> = {
  cold: { label: "cold", hint: "The app started from scratch" },
  ota_reload: {
    label: "OTA",
    hint: "The app restarted itself to apply an over-the-air update",
  },
  page_load: { label: "web load", hint: "The web app loaded in a browser tab" },
  after_login: {
    label: "after login",
    hint: "Balances loading straight after the user signed in",
  },
};

/** Where launch kinds sort, and which counts as "the" launch for a platform. */
const LAUNCH_KIND_ORDER = ["cold", "page_load", "ota_reload", "after_login"];

export const launchKindLabel = (launchKind: string): string =>
  LAUNCH_KINDS[launchKind]?.label ?? launchKind;

export const launchKindHint = (launchKind?: string | null): string | undefined =>
  launchKind ? LAUNCH_KINDS[launchKind]?.hint : undefined;

/** "Launch (cold)" or "Resume": a summary group's kind, in words. */
export function kindLabel(kind: AppPerfKind, launchKind?: string | null): string {
  const base = kind === "startup" ? "Launch" : "Resume";
  return launchKind ? `${base} (${launchKindLabel(launchKind)})` : base;
}

/** "Launch (cold)", or "Resume after 2h 5m" with the time the user was away. */
export function sampleTypeLabel(sample: Sample): string {
  if (sample.kind === "resume") {
    return sample.backgroundMs !== undefined
      ? `Resume after ${formatMs(sample.backgroundMs)}`
      : "Resume";
  }
  return kindLabel("startup", sample.launchKind);
}

/**
 * The parts of the home screen balances wait on, in the reader's words, with
 * what each one covers for the tooltip.
 */
const GATES: Record<string, { label: string; hint: string }> = {
  tokens: {
    label: "Wallet tokens",
    hint: "Wallet token balances across chains",
  },
  vaultBalance: { label: "Vault balances", hint: "Savings vault balances" },
  savings: {
    label: "Savings total",
    hint: "The savings total, including rates and prices",
  },
  card: { label: "Card status", hint: "Card status and details" },
  portfolio: {
    label: "Portfolio",
    hint: "Custody, membership and the other parts of the Assets model",
  },
};

/** A gate's label ("Wallet tokens"), the raw name for an unknown one, "—" for none. */
export function describeGate(gate: string | null | undefined): string {
  if (!gate) return "—";
  return GATES[gate]?.label ?? gate;
}

/** What a gate waits for, for a tooltip. */
export const gateHint = (gate: string | null | undefined): string | undefined =>
  gate ? GATES[gate]?.hint : undefined;

/**
 * Why the saved cache was or wasn't restored at launch: a short form for a
 * table cell and a sentence for its tooltip and the fleet table.
 */
const CACHE_OUTCOMES: Record<string, { short: string; long: string }> = {
  restored: { short: "Restored", long: "Saved balances restored" },
  empty: { short: "None saved", long: "No saved balances" },
  cache_version: {
    short: "Cache version",
    long: "Cache dropped: cache version changed",
  },
  app_version: { short: "App updated", long: "Cache dropped: app updated" },
  no_user: {
    short: "No user",
    long: "Cache not used: no signed-in user at launch",
  },
  other_user: {
    short: "Other account",
    long: "Cache dropped: saved for a different account",
  },
  unreadable: {
    short: "Unreadable",
    long: "Cache dropped: saved balances could not be read",
  },
  nothing_usable: {
    short: "Too old",
    long: "Saved balances too old or unreadable",
  },
};

export function describeCacheOutcome(outcome: string | null | undefined): string {
  if (!outcome) return "—";
  return CACHE_OUTCOMES[outcome]?.long ?? outcome;
}

export function cacheOutcomeShort(outcome: string | null | undefined): string {
  if (!outcome) return "—";
  return CACHE_OUTCOMES[outcome]?.short ?? outcome;
}

/**
 * The Cache cell: the outcome and how many saved queries came back —
 * "Restored (7)" — with the sentence and the age of what was shown on hover.
 * Null when the sample says nothing about the cache (resumes never do).
 */
export function cacheSummary(sample: Sample): { label: string; title: string } | null {
  if (!sample.cacheOutcome && sample.cacheRestored === undefined) return null;
  const restored = sample.cacheRestored ?? 0;
  const outcome = sample.cacheOutcome
    ? cacheOutcomeShort(sample.cacheOutcome)
    : null;
  const label = outcome
    ? `${outcome}${restored > 0 ? ` (${restored})` : ""}`
    : `${restored} restored`;
  const title = [
    sample.cacheOutcome ? describeCacheOutcome(sample.cacheOutcome) : null,
    sample.cacheRestored !== undefined
      ? `${plural(sample.cacheRestored, "saved query", "saved queries")} restored`
      : null,
    sample.snapshotAgeMs !== undefined
      ? `last-known balances were ${formatMs(sample.snapshotAgeMs)} old`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { label, title };
}

// --- One sample -------------------------------------------------------------

/**
 * How long this sample kept the user waiting: the time until balances showed,
 * or — for a resume that kept them on screen (`homeReadyMs` 0) — the time
 * until every balance was refreshed. Undefined when the app reported neither.
 */
export function waitMs(sample: Sample): number | undefined {
  if (sample.homeReadyMs !== undefined && sample.homeReadyMs > 0) {
    return sample.homeReadyMs;
  }
  if (sample.kind === "resume") return sample.freshMs ?? sample.homeReadyMs;
  return sample.homeReadyMs;
}

/** Whether this sample is one of the waits over 10 seconds. */
export const isOver10s = (sample: Sample): boolean =>
  (waitMs(sample) ?? 0) > BAD_MS;

/** Whether a resume found balances already on screen. */
export const alreadyShown = (sample: Sample): boolean =>
  sample.kind === "resume" && sample.homeReadyMs === 0;

/** "balances after 12.4s", "balances already shown, refreshed after 3.1s", … */
export function balancesPhrase(sample: Sample): string {
  const ready = sample.homeReadyMs;
  if (alreadyShown(sample)) {
    return sample.freshMs !== undefined
      ? `balances already shown, refreshed after ${formatMs(sample.freshMs)}`
      : "balances already shown";
  }
  if (ready !== undefined) {
    if (sample.timedOut) {
      return `still loading after ${formatMs(ready)} (timed out)`;
    }
    return `balances after ${formatMs(ready)}${
      sample.backgrounded ? " (app was in the background meanwhile)" : ""
    }`;
  }
  if (sample.timedOut) return "timed out before balances showed";
  if (sample.backgrounded) return "left the app before balances showed";
  if (sample.interrupted) return "measurement interrupted";
  return "no timing reported";
}

/**
 * The Balances after cell: the time until balances showed, or what happened
 * instead, with the severity to colour it by (null: nothing to judge).
 */
export function balancesAfter(sample: Sample): {
  text: string;
  severity: PerfSeverity | null;
} {
  if (alreadyShown(sample)) return { text: "already shown", severity: null };
  if (sample.homeReadyMs !== undefined) {
    return {
      text: `${formatMs(sample.homeReadyMs)}${sample.timedOut ? " (timed out)" : ""}`,
      severity: sample.timedOut ? "bad" : severity(sample.homeReadyMs),
    };
  }
  if (sample.timedOut) return { text: "timed out", severity: "bad" };
  if (sample.backgrounded) return { text: "left the app", severity: null };
  if (sample.interrupted) return { text: "interrupted", severity: null };
  return { text: "—", severity: null };
}

/** "held up by wallet tokens", or null when nothing did. */
export function heldUpByPhrase(sample: Sample): string | null {
  if (!sample.slowestGate || !((waitMs(sample) ?? 0) > 0)) return null;
  return `held up by ${lowerFirst(describeGate(sample.slowestGate))}`;
}

/**
 * The sample in one line, for support:
 * "Launch (cold) · balances after 12.4s · held up by wallet tokens".
 */
export function sampleHeadline(sample: Sample): string {
  return [sampleTypeLabel(sample), balancesPhrase(sample), heldUpByPhrase(sample)]
    .filter(Boolean)
    .join(" · ");
}

/**
 * What the user looked at while balances loaded: grey placeholders
 * ("Skeleton"), the last balances the app had, marked "Updating…"
 * ("Last-known"), or neither.
 */
export function sawLabel(sample: Sample): { label: string; title: string } | null {
  if (sample.skeletonShown && sample.snapshotShown) {
    return {
      label: "Last-known + skeleton",
      title:
        "Some last-known balances (marked “Updating…”) and some grey placeholders",
    };
  }
  if (sample.skeletonShown) {
    return { label: "Skeleton", title: "Grey placeholders until balances loaded" };
  }
  if (sample.snapshotShown) {
    return {
      label: "Last-known",
      title: "The last balances the app had, marked “Updating…”, until fresh ones loaded",
    };
  }
  return null;
}

/** "Waited on" and "Slow queries" lines for the Held up by tooltip, longest first. */
export function holdUpDetails(sample: Sample): string[] {
  const lines: string[] = [];
  const gates = [...(sample.gateWaits ?? [])].sort((a, b) => b.ms - a.ms);
  if (gates.length) {
    lines.push("Waited on:");
    for (const wait of gates) {
      lines.push(`  ${describeGate(wait.gate)}: ${formatMs(wait.ms)}`);
    }
  }
  const queries = [...(sample.slowQueries ?? [])].sort((a, b) => b.ms - a.ms);
  if (queries.length) {
    lines.push("Slow queries:");
    for (const query of queries) {
      lines.push(
        `  ${query.key}: ${formatMs(query.ms)}${query.failed ? " (failed)" : ""}`
      );
    }
  }
  return lines;
}

/** The chains the app reads balances on, by id. */
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  56: "BNB Chain",
  122: "Fuse",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
};

export const chainName = (chainId: number): string =>
  CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

/** The wallet token fetch, line by line, for the expanded row. */
export function tokenFetchDetails(
  tokenFetch: Sample["tokenFetch"] | undefined
): string[] {
  if (!tokenFetch) return [];
  const lines: string[] = [];
  const split = [
    tokenFetch.readsMs !== undefined ? `reads ${formatMs(tokenFetch.readsMs)}` : null,
    tokenFetch.pricingMs !== undefined
      ? `pricing ${formatMs(tokenFetch.pricingMs)}`
      : null,
  ].filter(Boolean);
  if (tokenFetch.totalMs !== undefined || split.length) {
    lines.push(
      [
        tokenFetch.totalMs !== undefined ? `${formatMs(tokenFetch.totalMs)} in all` : null,
        split.length ? `(${split.join(", ")})` : null,
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
  if (tokenFetch.tokenCount !== undefined) {
    lines.push(
      `${plural(tokenFetch.tokenCount, "token")}${
        tokenFetch.unpricedCount ? `, ${tokenFetch.unpricedCount} without a price` : ""
      }`
    );
  }
  if (tokenFetch.timedOutReads) {
    lines.push(`${plural(tokenFetch.timedOutReads, "chain read")} timed out`);
  }
  if (tokenFetch.failedChains?.length) {
    lines.push(`Failed on ${tokenFetch.failedChains.map(chainName).join(", ")}`);
  }
  if (tokenFetch.slowestChain !== undefined) {
    lines.push(
      `Slowest chain: ${chainName(tokenFetch.slowestChain)}${
        tokenFetch.slowestChainMs !== undefined
          ? ` (${formatMs(tokenFetch.slowestChainMs)})`
          : ""
      }`
    );
  }
  return lines;
}

/** Every timing the sample carries, labelled, in the order they happen. */
export function sampleTimings(sample: Sample): { label: string; value: string }[] {
  // [label, ms, text shown in place of the duration]
  const rows: [string, number | undefined, string?][] =
    sample.kind === "startup"
      ? [
          ["Splash hidden → balances", sample.homeReadyMs],
          ["App in foreground → balances", sample.visibleToReadyMs],
          ["JS start → balances", sample.jsToReadyMs],
          ["Every balance refreshed", sample.freshMs],
          ["Sign-in refresh", sample.authRefreshMs],
          ["Age of last-known balances", sample.snapshotAgeMs],
        ]
      : [
          ["Time away", sample.backgroundMs],
          // A resume's 0 means balances never left the screen, not "instant".
          [
            "Return → balances",
            sample.homeReadyMs,
            alreadyShown(sample) ? "already shown" : undefined,
          ],
          ["Return → every balance refreshed", sample.freshMs],
          ["Sign-in refresh", sample.authRefreshMs],
          ["JS start → balances", sample.jsToReadyMs],
        ];
  return rows.flatMap(([label, ms, text]) =>
    ms === undefined ? [] : [{ label, value: text ?? formatMs(ms) }]
  );
}

/** The flags and context worth a line: what else was going on. */
export function sampleNotes(sample: Sample): string[] {
  const notes: string[] = [];
  if (sample.timedOut) notes.push("Gave up waiting (timed out)");
  if (sample.backgrounded) notes.push("The app went to the background before balances showed");
  if (sample.interrupted) notes.push("Measurement interrupted");
  if (sample.clockSkewed) {
    notes.push("The device clock looked wrong; the time shown may be off");
  }
  if (sample.sampleRate > 0 && sample.sampleRate < 1) {
    const oneIn = Math.round(1 / sample.sampleRate);
    notes.push(`Sampled: 1 in ${oneIn} reported, so it stands for about ${oneIn}`);
  }
  if (sample.networkType) notes.push(`Network: ${sample.networkType}`);
  if (sample.jsHeapMb !== undefined) {
    notes.push(`JS heap: ${Math.round(sample.jsHeapMb)} MB`);
  }
  return notes;
}

/** The first block of an OTA update id, enough to tell two apart. */
export const shortUpdateId = (updateId?: string | null): string | undefined =>
  updateId ? updateId.slice(0, 8) : undefined;

/** "2.1.0 · 3f2a9c1b": the app version and which OTA update it was running. */
export function appLabel(sample: Sample): string {
  const parts = [sample.appVersion, shortUpdateId(sample.updateId)].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export interface SampleCounts {
  launches: number;
  resumes: number;
  over10s: number;
}

export function sampleCounts(samples: Sample[]): SampleCounts {
  return samples.reduce<SampleCounts>(
    (counts, sample) => ({
      launches: counts.launches + (sample.kind === "startup" ? 1 : 0),
      resumes: counts.resumes + (sample.kind === "resume" ? 1 : 0),
      over10s: counts.over10s + (isOver10s(sample) ? 1 : 0),
    }),
    { launches: 0, resumes: 0, over10s: 0 }
  );
}

/** "3 launches and 17 resumes · 2 took over 10s" — the card's header line. */
export function countsLine(counts: SampleCounts): string {
  const slow =
    counts.over10s === 0
      ? "none took over 10s"
      : `${counts.over10s} took over 10s`;
  return `${plural(counts.launches, "launch", "launches")} and ${plural(
    counts.resumes,
    "resume"
  )} · ${slow}`;
}

// --- The fleet summary ------------------------------------------------------

/** The launch kind that stands for "opening the app" on a platform. */
export const primaryLaunchKind = (platform: AppPerfPlatform): string =>
  platform === "web" ? "page_load" : "cold";

const platformRank = (platform: string) => {
  const index = APP_PERF_PLATFORMS.indexOf(platform as AppPerfPlatform);
  return index === -1 ? APP_PERF_PLATFORMS.length : index;
};

const launchKindRank = (launchKind: string | null) => {
  if (launchKind === null) return -1;
  const index = LAUNCH_KIND_ORDER.indexOf(launchKind);
  return index === -1 ? LAUNCH_KIND_ORDER.length : index;
};

/** Groups by platform (iOS, Android, Web), launches before resumes, cold first. */
export function sortGroups(groups: AppPerformanceGroup[]): AppPerformanceGroup[] {
  return [...groups].sort(
    (a, b) =>
      platformRank(a.platform) - platformRank(b.platform) ||
      (a.kind === b.kind ? 0 : a.kind === "startup" ? -1 : 1) ||
      launchKindRank(a.launchKind) - launchKindRank(b.launchKind)
  );
}

/** Most samples first — how often a cause shows up — so the top row is the one to fix. */
export function bySamples<T extends { samples: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.samples - a.samples);
}

export interface PlatformHighlight {
  platform: AppPerfPlatform;
  /** The platform's cold launch (a page load on the web). */
  launch?: AppPerformanceGroup;
  /** Its resumes: the group without a launch kind, else the largest. */
  resume?: AppPerformanceGroup;
}

/** Each platform with samples, with the two groups its tiles read. */
export function platformHighlights(summary: AppPerformanceSummary): PlatformHighlight[] {
  return APP_PERF_PLATFORMS.flatMap((platform) => {
    const groups = summary.groups.filter((group) => group.platform === platform);
    if (!groups.length) return [];
    const launch = groups.find(
      (group) =>
        group.kind === "startup" && group.launchKind === primaryLaunchKind(platform)
    );
    const resumes = groups
      .filter((group) => group.kind === "resume")
      .sort(
        (a, b) =>
          Number(b.launchKind === null) - Number(a.launchKind === null) ||
          b.samples - a.samples
      );
    return [{ platform, launch, resume: resumes[0] }];
  });
}

// --- Filters ----------------------------------------------------------------

export const APP_PERF_RANGES = [
  { days: 1, label: "Last 24 hours" },
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
] as const;

export type AppPerfDays = (typeof APP_PERF_RANGES)[number]["days"];

export const DEFAULT_APP_PERF_DAYS: AppPerfDays = 7;

export const isAppPerfDays = (value: unknown): value is AppPerfDays =>
  APP_PERF_RANGES.some((range) => range.days === value);

export const appPerfRangeLabel = (days: number): string =>
  APP_PERF_RANGES.find((range) => range.days === days)?.label ??
  `Last ${plural(days, "day")}`;

/** The fleet page's filters. Unset means every platform, every version. */
export interface AppPerfFilters {
  days: AppPerfDays;
  platform?: AppPerfPlatform;
  appVersion?: string;
}

/**
 * The filters a URL holds. Unknown values fall back to the defaults rather
 * than being sent on, so a stale link still opens.
 */
export function parseAppPerfFilters(params: {
  get(name: string): string | null;
}): AppPerfFilters {
  const days = Number(params.get("days"));
  const platform = params.get("platform");
  return {
    days: isAppPerfDays(days) ? days : DEFAULT_APP_PERF_DAYS,
    platform: isAppPerfPlatform(platform) ? platform : undefined,
    appVersion: params.get("appVersion")?.trim() || undefined,
  };
}

/** The query string for some filters, defaults left out so the plain page has a plain link. */
export function appPerfFiltersQuery(filters: AppPerfFilters): string {
  const params = new URLSearchParams();
  if (filters.days !== DEFAULT_APP_PERF_DAYS) params.set("days", String(filters.days));
  if (filters.platform) params.set("platform", filters.platform);
  const appVersion = filters.appVersion?.trim();
  if (appVersion) params.set("appVersion", appVersion);
  return params.toString();
}

/** The summary call's params, without the unset ones — "any" is left off, not sent as "". */
export function summaryParams(filters: AppPerfFilters): Record<string, string> {
  const params: Record<string, string> = { days: String(filters.days) };
  if (filters.platform) params.platform = filters.platform;
  const appVersion = filters.appVersion?.trim();
  if (appVersion) params.appVersion = appVersion;
  return params;
}

// --- Queries ----------------------------------------------------------------

/** How many of a user's samples the card reads. */
export const USER_SAMPLES_LIMIT = 50;

/** Query keys, all under `["app-performance"]` so one invalidation refreshes both views. */
export const APP_PERF_KEYS = {
  all: ["app-performance"] as const,
  user: (userId: string, limit: number) =>
    ["app-performance", "user", userId, limit] as const,
  summary: (filters: AppPerfFilters) =>
    ["app-performance", "summary", summaryParams(filters)] as const,
};

/**
 * One user's samples, newest first. Quiet: the card shows its own error, and
 * a toast on every user page that cannot reach it would be noise.
 */
export const getUserAppPerformance = (
  userId: string,
  limit: number = USER_SAMPLES_LIMIT
) =>
  api
    .get<UserAppPerformanceResponse>(
      `/admin/v1/users/${encodeURIComponent(userId)}/app-performance`,
      { params: { limit }, quietErrors: true }
    )
    .then((response) => response.data.data);

/** Percentiles, shares and the causes behind them, fleet-wide. */
export const getAppPerformanceSummary = (filters: AppPerfFilters) =>
  api
    .get<AppPerformanceSummaryResponse>("/admin/v1/app-performance/summary", {
      params: summaryParams(filters),
    })
    .then((response) => response.data.data);
