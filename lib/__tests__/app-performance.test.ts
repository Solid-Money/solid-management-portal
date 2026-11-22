import { describe, expect, it, vi } from "vitest";
import {
  APP_PERF_KEYS,
  appLabel,
  appPerfFiltersQuery,
  balancesAfter,
  balancesPhrase,
  bySamples,
  cacheOutcomeShort,
  cacheSummary,
  countsLine,
  describeCacheOutcome,
  describeGate,
  formatMs,
  formatShare,
  heldUpByPhrase,
  holdUpDetails,
  isOver10s,
  kindLabel,
  parseAppPerfFilters,
  platformHighlights,
  platformLabel,
  sampleCounts,
  sampleHeadline,
  sampleNotes,
  sampleTimings,
  sampleTypeLabel,
  sawLabel,
  severity,
  severityClass,
  shareOf,
  shortUpdateId,
  sortGroups,
  summaryParams,
  tokenFetchDetails,
  waitMs,
} from "@/lib/app-performance";
import type {
  AppPerformanceGroup,
  AppPerformanceSampleView,
  AppPerformanceSummary,
} from "@/types/app-performance";

// `@/lib/app-performance` imports the API client, which starts Firebase on
// load; the helpers under test never call it. (Hoisted above the imports.)
vi.mock("@/lib/api", () => ({ default: {} }));

const startup = (
  overrides: Partial<AppPerformanceSampleView> = {}
): AppPerformanceSampleView => ({
  id: "s1",
  userId: "u1",
  kind: "startup",
  platform: "ios",
  occurredAt: "2026-11-20T10:00:00.000Z",
  receivedAt: "2026-11-20T10:00:05.000Z",
  sampleRate: 1,
  launchKind: "cold",
  ...overrides,
});

const resume = (
  overrides: Partial<AppPerformanceSampleView> = {}
): AppPerformanceSampleView => ({
  id: "r1",
  userId: "u1",
  kind: "resume",
  platform: "android",
  occurredAt: "2026-11-20T11:00:00.000Z",
  receivedAt: "2026-11-20T11:00:01.000Z",
  sampleRate: 1,
  ...overrides,
});

const percentiles = (p50: number | null, p90: number | null = p50, p95 = p90) => ({
  p50,
  p90,
  p95,
});

const group = (overrides: Partial<AppPerformanceGroup> = {}): AppPerformanceGroup => ({
  platform: "ios",
  kind: "startup",
  launchKind: "cold",
  samples: 10,
  estimatedTotal: 10,
  users: 5,
  waited: 8,
  homeReadyMs: percentiles(3_000, 12_000),
  freshMs: percentiles(4_000),
  over10sShare: 0.1,
  over10sUsers: 1,
  skeletonShare: 0.5,
  snapshotShare: 0.2,
  ...overrides,
});

describe("formatMs", () => {
  it.each([
    [850, "0.9s"],
    [12_400, "12.4s"],
    [5_000, "5.0s"],
    [59_940, "59.9s"],
    [59_960, "1m"],
    [95_000, "1m 35s"],
    [120_000, "2m"],
    [3_599_600, "1h"],
    [7_500_000, "2h 5m"],
    [36 * 3_600_000, "1d 12h"],
    [48 * 3_600_000, "2d"],
    [0, "0s"],
    [30, "<0.1s"],
  ])("%d → %s", (ms, text) => {
    expect(formatMs(ms)).toBe(text);
  });

  it.each([null, undefined, Number.NaN, -5])("%s → —", (ms) => {
    expect(formatMs(ms)).toBe("—");
  });
});

describe("severity", () => {
  it.each([
    [0, "ok"],
    [4_999, "ok"],
    [5_000, "slow"],
    [10_000, "slow"],
    [10_001, "bad"],
    [150_000, "bad"],
  ] as const)("%d → %s", (ms, level) => {
    expect(severity(ms)).toBe(level);
  });

  it("colours nothing when there is no duration", () => {
    expect(severityClass(undefined)).toBe("text-gray-400");
    expect(severityClass(null)).toBe("text-gray-400");
    expect(severityClass(12_000)).toContain("text-red-700");
  });
});

