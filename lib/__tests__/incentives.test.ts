import { describe, expect, it } from "vitest";
import fixtureJson from "@/lib/__tests__/fixtures/incentives-oct26-nov1.json";
import {
  axisTicks,
  centsUsd,
  changeVsText,
  checkChip,
  checkValue,
  dueBars,
  earnedCaption,
  isIncentivesResponse,
  lateCashbackNote,
  newCashbackNote,
  overdueNote,
  payDelayText,
  programRows,
  referralPauseNotes,
  sentCaption,
  sharePercent,
  shortSpan,
  spendCaption,
  splitAmounts,
  splitShares,
  weeklyBars,
  weeklyNotes,
  weeklyTicks,
  weeklyTotalsText,
  weeksDescription,
  wholeUsd,
} from "@/lib/incentives";
import { compactUsd } from "@/lib/overview-format";
import type { IncentivesResponse, IncentivesWeek } from "@/types/overview";

/**
 * Oct 26 – Nov 1 2026 as the spec validated it (spec/final.json, snapshot
 * Nov 8 12:00 UTC), in the API contract's shape.
 */
const fixture = fixtureJson as IncentivesResponse;
const clone = (): IncentivesResponse => structuredClone(fixture);
/** Captions keep date spans together with no-break spaces; compare as plain text. */
const plain = (text: string | null) => text?.replace(/ /g, " ") ?? null;

function week(weekStart: string, referrals: number, partial = false): IncentivesWeek {
  return {
    weekStart,
    weekEnd: weekStart,
    partial,
    sent: { cashback: 10, referrals, perks: 0, yieldBoost: 0, corrections: 0, total: 10 + referrals },
    earned: { cashback: 10, referrals: 0, perks: 0, yieldBoost: 0, total: 10 },
    cardSpend: 100,
  };
}

describe("isIncentivesResponse", () => {
  it("accepts the contract's response", () => {
    expect(isIncentivesResponse(fixture)).toBe(true);
  });

  it("accepts the nulls the contract allows", () => {
    const data = clone();
    data.totals.cardSpendPerIncentiveDollar = { current: null, previous: null, average13Weeks: null };
    data.totals.earnedShareOfCardSpend = null;
    data.checks[0].value = null;
    data.checks[0].status = "not_available";
    data.programs.push({ key: "ai_cashback", label: "AI-agent cashback", status: "not_launched", sentUsd: null, earnedUsd: null, payments: null });
    expect(isIncentivesResponse(data)).toBe(true);
  });

  it("accepts a range with only the days the tab reads", () => {
    const data = clone() as unknown as Record<string, unknown>;
    data.range = { from: "2026-10-26", to: "2026-11-01", previousFrom: "2026-10-19", previousTo: "2026-10-25", days: 7 };
    expect(isIncentivesResponse(data)).toBe(true);
  });

  it.each([
    ["not an object", () => null],
    ["no totals", () => ({ ...clone(), totals: undefined })],
    ["a definition without its week rule", () => {
      const data = clone() as unknown as { definition: Record<string, unknown> };
      delete data.definition.weekStartsOn;
      return data;
    }],
    ["sent as a string", () => {
      const data = clone() as unknown as { totals: { sent: { current: unknown } } };
      data.totals.sent.current = "10658.98";
      return data;
    }],
    ["no earnedPaysOn", () => {
      const data = clone() as unknown as { totals: Record<string, unknown> };
      delete data.totals.earnedPaysOn;
      return data;
    }],
    ["programs not a list", () => ({ ...clone(), programs: {} })],
    ["a program without a label", () => {
      const data = clone() as unknown as { programs: Array<Record<string, unknown>> };
      delete data.programs[0].label;
      return data;
    }],
    ["a week without partial", () => {
      const data = clone() as unknown as { weekly: Array<Record<string, unknown>> };
      delete data.weekly[0].partial;
      return data;
    }],
    ["a week's sent missing corrections", () => {
      const data = clone() as unknown as { weekly: Array<{ sent: Record<string, unknown> }> };
      delete data.weekly[3].sent.corrections;
      return data;
    }],
    ["coming due weeks missing", () => {
      const data = clone() as unknown as { comingDue: Record<string, unknown> };
      delete data.comingDue.weeks;
      return data;
    }],
    ["a check value as text", () => {
      const data = clone() as unknown as { checks: Array<Record<string, unknown>> };
      data.checks[0].value = "99.1%";
      return data;
    }],
    ["a not-counted row without why", () => {
      const data = clone() as unknown as { notIncluded: Array<Record<string, unknown>> };
      delete data.notIncluded[0].why;
      return data;
    }],
    ["NaN in a total", () => {
      const data = clone();
      data.totals.cardSpend.current = Number.NaN;
      return data;
    }],
  ])("rejects %s", (_, build) => {
    expect(isIncentivesResponse(build())).toBe(false);
  });
});

