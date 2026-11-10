import { describe, expect, it } from "vitest";
import {
  buyerTotals,
  buyersBars,
  buyersTrend,
  cashbackToRevenue,
  cohortLabel,
  guardrails,
  isGoodCustomersResponse,
  memberTotals,
  netPerQualified,
  perSpender,
  qualifiedCashbackMultiple,
  tiersOf,
  weeklyBars,
} from "@/lib/good-customers";
import type { GoodCustomersResponse, GoodCustomersTiers } from "@/types/overview";

function response(overrides: Partial<GoodCustomersResponse> = {}): GoodCustomersResponse {
  return {
    asOf: "2026-11-02",
    definition: {
      version: 1,
      windowDays: 28,
      minSpendDays: 3,
      minSpendUsd: 100,
      highValueSpendUsd: 500,
      highValueMoneyInUsd: 500,
    },
    ladder: {
      cardholders: 4600,
      realCustomers: 2380,
      activeSpenders: 1430,
      qualified: 640,
      highValue: 300,
      neverFundedOrSpent: 2220,
      neverFundedTopCountry: { country: "BD", count: 1070 },
    },
    spend: { allUsd: 700_000, qualifiedUsd: 595_000 },
    weekly: [
      { date: "2026-10-26", activeSpenders: 1400, qualified: 637 },
      { date: "2026-11-02", activeSpenders: 1430, qualified: 640 },
    ],
    retention: null,
    economics: {
      days: 90,
      cashbackUsd: 26_000,
      feesUsd: 600,
      primeUsd: 400,
      coveringOwnCashback: 2,
    },
    allCustomers90: { cashbackUsd: 34_000, primeUsd: 1_000 },
    referralBar: { spendUsd: 150, bunched: 165 },
    cohorts: [],
    feeRevenueUsd90: 2_400,
    generatedAt: "2026-11-03T12:00:00.000Z",
    ...overrides,
  };
}

describe("Good customers numbers", () => {
  it("nets fees and Prime against cashback per qualified customer", () => {
    expect(netPerQualified(response())).toBeCloseTo((600 + 400 - 26_000) / 640);
    expect(qualifiedCashbackMultiple(response())).toBe(26);
    expect(netPerQualified(response({ ladder: { ...response().ladder, qualified: 0 } }))).toBeNull();
  });

  it("compares everyone's cashback with fee revenue plus Prime", () => {
    expect(cashbackToRevenue(response())).toBe(10);
    expect(cashbackToRevenue(response({ feeRevenueUsd90: null }))).toBeNull();
  });

  it("stacks other spenders on top of the qualified", () => {
    expect(weeklyBars(response())[1]).toEqual({
      date: "2026-11-02",
      qualified: 640,
      others: 790,
      activeSpenders: 1430,
    });
  });

  it("marks an unfinished month as so far", () => {
    const cohort = { month: "2026-11", cardholders: 1, realCustomers: 1, firstPurchase: 0, qualified: 0 };
    expect(cohortLabel({ ...cohort, complete: false })).toBe("November (so far)");
    expect(cohortLabel({ ...cohort, month: "2026-09", complete: true })).toBe("September");
  });
});

describe("guardrails", () => {
  it("flags cost guardrails off track and base quality ones to watch", () => {
    const rows = guardrails(response());
    expect(rows.map((r) => [r.key, r.value, r.status])).toEqual([
      ["cashback", "10×", "off"],
      ["covering", "2 of 640", "off"],
      ["never-funded", "48%", "watch"],
      ["referral-bar", "165", "watch"],
    ]);
    expect(rows[2].detail).toBe("2,220 people; 1,070 of them in Bangladesh");
  });

  it("says unknown, not fine, when fee revenue is missing", () => {
    const [cashback] = guardrails(response({ feeRevenueUsd90: null }));
    expect(cashback.status).toBe("unknown");
    expect(cashback.value).toBe("—");
  });

  it("leaves the referral row out when there is no bar", () => {
    expect(guardrails(response({ referralBar: null })).map((r) => r.key)).not.toContain("referral-bar");
  });
});

describe("isGoodCustomersResponse", () => {
  it("accepts a full response, with or without the optional parts", () => {
    expect(isGoodCustomersResponse(response())).toBe(true);
    expect(
      isGoodCustomersResponse(response({ referralBar: null, feeRevenueUsd90: null, retention: null })),
    ).toBe(true);
  });

  it("rejects a payload missing what the tab reads", () => {
    const noDefinition: Record<string, unknown> = { ...response() };
    delete noDefinition.definition;
    expect(isGoodCustomersResponse(noDefinition)).toBe(false);
    expect(isGoodCustomersResponse({ ...response(), weekly: [{ date: "2026-11-02" }] })).toBe(false);
    expect(isGoodCustomersResponse(null)).toBe(false);
    expect(isGoodCustomersResponse("<html>")).toBe(false);
  });
});


