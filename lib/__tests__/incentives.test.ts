import { describe, expect, it } from "vitest";
import fixtureJson from "@/lib/__tests__/fixtures/incentives-oct26-nov1.json";
import backendJson from "@/lib/__tests__/fixtures/incentives-backend-oct26-nov1.json";
import {
  axisTicks,
  centsUsd,
  changeVsText,
  checkChip,
  checkValue,
  correctionsKnown,
  dueBars,
  dueDefinition,
  dueExpectedTotal,
  dueHeadline,
  earnedCaption,
  isIncentivesResponse,
  lateCashbackNote,
  newCashbackNote,
  overdueNote,
  payDelayText,
  payDelays,
  programRows,
  referralPauseNotes,
  sentCaption,
  sentChangeText,
  sharePercent,
  shortSpan,
  spendCaption,
  splitAmounts,
  splitShares,
  unknownCorrectionsNote,
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
    expect(checkChip("not_available")).toEqual({ tone: "neutral", label: "Not available yet" });
    expect(checkChip("something_new")).toEqual({ tone: "neutral", label: "Not available yet" });
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
      "Left our wallets Oct 26 – Nov 1. About $1.2K of it was cashback due before Oct 26, paid late.",
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
    const bars = dueBars(fixture.comingDue);
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
    expect(bars.reduce((sum, b) => sum + (b.expected ?? 0), 0)).toBeCloseTo(fixture.comingDue.totalExpected, 2);
    expect(dueHeadline(fixture.comingDue)).toEqual({
      lead: "$17.7K",
      rest: " expected over the next 30 days, up to $32.3K if nothing is cancelled · by the week it pays out",
    });
    expect(dueDefinition(fixture.comingDue)).toBe(
      "Already owed, by the day it pays out, as of now. Expected = owed × the share actually paid in the last 4 weeks (cashback 94.7%, referral rewards 33.1%).",
    );
  });

  it("shows only what is owed when there were no payouts to measure a rate", () => {
    const data = clone();
    data.comingDue.rates = null;
    expect(isIncentivesResponse(data)).toBe(true);
    const bars = dueBars(data.comingDue);
    expect(bars.every((b) => b.cashbackExpected === null && b.referralsExpected === null && b.expected === null)).toBe(true);
    expect(bars.map((b) => compactUsd(b.all))).toEqual(["$457", "$13.0K", "$10.3K", "$4.3K", "$3.4K", "$800"]);
    expect(dueExpectedTotal(data.comingDue)).toBeNull();
    expect(dueHeadline(data.comingDue)).toEqual({
      lead: "$32.3K",
      rest: " owed over the next 30 days · by the week it pays out",
    });
    expect(dueDefinition(data.comingDue)).toBe(
      "Already owed, by the day it pays out, as of now. No payouts in the last 4 weeks to measure, so only what is owed is shown.",
    );
  });

  it("drops only the part without a rate", () => {
    const data = clone();
    data.comingDue.rates = { cashback: 0.947, referrals: null };
    expect(isIncentivesResponse(data)).toBe(true);
    const bars = dueBars(data.comingDue);
    // Nov 8 has only cashback, so its expected total is still known.
    expect(bars[0]).toMatchObject({ cashbackExpected: 432.51, referralsExpected: null, expected: 432.51 });
    expect(bars[1]).toMatchObject({ cashbackExpected: 5221.36, referralsExpected: null, expected: null, all: 12993.66 });
    expect(dueExpectedTotal(data.comingDue)).toBeNull();
    expect(dueHeadline(data.comingDue).lead).toBe("$32.3K");
    expect(dueDefinition(data.comingDue)).toBe(
      "Already owed, by the day it pays out, as of now. Expected = owed × the share actually paid in the last 4 weeks (cashback 94.7%). No referral reward payouts in the last 4 weeks to measure, so referral rewards show only what is owed.",
    );
    // Nothing owed in a part without a rate: the expected total still holds.
    data.comingDue.referralsAll = 0;
    expect(dueExpectedTotal(data.comingDue)).toBe(data.comingDue.totalExpected);
  });

  it("rejects a pay rate that is not a number or null", () => {
    const data = clone() as unknown as { comingDue: { rates: Record<string, unknown> } };
    data.comingDue.rates.cashback = "94.7%";
    expect(isIncentivesResponse(data)).toBe(false);
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

/**
 * The backend PR's real response for Oct 26 – Nov 1 ("Admin Overview:
 * Incentives tab endpoint + cashback paidAt"), so the portal is held to what
 * the endpoint actually sends, not only to the contract's example.
 */
describe("the backend's response", () => {
  const backend = backendJson as unknown as IncentivesResponse;
  const copy = (): IncentivesResponse => structuredClone(backend);

  it("passes the response check", () => {
    expect(isIncentivesResponse(backendJson)).toBe(true);
  });

  it("reads as the tiles should", () => {
    expect(wholeUsd(backend.totals.sent.current)).toBe("$10,659");
    expect(wholeUsd(backend.totals.earned.current)).toBe("$9,906");
    expect(changeVsText(backend.totals.sent.current, backend.totals.sent.previous, 7)).toBe("+71% vs last week");
    expect(centsUsd(backend.totals.cardSpendPerIncentiveDollar.current)).toBe("$16.89");
    // $1,376.41 of late cashback rounds to $1.4K.
    expect(plain(sentCaption(backend))).toBe(
      "Left our wallets Oct 26 – Nov 1. About $1.4K of it was cashback due before Oct 26, paid late.",
    );
    expect(lateCashbackNote(backend)?.text).toBe("$1.4K of late cashback caught up");
    expect(plain(earnedCaption(backend))).toBe(
      "Activity Oct 26 – Nov 1. Cashback pays Nov 9 – 15, referral rewards Nov 25 – Dec 1.",
    );
  });

  it("fills the table, chart and checks", () => {
    const { rows, total } = programRows(backend.programs);
    expect(rows.map((r) => r.key)).not.toContain("cashback_other");
    expect(rows.map((r) => sharePercent(r.share))).toEqual(["34.0%", "27.2%", "6.9%", "26.8%", "3.5%", "0.7%", "0.9%"]);
    expect(total.sentUsd).toBeCloseTo(backend.totals.sent.current, 2);
    expect(weeksDescription(backend.weekly, "2026-11-08")).toBe("13 weeks");
    expect(referralPauseNotes(backend.weekly).map((n) => n.text)).toEqual(["Referral payouts paused Oct 12 – 18"]);
    expect(backend.checks.map(checkValue)).toEqual(["99.1%", "5.0%", "33%", "26"]);
    expect(dueHeadline(backend.comingDue).lead).toBe("$17.7K");
  });

  it("before the on-chain check has data: a grey chip, and no corrections row", () => {
    const data = copy();
    const onchain = data.checks.find((c) => c.key === "onchain_match")!;
    onchain.value = null;
    onchain.status = "not_available";
    // The backend sends no corrections until the check can measure them.
    data.programs.find((p) => p.key === "payout_corrections")!.sentUsd = 0;
    expect(isIncentivesResponse(data)).toBe(true);
    expect(checkValue(onchain)).toBe("—");
    expect(checkChip(onchain.status)).toEqual({ tone: "neutral", label: "Not available yet" });
    const { rows } = programRows(data.programs);
    expect(rows.map((r) => r.key)).not.toContain("payout_corrections");
    expect(rows.reduce((sum, r) => sum + (r.share ?? 0), 0)).toBeCloseTo(1, 10);
  });

  it("takes null rates, nulls per dollar and a running last week", () => {
    const data = copy();
    data.comingDue.rates = null;
    data.totals.cardSpendPerIncentiveDollar = { current: null, previous: null, average13Weeks: null };
    data.totals.earnedShareOfCardSpend = null;
    data.weekly[data.weekly.length - 1].partial = true;
    expect(isIncentivesResponse(data)).toBe(true);
    expect(dueHeadline(data.comingDue)).toEqual({
      lead: "$32.1K",
      rest: " owed over the next 30 days · by the week it pays out",
    });
  });
});

describe("payout corrections before the on-chain check has run", () => {
  it("reads missing flags as known", () => {
    expect(correctionsKnown(fixture)).toEqual({ current: true, previous: true });
    expect(sentChangeText(fixture)).toBe("+70% vs last week");
    expect(unknownCorrectionsNote(fixture.weekly, "sent")).toBeNull();
  });

  it("accepts the flags as booleans and rejects anything else", () => {
    const data = clone();
    data.totals.correctionsKnown = { current: false, previous: true };
    data.weekly[12].correctionsKnown = false;
    expect(isIncentivesResponse(data)).toBe(true);
    const badWeek = clone() as unknown as { weekly: Array<Record<string, unknown>> };
    badWeek.weekly[0].correctionsKnown = "no";
    expect(isIncentivesResponse(badWeek)).toBe(false);
    const badTotals = clone() as unknown as { totals: Record<string, unknown> };
    badTotals.totals.correctionsKnown = { current: 0, previous: true };
    expect(isIncentivesResponse(badTotals)).toBe(false);
    badTotals.totals.correctionsKnown = true;
    expect(isIncentivesResponse(badTotals)).toBe(false);
  });

  it("says Sent excludes them and shows the corrections row as unknown", () => {
    const data = clone();
    data.totals.correctionsKnown = { current: false, previous: true };
    data.programs.find((p) => p.key === "payout_corrections")!.sentUsd = 0;
    expect(plain(sentCaption(data))).toBe(
      "Left our wallets Oct 26 – Nov 1. About $1.2K of it was cashback due before Oct 26, paid late. Excludes payout corrections (on-chain check not run for these days).",
    );
    const { rows, total } = programRows(data.programs, { correctionsKnown: correctionsKnown(data).current });
    const corrections = rows.find((r) => r.key === "payout_corrections");
    expect(corrections).toMatchObject({ sentUsd: null, share: null, earnedUsd: null });
    expect(sharePercent(corrections!.share)).toBe("—");
    // The other rows still add to 100% of what is known.
    expect(rows.reduce((sum, r) => sum + (r.share ?? 0), 0)).toBeCloseTo(1, 10);
    expect(total.sentUsd).toBeCloseTo(10_658.98 - 91.12, 2);
    // Once known, a $0 correction is hidden like any other empty row.
    expect(programRows(data.programs).rows.map((r) => r.key)).not.toContain("payout_corrections");
  });

  it("drops Sent's change chip when the two ranges are not counted alike", () => {
    const data = clone();
    data.totals.correctionsKnown = { current: true, previous: false };
    expect(sentChangeText(data)).toBeNull();
    data.totals.correctionsKnown = { current: false, previous: true };
    expect(sentChangeText(data)).toBeNull();
    data.totals.correctionsKnown = {};
    expect(sentChangeText(data)).toBe("+70% vs last week");
  });

  it("adds one footnote under the Sent chart when any week is not known", () => {
    const data = clone();
    data.weekly[11].correctionsKnown = false;
    data.weekly[12].correctionsKnown = false;
    expect(unknownCorrectionsNote(data.weekly, "sent")).toBe("Payout corrections aren't known for some weeks yet.");
    expect(unknownCorrectionsNote(data.weekly, "earned")).toBeNull();
    data.weekly.forEach((w) => (w.correctionsKnown = true));
    expect(unknownCorrectionsNote(data.weekly, "sent")).toBeNull();
  });
});

describe("pay delays", () => {
  it("come from earnedPaysOn, not fixed numbers", () => {
    expect(payDelays(fixture)).toEqual({ cashbackDays: 14, referralDays: 30 });
    const data = clone();
    data.totals.earnedPaysOn = {
      cashback: { from: "2026-11-16", to: "2026-11-22" },
      referrals: { from: "2026-12-10", to: "2026-12-16" },
    };
    expect(payDelays(data)).toEqual({ cashbackDays: 21, referralDays: 45 });
    expect(payDelayText(data)).toBe(
      "Earned runs ahead because cashback pays 21 days and referral rewards 45 days after they're earned.",
    );
  });
});
