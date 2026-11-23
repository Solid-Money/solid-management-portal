/**
 * The App performance wire shapes: how long the app's home screen took to show
 * balances at launch ("startup") and on return to the foreground ("resume"),
 * per sample and fleet-wide.
 *
 * Copied verbatim from the contract the backend implements — its copy,
 * solid-backend's `libs/common/src/types/app-performance.types.ts`, is the
 * source of truth — so a diff against it stays empty; single quotes and all.
 * The app's ingest-only report shape is left out: the portal only reads.
 *
 * The envelopes at the bottom are the portal's names for the responses the
 * admin endpoints wrap these in.
 */

export type AppPerfPlatform = 'ios' | 'android' | 'web';
export type AppPerfKind = 'startup' | 'resume';
export type AppPerformanceSampleView = {
  id: string; userId: string; kind: AppPerfKind; platform: AppPerfPlatform;
  occurredAt: string; receivedAt: string; clockSkewed?: boolean; sampleRate: number;
  appVersion?: string; updateId?: string;
  launchKind?: 'cold' | 'ota_reload' | 'page_load' | 'after_login';
  homeReadyMs?: number;      // startup: splash hidden → balances shown; resume: return → balances shown (0 = already on screen)
  visibleToReadyMs?: number; // startup: app first in foreground → balances shown
  jsToReadyMs?: number;
  freshMs?: number;          // resume: return → every balance query refreshed
  backgroundMs?: number;     // resume: time away
  authRefreshMs?: number;
  skeletonShown?: boolean; snapshotShown?: boolean; backgrounded?: boolean; timedOut?: boolean; interrupted?: boolean;
  cacheRestored?: number;
  cacheOutcome?: string;     // restored|empty|cache_version|app_version|no_user|other_user|unreadable|nothing_usable
  snapshotAgeMs?: number;
  slowestGate?: string;      // tokens|vaultBalance|savings|card|portfolio
  gateWaits?: { gate: string; ms: number }[];
  slowQueries?: { key: string; ms: number; failed?: boolean }[];
  tokenFetch?: { totalMs?: number; readsMs?: number; pricingMs?: number; tokenCount?: number; unpricedCount?: number; timedOutReads?: number; failedChains?: number[]; slowestChain?: number; slowestChainMs?: number };
  networkType?: string; jsHeapMb?: number;
};
type Percentiles = { p50: number | null; p90: number | null; p95: number | null };
export type AppPerformanceSummary = {
  from: string; to: string; days: number;
  groups: Array<{
    platform: AppPerfPlatform; kind: AppPerfKind; launchKind: string | null;
    samples: number; estimatedTotal: number; users: number; waited: number;
    homeReadyMs: Percentiles; freshMs: Percentiles;
    over10sShare: number | null; over10sUsers: number;
    skeletonShare: number | null; snapshotShare: number | null;
  }>;
  slowestGates: Array<{ gate: string; samples: number }>;
  slowQueries: Array<{ key: string; samples: number; p50Ms: number | null }>;
  cacheOutcomes: Array<{ platform: string; outcome: string; samples: number; over10s: number }>;
  appVersions: Array<{ appVersion: string; samples: number; over10s: number }>;
};

// ───────────────────────────── Response envelopes (portal names for the shapes above)

/** `GET /admin/v1/users/:id/app-performance?limit=50`, newest first. */
export interface UserAppPerformanceResponse {
  data: AppPerformanceSampleView[];
}

/** `GET /admin/v1/app-performance/summary?days=7&platform=ios&appVersion=2.1.0`. */
export interface AppPerformanceSummaryResponse {
  data: AppPerformanceSummary;
}

/** One row of `AppPerformanceSummary.groups`: a platform × kind × launch kind. */
export type AppPerformanceGroup = AppPerformanceSummary['groups'][number];
