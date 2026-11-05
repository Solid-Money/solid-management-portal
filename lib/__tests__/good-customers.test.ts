import { describe, expect, it } from "vitest";
import {
  cashbackToRevenue,
  cohortLabel,
  guardrails,
  isGoodCustomersResponse,
  netPerQualified,
  qualifiedCashbackMultiple,
  weeklyBars,
} from "@/lib/good-customers";
import type { GoodCustomersResponse } from "@/types/overview";

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

