import { compactUsd, formatCount } from "@/lib/overview-format";
import { addDays, dayLabel, rangeDays } from "@/lib/overview-range";
import type {
  IncentivesCheck,
  IncentivesDueWeek,
  IncentivesProgram,
  IncentivesResponse,
  IncentivesSplit,
  IncentivesWeek,
} from "@/types/overview";

/**
 * The Incentives tab's derived numbers, labels and chart notes, kept free of
 * React so the rules are tested once.
 */

// ---------------------------------------------------------------------------
// Response check
// ---------------------------------------------------------------------------

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isNumberOrNull = (value: unknown): boolean => value === null || isNumber(value);
const isString = (value: unknown): value is string => typeof value === "string";
const hasNumbers = (value: unknown, keys: string[]): boolean =>
  isObject(value) && keys.every((key) => isNumber(value[key]));
const hasStrings = (value: unknown, keys: string[]): boolean =>
  isObject(value) && keys.every((key) => isString(value[key]));
const isListOf = (value: unknown, check: (item: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(check);

const SPLIT_KEYS = ["cashback", "referrals", "other"];
const COMPARED_KEYS = ["current", "previous"];

/** Whether a payload has everything the tab reads, checked at runtime. */
export function isIncentivesResponse(value: unknown): value is IncentivesResponse {
  if (!isObject(value) || !isString(value.generatedAt)) return false;
  const totals = value.totals;
  const perDollar = isObject(totals) ? totals.cardSpendPerIncentiveDollar : null;
  const paysOn = isObject(totals) ? totals.earnedPaysOn : null;
  const due = value.comingDue;
  return (
    hasStrings(value.range, ["from", "to", "previousFrom", "previousTo"]) &&
    hasNumbers(value.range, ["days"]) &&
    hasNumbers(value.definition, ["version"]) &&
    hasStrings(value.definition, ["timezone", "weekStartsOn"]) &&
    isObject(totals) &&
    hasNumbers(totals.sent, COMPARED_KEYS) &&
    hasNumbers(totals.sentSplit, SPLIT_KEYS) &&
    isNumber(totals.lateCashbackInSentUsd) &&
    hasNumbers(totals.earned, COMPARED_KEYS) &&
    hasNumbers(totals.earnedSplit, SPLIT_KEYS) &&
    isObject(paysOn) &&
    hasStrings(paysOn.cashback, ["from", "to"]) &&
    hasStrings(paysOn.referrals, ["from", "to"]) &&
    hasNumbers(totals.cardSpend, COMPARED_KEYS) &&
    isObject(perDollar) &&
    isNumberOrNull(perDollar.current) &&
    isNumberOrNull(perDollar.previous) &&
    isNumberOrNull(perDollar.average13Weeks) &&
    isNumberOrNull(totals.earnedShareOfCardSpend) &&
    isListOf(
      value.programs,
      (p) =>
        hasStrings(p, ["key", "label", "status"]) &&
        isObject(p) &&
        isNumberOrNull(p.sentUsd) &&
        isNumberOrNull(p.earnedUsd) &&
        isNumberOrNull(p.payments),
    ) &&
    isListOf(
      value.weekly,
      (w) =>
        hasStrings(w, ["weekStart", "weekEnd"]) &&
        isObject(w) &&
        typeof w.partial === "boolean" &&
        hasNumbers(w.sent, ["cashback", "referrals", "perks", "yieldBoost", "corrections", "total"]) &&
        hasNumbers(w.earned, ["cashback", "referrals", "perks", "yieldBoost", "total"]) &&
        isNumber(w.cardSpend),
    ) &&
    hasNumbers(value.weeklyTotals13, ["sent", "earned"]) &&
    isObject(due) &&
    isString(due.asOf) &&
    hasNumbers(due.rates, ["cashback", "referrals"]) &&
    hasNumbers(due, [
      "totalAll",
      "totalExpected",
      "cashbackAll",
      "referralsAll",
      "overdueReferralsUsd",
      "newCashbackPerWeekUsd",
    ]) &&
    isListOf(
      due.weeks,
      (w) =>
        hasStrings(w, ["from", "to"]) &&
        hasNumbers(w, ["cashbackAll", "cashbackExpected", "referralsAll", "referralsExpected"]),
    ) &&
    isListOf(
      value.checks,
      (c) => hasStrings(c, ["key", "label", "unit", "status", "detail"]) && isObject(c) && isNumberOrNull(c.value),
    ) &&
    isListOf(value.notIncluded, (n) => hasStrings(n, ["key", "label", "size", "why"]))
  );
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const MINUS = "−";
const NBSP = " ";

/** `$10,659`: whole dollars, for the big numbers and the table. */
export function wholeUsd(value: number | null | undefined): string {
  const v = Number.isFinite(value) ? (value as number) : 0;
  const rounded = Math.round(Math.abs(v));
  return `${v < 0 && rounded > 0 ? MINUS : ""}$${count.format(rounded)}`;
}

/** `$16.89`: card spend per incentive dollar; a dash when there is none. */
export function centsUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

/** `34.0%` from a 0–1 share; a dash when there is nothing to divide. */
export function sharePercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** Keep a label on one line: `Oct 26 – Nov 1` never splits across lines. */
export function keepTogether(text: string): string {
  return text.replace(/ /g, NBSP);
}

/**
 * `Nov 9 – 15`, `Nov 30 – Dec 6`, `Nov 8` for one day. With `currentYear`, a
 * span in another year carries it once at the end: `Oct 26 – Nov 1, 2025`.
 */
export function shortSpan(from: string, to: string, currentYear?: string): string {
  const year = to.slice(0, 4);
  const suffix = currentYear && (year !== currentYear || from.slice(0, 4) !== year) ? `, ${year}` : "";
  if (from === to) return `${dayLabel(from)}${suffix}`;
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const end = sameMonth ? String(Number(to.slice(8, 10))) : dayLabel(to);
  return `${dayLabel(from)} – ${end}${suffix}`;
}

/** What the previous range of the same length is called in a chip. */
export function previousRangeLabel(days: number): string {
  if (days === 1) return "the day before";
  if (days === 7) return "last week";
  return `the previous ${days} days`;
}

/** `+70% vs last week`, or null when the previous range had nothing. */
export function changeVsText(current: number, previous: number, days: number): string | null {
  if (!Number.isFinite(previous) || previous === 0 || !Number.isFinite(current)) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? "+" : pct < 0 ? MINUS : "";
  return `${sign}${Math.abs(pct)}% vs ${previousRangeLabel(days)}`;
}

/**
 * A check's value. Percent: near 100% it is cut to one decimal so a 99.95%
 * match never reads as 100.0%; under 10% one decimal; whole percent between.
 */
export function checkValue(check: Pick<IncentivesCheck, "value" | "unit">): string {
  const { value, unit } = check;
  if (value === null || !Number.isFinite(value)) return "—";
  if (unit !== "percent") return formatCount(value);
  const pct = value * 100;
  if (value >= 0.9) return `${(Math.floor(pct * 10 + 1e-9) / 10).toFixed(1)}%`;
  if (value < 0.1) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

export type CheckTone = "good" | "warn" | "bad" | "neutral";

/** The chip a check status gets; an unknown status reads as no data. */
export function checkChip(status: string): { tone: CheckTone; label: string } {
  switch (status) {
    case "on_track":
      return { tone: "good", label: "On track" };
    case "watch":
      return { tone: "warn", label: "Watch" };
    case "off_track":
      return { tone: "bad", label: "Off track" };
    default:
      return { tone: "neutral", label: "No data yet" };
  }
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

export type IncentiveKind = "cashback" | "referrals" | "other";

/** `Cashback 69%`, `Referrals 27%`, `Other 4%`: each part's share of the whole. */
export function splitShares(split: IncentivesSplit): Array<{ kind: IncentiveKind; label: string; value: number }> {
  const total = split.cashback + split.referrals + split.other;
  const pct = (v: number) => (total > 0 ? `${Math.round((v / total) * 100)}%` : "0%");
  return [
    { kind: "cashback", label: `Cashback ${pct(split.cashback)}`, value: split.cashback },
    { kind: "referrals", label: `Referrals ${pct(split.referrals)}`, value: split.referrals },
    { kind: "other", label: `Other ${pct(split.other)}`, value: split.other },
  ];
}

/**
 * `Cashback $5.4K`, `Referrals $4.3K`, `Other $0.2K`: one unit for all three,
 * thousands as soon as any part reaches $1,000.
 */
export function splitAmounts(split: IncentivesSplit): Array<{ kind: IncentiveKind; label: string; value: number }> {
  const inK = Math.max(split.cashback, split.referrals, split.other) >= 1_000;
  const money = (v: number) => (inK ? `$${(v / 1_000).toFixed(1)}K` : wholeUsd(v));
  return [
    { kind: "cashback", label: `Cashback ${money(split.cashback)}`, value: split.cashback },
    { kind: "referrals", label: `Referrals ${money(split.referrals)}`, value: split.referrals },
    { kind: "other", label: `Other ${money(split.other)}`, value: split.other },
  ];
}

const yearOf = (data: IncentivesResponse) => (data.range.today ?? data.generatedAt).slice(0, 4);

/** "Left our wallets Oct 26 – Nov 1. About $1.2K of it was cashback due the week before, paid late." */
export function sentCaption(data: IncentivesResponse): string {
  const { range, totals } = data;
  const span = keepTogether(shortSpan(range.from, range.to, yearOf(data)));
  const late = totals.lateCashbackInSentUsd;
  if (!(late >= 0.5)) return `Left our wallets ${span}.`;
  const before = range.days === 7 ? "the week before" : keepTogether(`before ${dayLabel(range.from)}`);
  return `Left our wallets ${span}. About ${compactUsd(late)} of it was cashback due ${before}, paid late.`;
}

/** "Activity Oct 26 – Nov 1. Cashback pays Nov 9 – 15, referral rewards Nov 25 – Dec 1." */
export function earnedCaption(data: IncentivesResponse): string {
  const { range, totals } = data;
  const year = yearOf(data);
  const span = (s: { from: string; to: string }) => keepTogether(shortSpan(s.from, s.to, year));
  return `Activity ${span(range)}. Cashback pays ${span(totals.earnedPaysOn.cashback)}, referral rewards ${span(
    totals.earnedPaysOn.referrals,
  )}.`;
}

/** "5.9% of $167.3K card spend went back to users as incentives. 13-week average: $14.95." */
export function spendCaption(data: IncentivesResponse): string {
  const { totals } = data;
  const share = totals.earnedShareOfCardSpend;
  const head =
    share === null
      ? `No card spend in the range.`
      : totals.earned.current > 0
        ? `${sharePercent(share)} of ${compactUsd(totals.cardSpend.current)} card spend went back to users as incentives.`
        : `Nothing earned on ${compactUsd(totals.cardSpend.current)} of card spend.`;
  const average = totals.cardSpendPerIncentiveDollar.average13Weeks;
  return average === null ? head : `${head} 13-week average: ${centsUsd(average)}.`;
}

// ---------------------------------------------------------------------------
// Where it went
// ---------------------------------------------------------------------------

export interface ProgramRow {
  key: string;
  label: string;
  kind: IncentiveKind;
  sentUsd: number;
  earnedUsd: number | null;
  payments: number | null;
  /** Share of the table's sent total, 0–1; null when nothing was sent. */
  share: number | null;
}

/** Cashback rows and payout corrections are cashback-wallet money; referrals are their own. */
export function programKind(key: string): IncentiveKind {
  if (key.startsWith("cashback") || key === "payout_corrections") return "cashback";
  if (key.startsWith("referral")) return "referrals";
  return "other";
}

/**
 * The table's rows in the order they came, without those that neither sent
 * nor earned anything in the range, each with its share of what was sent.
 */
export function programRows(programs: IncentivesProgram[]): {
  rows: ProgramRow[];
  total: { sentUsd: number; earnedUsd: number };
} {
  const shown = programs.filter((p) => (p.sentUsd ?? 0) !== 0 || (p.earnedUsd ?? 0) !== 0);
  const sentTotal = shown.reduce((sum, p) => sum + (p.sentUsd ?? 0), 0);
  const earnedTotal = shown.reduce((sum, p) => sum + (p.earnedUsd ?? 0), 0);
  return {
    rows: shown.map((p) => ({
      key: p.key,
      label: p.label,
      kind: programKind(p.key),
      sentUsd: p.sentUsd ?? 0,
      earnedUsd: p.earnedUsd,
      payments: p.payments,
      share: sentTotal > 0 ? (p.sentUsd ?? 0) / sentTotal : null,
    })),
    total: { sentUsd: sentTotal, earnedUsd: earnedTotal },
  };
}

// ---------------------------------------------------------------------------
// Weekly chart
// ---------------------------------------------------------------------------

export type WeeklyMode = "sent" | "earned";

export interface WeeklyBar {
  weekStart: string;
  weekEnd: string;
  partial: boolean;
  cashback: number;
  referrals: number;
  perks: number;
  yieldBoost: number;
  total: number;
}

/**
 * One stacked bar per week. Sent counts payout corrections with cashback:
 * both left the cashback wallet.
 */
export function weeklyBars(weekly: IncentivesWeek[], mode: WeeklyMode): WeeklyBar[] {
  return weekly.map((week) => {
    const part = mode === "sent" ? week.sent : week.earned;
    const corrections = mode === "sent" ? week.sent.corrections : 0;
    return {
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      partial: week.partial,
      cashback: Math.max(part.cashback + corrections, 0),
      referrals: Math.max(part.referrals, 0),
      perks: Math.max(part.perks, 0),
      yieldBoost: Math.max(part.yieldBoost, 0),
      total: part.total,
    };
  });
}

/** The next step at or above `value`: 1, 2, 2.5, 4 or 5 × a power of ten. */
function niceStep(value: number): number {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 4, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}

/** Ticks from zero in three round steps that clear the tallest bar. */
export function axisTicks(max: number, steps = 3): number[] {
  const step = niceStep(max / steps);
  return Array.from({ length: steps + 1 }, (_, i) => i * step);
}

/** The x labels: every other week from the first, and always the last bar. */
export function weeklyTicks(bars: Array<{ weekStart: string }>): string[] {
  return bars
    .filter((_, i) => i % 2 === 0 || i === bars.length - 1)
    .map((b) => b.weekStart);
}

export interface ChartNote {
  key: string;
  /** The week the note's leader points at. */
  weekStart: string;
  text: string;
}

/** The week ends on its Sunday, whatever a partial week's `weekEnd` says. */
const sundayOf = (week: Pick<IncentivesWeek, "weekStart">) => addDays(week.weekStart, 6);

/**
 * "Referral payouts paused Oct 12 – 18": a run of weeks with no referral
 * payouts between two weeks that had some. Weeks before the first payout are
 * not a pause, and neither is a running week with none yet.
 */
export function referralPauseNotes(weekly: IncentivesWeek[]): ChartNote[] {
  const notes: ChartNote[] = [];
  const paid = weekly.map((w) => w.sent.referrals > 0);
  let i = 0;
  while (i < weekly.length) {
    if (paid[i]) {
      i += 1;
      continue;
    }
    let end = i;
    while (end + 1 < weekly.length && !paid[end + 1]) end += 1;
    const before = i > 0 && paid[i - 1];
    const after = end + 1 < weekly.length && paid[end + 1];
    if (before && after) {
      // The leader points at the middle week of the run.
      const middle = weekly[Math.floor((i + end) / 2)];
      notes.push({
        key: `referral-pause-${weekly[i].weekStart}`,
        weekStart: middle.weekStart,
        text: `Referral payouts paused ${shortSpan(weekly[i].weekStart, sundayOf(weekly[end]))}`,
      });
    }
    i = end + 1;
  }
  return notes;
}

/**
 * "$1.2K of late cashback caught up": cashback sent in the range that was
 * due before it, on the chart's week where the range starts. None when the
 * range starts before the chart's first week.
 */
export function lateCashbackNote(data: IncentivesResponse): ChartNote | null {
  const late = data.totals.lateCashbackInSentUsd;
  if (!(late >= 0.5)) return null;
  const week = data.weekly.find((w) => w.weekStart <= data.range.from && data.range.from <= sundayOf(w));
  if (!week) return null;
  return {
    key: "late-cashback",
    weekStart: week.weekStart,
    text: `${compactUsd(late)} of late cashback caught up`,
  };
}

/** The notes the weekly chart carries: both are about payouts, so only on Sent. */
export function weeklyNotes(data: IncentivesResponse, mode: WeeklyMode): ChartNote[] {
  if (mode !== "sent") return [];
  const late = lateCashbackNote(data);
  return [...referralPauseNotes(data.weekly), ...(late ? [late] : [])];
}

/** "13 weeks + this week so far", or the running week's days when it is not this one. */
export function weeksDescription(weekly: IncentivesWeek[], today: string): string {
  const full = weekly.filter((w) => !w.partial).length;
  const partial = weekly.find((w) => w.partial);
  const head = `${full} week${full === 1 ? "" : "s"}`;
  if (!partial) return head;
  const isThisWeek = partial.weekStart <= today && today <= sundayOf(partial);
  return isThisWeek
    ? `${head} + this week so far`
    : `${head} + ${shortSpan(partial.weekStart, partial.weekEnd)} so far`;
}

/** "13 full weeks: $42.7K sent, $72.3K earned." */
export function weeklyTotalsText(data: IncentivesResponse): string {
  const full = data.weekly.filter((w) => !w.partial).length;
  return `${full} full week${full === 1 ? "" : "s"}: ${compactUsd(data.weeklyTotals13.sent)} sent, ${compactUsd(
    data.weeklyTotals13.earned,
  )} earned.`;
}

/** "Earned runs ahead because cashback pays 14 days and referral rewards 30 days after they're earned." */
export function payDelayText(data: IncentivesResponse): string {
  const { range, totals, weeklyTotals13 } = data;
  const cashbackDays = rangeDays(range.from, totals.earnedPaysOn.cashback.from) - 1;
  const referralDays = rangeDays(range.from, totals.earnedPaysOn.referrals.from) - 1;
  const lead =
    weeklyTotals13.earned > weeklyTotals13.sent
      ? "Earned runs ahead"
      : "Sent and earned differ";
  return `${lead} because cashback pays ${cashbackDays} days and referral rewards ${referralDays} days after they're earned.`;
}

// ---------------------------------------------------------------------------
// Coming due
// ---------------------------------------------------------------------------

export interface DueBar extends IncentivesDueWeek {
  label: string;
  expected: number;
  all: number;
}

export function dueBars(weeks: IncentivesDueWeek[]): DueBar[] {
  return weeks.map((week) => ({
    ...week,
    label: shortSpan(week.from, week.to),
    expected: week.cashbackExpected + week.referralsExpected,
    all: week.cashbackAll + week.referralsAll,
  }));
}

/**
 * "Nov 9 – 15 includes $1,380 of referral rewards already overdue." Overdue
 * rewards are put in the first bucket after today's.
 */
export function overdueNote(data: IncentivesResponse): string | null {
  const { comingDue } = data;
  const overdue = comingDue.overdueReferralsUsd;
  if (!(overdue >= 0.5) || comingDue.weeks.length === 0) return null;
  const today = comingDue.asOf.slice(0, 10);
  const bucket = comingDue.weeks.find((w) => w.from > today) ?? comingDue.weeks[0];
  return `${keepTogether(shortSpan(bucket.from, bucket.to))} includes ${wholeUsd(overdue)} of referral rewards already overdue.`;
}

/** "Only what's owed today. New purchases add about $5.5K of cashback a week." */
export function newCashbackNote(data: IncentivesResponse): string {
  const perWeek = data.comingDue.newCashbackPerWeekUsd;
  return perWeek > 0
    ? `Only what's owed today. New purchases add about ${compactUsd(perWeek)} of cashback a week.`
    : "Only what's owed today.";
}