/** The Tiers block for Nov 3 – 9 2026, as production reads it. */
function tiersBlock(): GoodCustomersTiers {
  const week = (date: string, paid = 0, lock = 0) => ({ date, paid, lock });
  return {
    source: "records",
    members: {
      prime: 281,
      ultra: 46,
      withCard: 285,
      byRoute: { paid: 16, lock: 41, trial: 167, legacy: 103 },
    },
    bought: { total: 57, paid: 16, lockPrime: 38, lockUltra: 3, lastWeek: 4, primeAnnualUsd: 199 },
    table: [
      {
        tier: "ultra",
        cardholders: 34,
        byRoute: { paid: 0, lock: 4, trial: 14, legacy: 16 },
        spenders: 25,
        qualified: 20,
        spendUsd: 26_603.16,
      },
      {
        tier: "prime",
        cardholders: 251,
        byRoute: { paid: 16, lock: 37, trial: 143, legacy: 55 },
        spenders: 160,
        qualified: 101,
        spendUsd: 183_427.14,
      },
      {
        tier: "core",
        cardholders: 4484,
        byRoute: { paid: 0, lock: 0, trial: 0, legacy: 0 },
        spenders: 1218,
        qualified: 475,
        spendUsd: 445_394.86,
      },
    ],
    routes: [
      { route: "paid", cardholders: 16, spenders: 16, qualified: 15, spendUsd: 38_537.27 },
      { route: "lock", cardholders: 41, spenders: 37, qualified: 33, spendUsd: 69_360.7 },
      { route: "legacy", cardholders: 71, spenders: 60, qualified: 40, spendUsd: 56_634.42 },
      { route: "trial", cardholders: 157, spenders: 72, qualified: 33, spendUsd: 45_497.91 },
      { route: "core", cardholders: 4484, spenders: 1218, qualified: 475, spendUsd: 445_394.86 },
    ],
    weeklyBuyers: [
      week("2026-08-17"),
      week("2026-08-24"),
      week("2026-08-31"),
      week("2026-09-07"),
      week("2026-09-14"),
      week("2026-09-21"),
      week("2026-09-28", 1, 1),
      week("2026-10-05", 3, 15),
      week("2026-10-12", 6, 16),
      week("2026-10-19", 1, 4),
      week("2026-10-26", 2, 0),
      week("2026-11-02", 2, 2),
      week("2026-11-09", 1, 3),
    ],
    trials: { gifted: 1387, accepted: 699, onTrial: 168, ended: 531, endedThenBought: 11, since: "2026-09-10" },
    legacy: { members: 103, spenders: 60, spendUsd: 56_634.42, endsOn: "2027-03-24" },
  };
}

describe("Tiers section", () => {
  it("accepts a full block and turns a missing or broken one into null", () => {
    expect(tiersOf(response({ tiers: tiersBlock() }))).not.toBeNull();
    expect(tiersOf(response())).toBeNull();
    expect(tiersOf(response({ tiers: null }))).toBeNull();
    const broken = { ...tiersBlock(), trials: { gifted: 1 } } as unknown as GoodCustomersTiers;
    expect(tiersOf(response({ tiers: broken }))).toBeNull();
    // A broken Tiers block never fails the rest of the tab.
    expect(isGoodCustomersResponse(response({ tiers: broken }))).toBe(true);
  });

  it("adds Ultra and Prime cardholders up to the members' share of spend", () => {
    const members = memberTotals(tiersBlock());
    expect(members.spenders).toBe(185);
    expect(members.spendUsd / 655_425.16).toBeCloseTo(0.32, 2);
    expect(perSpender(members)).toBeCloseTo(1135.3, 1);
  });

  it("takes buyers as paid plus locked", () => {
    const buyers = buyerTotals(tiersBlock());
    expect(buyers).toMatchObject({ spenders: 53, qualified: 48 });
    expect(perSpender(buyers)).toBeCloseTo(2035.81, 1);
  });

  it("charts weekly buyers from the first week anyone bought", () => {
    const bars = buyersBars(tiersBlock());
    expect(bars.map((b) => b.total)).toEqual([2, 18, 22, 5, 2, 4, 4]);
    expect(buyersTrend(tiersBlock())).toEqual({ recent: 15, before: 42, weeks: 4 });
  });

  it("adds the legacy and trial guardrails when there are tiers", () => {
    const rows = guardrails(response({ tiers: tiersBlock() }));
    expect(rows.map((r) => r.key)).toEqual([
      "cashback",
      "covering",
      "never-funded",
      "referral-bar",
      "legacy-ending",
      "trial-to-paid",
    ]);
    expect(rows[4]).toMatchObject({
      title: "Legacy members whose tier ends Mar 24",
      value: "103",
      status: "watch",
    });
    expect(rows[4].detail).toContain("60 of the 103 spent $56.6K in the last 28 days");
    expect(rows[5]).toMatchObject({
      title: "Free trials that led to a purchase",
      detail:
        "11 of 531 people whose trial ended bought a tier after accepting it. 688 gifted trials were never accepted",
      value: "2%",
      status: "watch",
    });
    expect(guardrails(response()).map((r) => r.key)).not.toContain("legacy-ending");
  });
});
