import { describe, expect, it } from "vitest";
import {
  describeTierBalanceRun,
  formatTierBalanceValue,
  tierBalanceChanges,
  tierBalanceFieldErrors,
  toTierBalanceDraft,
} from "@/lib/tier-balance";
import type { TierBalanceConfig, TierBalanceRunResult } from "@/types";

/** A config as the backend might send it; the values are only test data. */
function config(overrides: Partial<TierBalanceConfig> = {}): TierBalanceConfig {
  return {
    enabled: true,
    collectionEnabled: true,
    audience: "team",
    primeUsd: 7_500,
    ultraUsd: 35_000,
    lookbackDays: 30,
    graceDays: 7,
    reentryDays: 30,
    maxMissingDays: 2,
    sampleIntervalMinutes: 60,
    watchFloorUsd: 5_000,
    countCreditCollateral: true,
    subtractCreditDebt: true,
    countLockedFuse: true,
    notificationsEnabled: false,
    ...overrides,
  };
}

describe("tier balance form", () => {
  it("round-trips a saved config with no errors and no changes", () => {
    const draft = toTierBalanceDraft(config());
    expect(draft.primeUsd).toBe("7500");
    expect(draft.audience).toBe("team");
    expect(tierBalanceFieldErrors(draft)).toEqual({});
    expect(tierBalanceChanges(draft, config())).toEqual({});
  });

  it("sends only the fields that changed, as numbers", () => {
    const draft = {
      ...toTierBalanceDraft(config()),
      primeUsd: "10000",
      audience: "everyone" as const,
      notificationsEnabled: true,
      graceDays: " 7 ",
    };
    expect(tierBalanceChanges(draft, config())).toEqual({
      primeUsd: 10_000,
      audience: "everyone",
      notificationsEnabled: true,
    });
  });

  it("refuses blanks, fractions of a day and values out of the contract's ranges", () => {
    const errors = tierBalanceFieldErrors({
      ...toTierBalanceDraft(config()),
      primeUsd: "",
      lookbackDays: "30.5",
      graceDays: "91",
      sampleIntervalMinutes: "14",
      watchFloorUsd: "abc",
      reentryDays: "-1",
    });
    expect(errors).toEqual({
      primeUsd: "Required.",
      lookbackDays: "Must be a whole number.",
      graceDays: "Must be between 0 and 90.",
      sampleIntervalMinutes: "Must be between 15 and 1,440.",
      watchFloorUsd: "Must be a number.",
      reentryDays: "Must be between 0 and 365.",
    });
  });

  it("keeps Ultra above Prime and within its own cap", () => {
    const base = toTierBalanceDraft(config());
    expect(tierBalanceFieldErrors({ ...base, ultraUsd: "7500" }).ultraUsd).toBe(
      "Must be above the Prime threshold ($7,500).",
    );
    expect(tierBalanceFieldErrors({ ...base, ultraUsd: "100000001" }).ultraUsd).toBe(
      "Must be between $100 and $100,000,000.",
    );
    expect(tierBalanceFieldErrors({ ...base, primeUsd: "99" }).primeUsd).toBe(
      "Must be between $100 and $10,000,000.",
    );
  });

  it("allows at most one day fewer unmeasured than the lookback", () => {
    const base = toTierBalanceDraft(config());
    expect(tierBalanceFieldErrors({ ...base, maxMissingDays: "29" })).toEqual({});
    expect(tierBalanceFieldErrors({ ...base, maxMissingDays: "30" }).maxMissingDays).toBe(
      "Must be between 0 and 29 — fewer than the lookback.",
    );
    expect(
      tierBalanceFieldErrors({ ...base, lookbackDays: "1", maxMissingDays: "1" }).maxMissingDays,
    ).toBe("Must be 0 while the lookback is 1 day.");
  });
});

describe("tier balance labels", () => {
  it("formats a preview's from and to values by field", () => {
    expect(formatTierBalanceValue("primeUsd", 7500)).toBe("$7,500");
    expect(formatTierBalanceValue("lookbackDays", 1)).toBe("1 day");
    expect(formatTierBalanceValue("graceDays", 7)).toBe("7 days");
    expect(formatTierBalanceValue("sampleIntervalMinutes", 60)).toBe("60 min");
    expect(formatTierBalanceValue("enabled", false)).toBe("Off");
    expect(formatTierBalanceValue("audience", "everyone")).toBe("Everyone");
    expect(formatTierBalanceValue("watchFloorUsd", null)).toBe("—");
  });

  it("describes what a run now did", () => {
    const sample: TierBalanceRunResult = {
      action: "sample",
      evaluated: null,
      run: {
        id: "r1",
        kind: "full",
        trigger: "admin",
        status: "partial",
        dayKey: "2026-11-24",
        startedAt: "2026-11-24T10:00:00.000Z",
        completedAt: "2026-11-24T10:05:00.000Z",
        stats: { scanned: 1200, valued: 1190, incomplete: 10, written: 1190, aboveFloor: 80 },
        prices: null,
        error: null,
        adminEmail: "admin@example.com",
      },
    };
    expect(describeTierBalanceRun(sample)).toBe(
      "Full measurement for 2026-11-24: partial. 1,200 Safes scanned, 1,190 valued, 1,190 written, 10 incomplete, 80 at or above the watch floor.",
    );
    expect(
      describeTierBalanceRun({
        action: "evaluate",
        run: null,
        evaluated: { day: "2026-11-23", users: 1, unlocked: 1, graceStarted: 0, graceCleared: 0, ended: 0 },
      }),
    ).toBe("Evaluated 2026-11-23: 1 user checked; 1 unlocked, 0 entered grace, 0 cleared grace, 0 ended.");
    expect(describeTierBalanceRun({ action: "evaluate", run: null, evaluated: null })).toBe(
      "The server reported no evaluation.",
    );
  });
});