describe("formatShare", () => {
  it.each([
    [0.1234, "12.3%"],
    [0, "0.0%"],
    [1, "100.0%"],
    [0.0004, "<0.1%"],
    [0.0005, "0.1%"],
  ])("%d → %s", (share, text) => {
    expect(formatShare(share)).toBe(text);
  });

  it.each([null, undefined, Number.NaN])("%s → —", (share) => {
    expect(formatShare(share)).toBe("—");
  });

  it("takes a share only of something", () => {
    expect(shareOf(1, 4)).toBe(0.25);
    expect(shareOf(0, 0)).toBeNull();
  });
});

describe("describeCacheOutcome", () => {
  it.each([
    ["restored", "Saved balances restored"],
    ["cache_version", "Cache dropped: cache version changed"],
    ["app_version", "Cache dropped: app updated"],
    ["empty", "No saved balances"],
    ["nothing_usable", "Saved balances too old or unreadable"],
    ["other_user", "Cache dropped: saved for a different account"],
    ["no_user", "Cache not used: no signed-in user at launch"],
    ["unreadable", "Cache dropped: saved balances could not be read"],
  ])("%s → %s", (outcome, text) => {
    expect(describeCacheOutcome(outcome)).toBe(text);
  });

  it("shows an outcome it does not know as sent, and none as a dash", () => {
    expect(describeCacheOutcome("disk_full")).toBe("disk_full");
    expect(describeCacheOutcome(undefined)).toBe("—");
    expect(cacheOutcomeShort("app_version")).toBe("App updated");
    expect(cacheOutcomeShort("disk_full")).toBe("disk_full");
  });
});

describe("cacheSummary", () => {
  it("gives the outcome, the restored count and the snapshot's age", () => {
    expect(
      cacheSummary(
        startup({ cacheOutcome: "restored", cacheRestored: 7, snapshotAgeMs: 7_500_000 })
      )
    ).toEqual({
      label: "Restored (7)",
      title:
        "Saved balances restored · 7 saved queries restored · last-known balances were 2h 5m old",
    });
  });

  it("leaves a zero count off the label", () => {
    expect(cacheSummary(startup({ cacheOutcome: "app_version", cacheRestored: 0 }))?.label).toBe(
      "App updated"
    );
  });

  it("is null when the sample says nothing about the cache", () => {
    expect(cacheSummary(resume())).toBeNull();
  });
});

describe("describeGate", () => {
  it.each([
    ["tokens", "Wallet tokens"],
    ["vaultBalance", "Vault balances"],
    ["savings", "Savings total"],
    ["card", "Card status"],
    ["portfolio", "Portfolio"],
    ["rewards", "rewards"],
  ])("%s → %s", (gate, label) => {
    expect(describeGate(gate)).toBe(label);
  });

  it("is a dash for no gate", () => {
    expect(describeGate(undefined)).toBe("—");
  });
});

describe("waitMs", () => {
  it("is the time until balances showed", () => {
    expect(waitMs(startup({ homeReadyMs: 12_400, freshMs: 15_000 }))).toBe(12_400);
    expect(waitMs(resume({ homeReadyMs: 3_000, freshMs: 9_000 }))).toBe(3_000);
  });

  it("falls back to the refresh for a resume that kept balances on screen", () => {
    expect(waitMs(resume({ homeReadyMs: 0, freshMs: 4_200 }))).toBe(4_200);
    expect(waitMs(resume({ homeReadyMs: 0 }))).toBe(0);
  });

  it("does not fall back for a launch", () => {
    expect(waitMs(startup({ freshMs: 4_200 }))).toBeUndefined();
  });

  it("is no wait for a resume with a refresh but no home-ready time", () => {
    // The home screen was not open: the card shows the refresh as context.
    const sample = resume({ freshMs: 25_000 });
    expect(waitMs(sample)).toBeUndefined();
    expect(isOver10s(sample)).toBe(false);
    expect(balancesPhrase(sample)).toBe(
      "home screen not open, balances refreshed after 25.0s"
    );
  });
});