describe("formatting", () => {
  it("shows the tiles' numbers as designed", () => {
    expect(wholeUsd(10_658.98)).toBe("$10,659");
    expect(wholeUsd(9_906.16)).toBe("$9,906");
    expect(wholeUsd(0)).toBe("$0");
    expect(wholeUsd(-91.12)).toBe("−$91");
    expect(compactUsd(17_749.2)).toBe("$17.7K");
    expect(compactUsd(32_254.05)).toBe("$32.3K");
    expect(centsUsd(16.89)).toBe("$16.89");
    expect(centsUsd(null)).toBe("—");
    expect(sharePercent(3_621.31 / 10_658.98)).toBe("34.0%");
    expect(sharePercent(null)).toBe("—");
  });

  it("says how a total moved against the previous range", () => {
    expect(changeVsText(10_658.98, 6_254.65, 7)).toBe("+70% vs last week");
    expect(changeVsText(9_906.16, 8_770.23, 7)).toBe("+13% vs last week");
    expect(changeVsText(80, 100, 30)).toBe("−20% vs the previous 30 days");
    expect(changeVsText(100, 100.2, 1)).toBe("0% vs the day before");
    expect(changeVsText(5, 0, 7)).toBeNull();
  });

  it("shortens spans inside one month and keeps other years", () => {
    expect(shortSpan("2026-11-09", "2026-11-15")).toBe("Nov 9 – 15");
    expect(shortSpan("2026-11-30", "2026-12-06")).toBe("Nov 30 – Dec 6");
    expect(shortSpan("2026-10-26", "2026-11-01")).toBe("Oct 26 – Nov 1");
    expect(shortSpan("2026-11-08", "2026-11-08")).toBe("Nov 8");
    expect(shortSpan("2025-10-26", "2025-11-01", "2026")).toBe("Oct 26 – Nov 1, 2025");
    expect(shortSpan("2026-10-26", "2026-11-01", "2026")).toBe("Oct 26 – Nov 1");
  });

  it("formats checks: near 100% never rounds up, small shares keep a decimal", () => {
    expect(fixture.checks.map(checkValue)).toEqual(["99.1%", "5.3%", "33%", "26"]);
    expect(checkValue({ value: 0.99999, unit: "percent" })).toBe("99.9%");
    expect(checkValue({ value: 1, unit: "percent" })).toBe("100.0%");
    expect(checkValue({ value: null, unit: "percent" })).toBe("—");
    expect(checkChip("watch")).toEqual({ tone: "warn", label: "Watch" });
    expect(checkChip("off_track")).toEqual({ tone: "bad", label: "Off track" });
    expect(checkChip("on_track")).toEqual({ tone: "good", label: "On track" });
    expect(checkChip("something_new").tone).toBe("neutral");
  });
});