describe("platformLabel", () => {
  it("names the known platforms and passes others through", () => {
    expect(platformLabel("ios")).toBe("iOS");
    expect(platformLabel("android")).toBe("Android");
    expect(platformLabel("tvos")).toBe("tvos");
  });

  it("never returns an inherited property", () => {
    expect(platformLabel("toString")).toBe("toString");
    expect(platformLabel("__proto__")).toBe("__proto__");
    expect(describeGate("constructor")).toBe("constructor");
    expect(describeCacheOutcome("hasOwnProperty")).toBe("hasOwnProperty");
  });
});

describe("sampleTypeLabel", () => {
  it.each([
    [startup(), "Launch (cold)"],
    [startup({ launchKind: "ota_reload" }), "Launch (OTA)"],
    [startup({ launchKind: "page_load", platform: "web" }), "Launch (web load)"],
    [startup({ launchKind: "after_login" }), "Launch (after login)"],
    [startup({ launchKind: undefined }), "Launch"],
    [resume({ backgroundMs: 7_500_000 }), "Resume after 2h 5m"],
    [resume(), "Resume"],
  ])("%#: %s", (sample, label) => {
    expect(sampleTypeLabel(sample)).toBe(label);
  });

  it("names a summary group", () => {
    expect(kindLabel("startup", "cold")).toBe("Launch (cold)");
    expect(kindLabel("resume", null)).toBe("Resume");
  });
});

describe("sampleHeadline", () => {
  it("says what kind, how long and what held it up", () => {
    expect(
      sampleHeadline(startup({ homeReadyMs: 12_400, slowestGate: "tokens" }))
    ).toBe("Launch (cold) · balances after 12.4s · held up by wallet tokens");
  });

  it("says when a resume found balances already on screen", () => {
    expect(
      sampleHeadline(
        resume({ backgroundMs: 600_000, homeReadyMs: 0, freshMs: 3_100, slowestGate: "savings" })
      )
    ).toBe(
      "Resume after 10m · balances already shown, refreshed after 3.1s · held up by savings total"
    );
  });

  it("blames nothing when nobody waited", () => {
    expect(heldUpByPhrase(resume({ homeReadyMs: 0, slowestGate: "card" }))).toBeNull();
  });

  it("explains the samples without a time", () => {
    expect(balancesPhrase(startup({ timedOut: true }))).toBe(
      "timed out before balances showed"
    );
    expect(balancesPhrase(startup({ timedOut: true, homeReadyMs: 60_000 }))).toBe(
      "still loading after 1m (timed out)"
    );
    expect(balancesPhrase(startup({ backgrounded: true }))).toBe(
      "left the app before balances showed"
    );
    expect(balancesPhrase(startup({ backgrounded: true, homeReadyMs: 45_000 }))).toBe(
      "balances after 45.0s (app was in the background meanwhile)"
    );
    expect(balancesPhrase(startup({ interrupted: true }))).toBe("measurement interrupted");
    expect(balancesPhrase(startup())).toBe("no timing reported");
  });
});

describe("balancesAfter", () => {
  it("colours a time by its severity", () => {
    expect(balancesAfter(startup({ homeReadyMs: 12_400 }))).toEqual({
      text: "12.4s",
      severity: "bad",
    });
    expect(balancesAfter(startup({ homeReadyMs: 1_200 }))).toEqual({
      text: "1.2s",
      severity: "ok",
    });
  });

  it("does not judge a resume that never left the screen", () => {
    expect(balancesAfter(resume({ homeReadyMs: 0, freshMs: 20_000 }))).toEqual({
      text: "already shown",
      severity: null,
    });
  });

  it("counts a time-out as bad", () => {
    expect(balancesAfter(startup({ timedOut: true }))).toEqual({
      text: "timed out",
      severity: "bad",
    });
  });
});

describe("sawLabel", () => {
  it("names what was on screen while balances loaded", () => {
    expect(sawLabel(startup({ skeletonShown: true }))?.label).toBe("Skeleton");
    expect(sawLabel(startup({ snapshotShown: true }))?.label).toBe("Last-known");
    expect(sawLabel(startup({ snapshotShown: true, skeletonShown: true }))?.label).toBe(
      "Last-known + skeleton"
    );
    expect(sawLabel(startup())).toBeNull();
  });
});

describe("holdUpDetails", () => {
  it("lists the gates and slow queries, longest first", () => {
    expect(
      holdUpDetails(
        startup({
          gateWaits: [
            { gate: "card", ms: 1_200 },
            { gate: "tokens", ms: 12_400 },
          ],
          slowQueries: [{ key: "tokens:balances", ms: 11_900, failed: true }],
        })
      )
    ).toEqual([
      "Waited on:",
      "  Wallet tokens: 12.4s",
      "  Card status: 1.2s",
      "Slow queries:",
      "  tokens:balances: 11.9s (failed)",
    ]);
  });

  it("is empty when there is nothing to list", () => {
    expect(holdUpDetails(startup())).toEqual([]);
  });
});

describe("tokenFetchDetails", () => {
  it("spells the token fetch out", () => {
    expect(
      tokenFetchDetails({
        totalMs: 12_400,
        readsMs: 10_100,
        pricingMs: 2_300,
        tokenCount: 14,
        unpricedCount: 2,
        timedOutReads: 1,
        failedChains: [8453, 999],
        slowestChain: 137,
        slowestChainMs: 9_800,
      })
    ).toEqual([
      "12.4s in all (reads 10.1s, pricing 2.3s)",
      "14 tokens, 2 without a price",
      "1 chain read timed out",
      "Failed on Base, Chain 999",
      "Slowest chain: Polygon (9.8s)",
    ]);
  });

  it("is empty without a fetch", () => {
    expect(tokenFetchDetails(undefined)).toEqual([]);
  });

  it("keeps an unpriced count reported without a total", () => {
    expect(tokenFetchDetails({ unpricedCount: 2 })).toEqual([
      "2 tokens without a price",
    ]);
    expect(tokenFetchDetails({ unpricedCount: 1 })).toEqual([
      "1 token without a price",
    ]);
  });
});

describe("sampleTimings and sampleNotes", () => {
  it("lists a resume's timings, with 0 as already shown", () => {
    expect(sampleTimings(resume({ backgroundMs: 600_000, homeReadyMs: 0, freshMs: 3_100 }))).toEqual([
      { label: "Time away", value: "10m" },
      { label: "Return → balances", value: "already shown" },
      { label: "Return → every balance refreshed", value: "3.1s" },
    ]);
  });

  it("lists a launch's timings", () => {
    expect(sampleTimings(startup({ homeReadyMs: 12_400, visibleToReadyMs: 13_000 }))).toEqual([
      { label: "Splash hidden → balances", value: "12.4s" },
      { label: "App in foreground → balances", value: "13.0s" },
    ]);
  });

  it("notes sampling, the clock and the device", () => {
    expect(
      sampleNotes(resume({ sampleRate: 0.1, clockSkewed: true, networkType: "cellular", jsHeapMb: 181.6 }))
    ).toEqual([
      "The device clock looked wrong; the time shown may be off",
      "Sampled: 1 in 10 reported, so it stands for about 10",
      "Network: cellular",
      "JS heap: 182 MB",
    ]);
  });
});

describe("appLabel", () => {
  it("shows the version and the start of the update id", () => {
    expect(
      appLabel(startup({ appVersion: "2.1.0", updateId: "3f2a9c1b-0d4e-4f00-9a1b-2c3d4e5f6a7b" }))
    ).toBe("2.1.0 · 3f2a9c1b");
    expect(appLabel(startup())).toBe("—");
    expect(shortUpdateId(undefined)).toBeUndefined();
  });
});

describe("sampleCounts", () => {
  it("counts launches, resumes and waits over 10 seconds", () => {
    const counts = sampleCounts([
      startup({ homeReadyMs: 12_400 }),
      startup({ homeReadyMs: 2_000 }),
      resume({ homeReadyMs: 0, freshMs: 11_000 }),
      resume({ homeReadyMs: 0, freshMs: 1_000 }),
      resume({ homeReadyMs: 10_000 }),
    ]);
    expect(counts).toEqual({ launches: 2, resumes: 3, over10s: 2 });
    expect(countsLine(counts)).toBe("2 launches and 3 resumes · 2 took over 10s");
  });

  it("says when none were slow, in the singular where it should", () => {
    expect(countsLine({ launches: 1, resumes: 1, over10s: 0 })).toBe(
      "1 launch and 1 resume · none took over 10s"
    );
    expect(isOver10s(startup())).toBe(false);
  });
});