describe("tiles", () => {
  it("splits sent by share and earned by amount, as designed", () => {
    expect(splitShares(fixture.totals.sentSplit).map((p) => p.label)).toEqual([
      "Cashback 69%",
      "Referrals 27%",
      "Other 4%",
    ]);
    expect(splitAmounts(fixture.totals.earnedSplit).map((p) => p.label)).toEqual([
      "Cashback $5.4K",
      "Referrals $4.3K",
      "Other $0.2K",
    ]);
    expect(splitAmounts({ cashback: 400, referrals: 50, other: 12.4 }).map((p) => p.label)).toEqual([
      "Cashback $400",
      "Referrals $50",
      "Other $12",
    ]);
  });

  it("builds the captions from the data", () => {
    expect(plain(sentCaption(fixture))).toBe(
      "Left our wallets Oct 26 – Nov 1. About $1.2K of it was cashback due the week before, paid late.",
    );
    expect(plain(earnedCaption(fixture))).toBe(
      "Activity Oct 26 – Nov 1. Cashback pays Nov 9 – 15, referral rewards Nov 25 – Dec 1.",
    );
    expect(spendCaption(fixture)).toBe(
      "5.9% of $167.3K card spend went back to users as incentives. 13-week average: $14.95.",
    );
    // Date spans never split across lines.
    expect(earnedCaption(fixture)).toContain("Nov 25 – Dec 1");
  });

  it("drops the late-cashback sentence when nothing was late", () => {
    const data = clone();
    data.totals.lateCashbackInSentUsd = 0;
    expect(plain(sentCaption(data))).toBe("Left our wallets Oct 26 – Nov 1.");
    data.totals.lateCashbackInSentUsd = 433;
    data.range = { ...data.range, from: "2026-10-03", days: 30 };
    expect(plain(sentCaption(data))).toBe(
      "Left our wallets Oct 3 – Nov 1. About $433 of it was cashback due before Oct 3, paid late.",
    );
  });
});

describe("where it went", () => {
  const { rows, total } = programRows(fixture.programs);

  it("hides programs with nothing sent or earned and keeps the order", () => {
    expect(rows.map((r) => r.key)).toEqual([
      "cashback_3",
      "cashback_4",
      "cashback_5",
      "referrals",
      "subscription_perks",
      "yield_boost",
      "payout_corrections",
    ]);
  });

  it("shares each row of what was sent, adding to the total", () => {
    expect(rows.map((r) => sharePercent(r.share))).toEqual([
      "34.0%",
      "27.2%",
      "6.9%",
      "26.8%",
      "3.5%",
      "0.7%",
      "0.9%",
    ]);
    expect(rows.reduce((sum, r) => sum + (r.share ?? 0), 0)).toBeCloseTo(1, 10);
    expect(wholeUsd(total.sentUsd)).toBe("$10,659");
    expect(wholeUsd(total.earnedUsd)).toBe("$9,906");
    expect(total.sentUsd).toBeCloseTo(fixture.totals.sent.current, 2);
    expect(total.earnedUsd).toBeCloseTo(fixture.totals.earned.current, 2);
  });

  it("keeps a row that only earned, and colours rows by wallet", () => {
    const { rows: earnedOnly } = programRows([
      { key: "card_credit", label: "Card credit", status: "live", sentUsd: 0, earnedUsd: 5, payments: 0 },
      { key: "ai_cashback", label: "AI-agent cashback", status: "not_launched", sentUsd: null, earnedUsd: null, payments: null },
    ]);
    expect(earnedOnly.map((r) => [r.key, r.share])).toEqual([["card_credit", null]]);
    expect(rows.find((r) => r.key === "payout_corrections")?.kind).toBe("cashback");
    expect(rows.find((r) => r.key === "referrals")?.kind).toBe("referrals");
    expect(rows.find((r) => r.key === "yield_boost")?.kind).toBe("other");
  });
});

describe("weekly chart", () => {
  it("stacks payout corrections into cashback when sent", () => {
    const sent = weeklyBars(fixture.weekly, "sent");
    const oct26 = sent.find((b) => b.weekStart === "2026-10-26")!;
    expect(oct26.cashback).toBeCloseTo(7_257.17 + 91.12, 2);
    expect(oct26.total).toBe(10_658.98);
    // A negative correction lowers cashback but never below zero.
    expect(sent.find((b) => b.weekStart === "2026-08-31")!.cashback).toBeCloseTo(3_917.62 - 77.87, 2);
    const earned = weeklyBars(fixture.weekly, "earned");
    expect(earned.find((b) => b.weekStart === "2026-10-26")!.cashback).toBe(5_443.27);
  });

  it("labels every other week and the running one, on round ticks", () => {
    const bars = weeklyBars(fixture.weekly, "sent");
    expect(weeklyTicks(bars)).toEqual([
      "2026-08-03",
      "2026-08-17",
      "2026-08-31",
      "2026-09-14",
      "2026-09-28",
      "2026-10-12",
      "2026-10-26",
      "2026-11-02",
    ]);
    expect(axisTicks(10_658.98)).toEqual([0, 4_000, 8_000, 12_000]);
    expect(axisTicks(12_993.66)).toEqual([0, 5_000, 10_000, 15_000]);
  });

  it("describes the weeks and their totals", () => {
    expect(weeksDescription(fixture.weekly, "2026-11-08")).toBe("13 weeks + this week so far");
    expect(weeksDescription(fixture.weekly.slice(0, 13), "2026-11-08")).toBe("13 weeks");
    expect(weeklyTotalsText(fixture)).toBe("13 full weeks: $42.7K sent, $72.3K earned.");
    expect(payDelayText(fixture)).toBe(
      "Earned runs ahead because cashback pays 14 days and referral rewards 30 days after they're earned.",
    );
  });
});

describe("chart notes", () => {
  it("finds the referral pause between two paying weeks, not the weeks before the first payout", () => {
    expect(referralPauseNotes(fixture.weekly)).toEqual([
      {
        key: "referral-pause-2026-10-12",
        weekStart: "2026-10-12",
        text: "Referral payouts paused Oct 12 – 18",
      },
    ]);
  });

  it("spans a run of unpaid weeks and ignores a running week with none yet", () => {
    const weeks = [
      week("2026-09-07", 50),
      week("2026-09-14", 0),
      week("2026-09-21", 0),
      week("2026-09-28", 0),
      week("2026-10-05", 30),
      week("2026-10-12", 0, true),
    ];
    expect(referralPauseNotes(weeks)).toEqual([
      {
        key: "referral-pause-2026-09-14",
        weekStart: "2026-09-21",
        text: "Referral payouts paused Sep 14 – Oct 4",
      },
    ]);
    expect(referralPauseNotes([week("2026-09-07", 0), week("2026-09-14", 20)])).toEqual([]);
  });

  it("puts late cashback on the week the range starts, only when there is some", () => {
    expect(lateCashbackNote(fixture)).toEqual({
      key: "late-cashback",
      weekStart: "2026-10-26",
      text: "$1.2K of late cashback caught up",
    });
    const none = clone();
    none.totals.lateCashbackInSentUsd = 0;
    expect(lateCashbackNote(none)).toBeNull();
    const midWeek = clone();
    midWeek.range = { ...midWeek.range, from: "2026-10-29", to: "2026-11-04" };
    expect(lateCashbackNote(midWeek)?.weekStart).toBe("2026-10-26");
    const beforeChart = clone();
    beforeChart.range = { ...beforeChart.range, from: "2026-07-01" };
    expect(lateCashbackNote(beforeChart)).toBeNull();
  });

  it("shows both notes on Sent and none on Earned", () => {
    expect(weeklyNotes(fixture, "sent").map((n) => n.weekStart)).toEqual(["2026-10-12", "2026-10-26"]);
    expect(weeklyNotes(fixture, "earned")).toEqual([]);
  });
});

describe("coming due", () => {
  it("labels the buckets and adds their parts", () => {
    const bars = dueBars(fixture.comingDue.weeks);
    expect(bars.map((b) => b.label)).toEqual([
      "Nov 8",
      "Nov 9 – 15",
      "Nov 16 – 22",
      "Nov 23 – 29",
      "Nov 30 – Dec 6",
      "Dec 7 – 8",
    ]);
    expect(bars.map((b) => compactUsd(b.expected))).toEqual(["$433", "$7.7K", "$6.8K", "$1.4K", "$1.1K", "$265"]);
    expect(bars.reduce((sum, b) => sum + b.all, 0)).toBeCloseTo(fixture.comingDue.totalAll, 2);
    expect(bars.reduce((sum, b) => sum + b.expected, 0)).toBeCloseTo(fixture.comingDue.totalExpected, 2);
  });

  it("puts overdue referral rewards in the first bucket after today", () => {
    expect(plain(overdueNote(fixture))).toBe("Nov 9 – 15 includes $1,380 of referral rewards already overdue.");
    const none = clone();
    none.comingDue.overdueReferralsUsd = 0;
    expect(overdueNote(none)).toBeNull();
    expect(newCashbackNote(fixture)).toBe(
      "Only what's owed today. New purchases add about $5.5K of cashback a week.",
    );
  });
});