describe("the fleet summary", () => {
  const summary = (groups: AppPerformanceGroup[]): AppPerformanceSummary => ({
    from: "2026-11-15T00:00:00.000Z",
    to: "2026-11-22T00:00:00.000Z",
    days: 7,
    groups,
    slowestGates: [],
    slowQueries: [],
    cacheOutcomes: [],
    appVersions: [],
  });

  it("sorts groups by platform, launches first, cold first", () => {
    const sorted = sortGroups([
      group({ platform: "web", launchKind: "page_load" }),
      group({ platform: "android", kind: "resume", launchKind: null }),
      group({ platform: "ios", launchKind: "ota_reload" }),
      group({ platform: "android", launchKind: "cold" }),
      group({ platform: "ios", launchKind: "cold" }),
    ]);
    expect(sorted.map((g) => `${g.platform}:${g.kind}:${g.launchKind}`)).toEqual([
      "ios:startup:cold",
      "ios:startup:ota_reload",
      "android:startup:cold",
      "android:resume:null",
      "web:startup:page_load",
    ]);
  });

  it("picks each platform's cold launch (page load on the web) and resumes", () => {
    const iosCold = group();
    const iosResume = group({ kind: "resume", launchKind: null });
    const webLoad = group({ platform: "web", launchKind: "page_load" });
    const highlights = platformHighlights(
      summary([
        group({ launchKind: "ota_reload" }),
        iosResume,
        iosCold,
        webLoad,
      ])
    );
    expect(highlights).toEqual([
      { platform: "ios", launch: iosCold, resume: iosResume },
      { platform: "web", launch: webLoad, resume: undefined },
    ]);
  });

  it("prefers the resume group without a launch kind, else the largest", () => {
    const small = group({ kind: "resume", launchKind: "x", samples: 2 });
    const large = group({ kind: "resume", launchKind: "y", samples: 20 });
    expect(platformHighlights(summary([small, large]))[0].resume).toBe(large);
  });

  it("ranks causes by how often they show up", () => {
    expect(
      bySamples([
        { gate: "card", samples: 2 },
        { gate: "tokens", samples: 9 },
      ]).map((row) => row.gate)
    ).toEqual(["tokens", "card"]);
  });
});

describe("filters", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("defaults to the last 7 days, every platform and version", () => {
    expect(parseAppPerfFilters(params(""))).toEqual({
      days: 7,
      platform: undefined,
      appVersion: undefined,
    });
  });

  it("reads a link", () => {
    expect(parseAppPerfFilters(params("days=30&platform=android&appVersion=%202.1.0%20"))).toEqual({
      days: 30,
      platform: "android",
      appVersion: "2.1.0",
    });
  });

  it("ignores values it does not know", () => {
    expect(parseAppPerfFilters(params("days=90&platform=windows"))).toEqual({
      days: 7,
      platform: undefined,
      appVersion: undefined,
    });
  });

  it("writes the defaults out of the link", () => {
    expect(appPerfFiltersQuery({ days: 7 })).toBe("");
    expect(appPerfFiltersQuery({ days: 1, platform: "ios", appVersion: " 2.1.0 " })).toBe(
      "days=1&platform=ios&appVersion=2.1.0"
    );
  });

  it("sends only what is set, and keys the query on it", () => {
    expect(summaryParams({ days: 14, appVersion: "  " })).toEqual({ days: "14" });
    expect(summaryParams({ days: 7, platform: "web", appVersion: "2.1.0" })).toEqual({
      days: "7",
      platform: "web",
      appVersion: "2.1.0",
    });
    expect(APP_PERF_KEYS.summary({ days: 7, appVersion: " " })).toEqual(
      APP_PERF_KEYS.summary({ days: 7 })
    );
  });
});
