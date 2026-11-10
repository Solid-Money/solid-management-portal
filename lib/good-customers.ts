import { dayLabel } from "@/lib/overview-range";
import type {
  GoodCustomersCohort,
  GoodCustomersResponse,
  GoodCustomersTiers,
} from "@/types/overview";

/**
 * The Good customers tab's derived numbers and guardrails, kept free of React
 * so the limits are tested once.
 */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const hasNumbers = (value: unknown, keys: string[]): boolean =>
  isObject(value) && keys.every((key) => isNumber(value[key]));

/** Whether a payload has everything the tab reads, checked at runtime. */
export function isGoodCustomersResponse(value: unknown): value is GoodCustomersResponse {
  if (!isObject(value) || typeof value.asOf !== "string") return false;
  const ladder = value.ladder;
  return (
    hasNumbers(value.definition, [
      "version",
      "windowDays",
      "minSpendDays",
      "minSpendUsd",
      "highValueSpendUsd",
      "highValueMoneyInUsd",
    ]) &&
    hasNumbers(ladder, [
      "cardholders",
      "realCustomers",
      "activeSpenders",
      "qualified",
      "highValue",
      "neverFundedOrSpent",
    ]) &&
    isObject(ladder) &&
    (ladder.neverFundedTopCountry === null ||
      (isObject(ladder.neverFundedTopCountry) &&
        typeof ladder.neverFundedTopCountry.country === "string" &&
        isNumber(ladder.neverFundedTopCountry.count))) &&
    hasNumbers(value.spend, ["allUsd", "qualifiedUsd"]) &&
    Array.isArray(value.weekly) &&
    value.weekly.every(
      (week) =>
        isObject(week) &&
        typeof week.date === "string" &&
        hasNumbers(week, ["activeSpenders", "qualified"]),
    ) &&
    (value.retention === null ||
      (isObject(value.retention) &&
        typeof value.retention.asOf === "string" &&
        hasNumbers(value.retention.qualified, ["people", "spentAgain"]) &&
        hasNumbers(value.retention.otherSpenders, ["people", "spentAgain"]))) &&
    hasNumbers(value.economics, [
      "days",
      "cashbackUsd",
      "feesUsd",
      "primeUsd",
      "coveringOwnCashback",
    ]) &&
    hasNumbers(value.allCustomers90, ["cashbackUsd", "primeUsd"]) &&
    (value.referralBar === null || hasNumbers(value.referralBar, ["spendUsd", "bunched"])) &&
    Array.isArray(value.cohorts) &&
    value.cohorts.every(
      (cohort) =>
        isObject(cohort) &&
        typeof cohort.month === "string" &&
        typeof cohort.complete === "boolean" &&
        hasNumbers(cohort, ["cardholders", "realCustomers", "firstPurchase", "qualified"]),
    ) &&
    (value.feeRevenueUsd90 === null || isNumber(value.feeRevenueUsd90))
  );
}

const ROUTE_KEYS = ["paid", "lock", "trial", "legacy"];

/**
 * The Tiers section's block, when it has everything the section reads. Checked
 * apart from the rest, so a backend without it (or a bad one) costs the
 * section only, never the tab.
 */
export function tiersOf(data: GoodCustomersResponse): GoodCustomersTiers | null {
  const t: unknown = data.tiers;
  if (!isObject(t)) return null;
  const members = t.members;
  const trials = t.trials;
  const legacy = t.legacy;
  const ok =
    (t.source === "snapshot" || t.source === "records") &&
    hasNumbers(members, ["prime", "ultra", "withCard"]) &&
    isObject(members) &&
    hasNumbers(members.byRoute, ROUTE_KEYS) &&
    hasNumbers(t.bought, ["total", "paid", "lockPrime", "lockUltra", "lastWeek", "primeAnnualUsd"]) &&
    Array.isArray(t.table) &&
    t.table.length === 3 &&
    t.table.every(
      (row) =>
        isObject(row) &&
        typeof row.tier === "string" &&
        hasNumbers(row, ["cardholders", "spenders", "qualified", "spendUsd"]) &&
        hasNumbers(row.byRoute, ROUTE_KEYS),
    ) &&
    Array.isArray(t.routes) &&
    t.routes.every(
      (row) =>
        isObject(row) &&
        typeof row.route === "string" &&
        hasNumbers(row, ["cardholders", "spenders", "qualified", "spendUsd"]),
    ) &&
    Array.isArray(t.weeklyBuyers) &&
    t.weeklyBuyers.every(
      (week) => isObject(week) && typeof week.date === "string" && hasNumbers(week, ["paid", "lock"]),
    ) &&
    hasNumbers(trials, ["gifted", "accepted", "onTrial", "ended", "endedThenBought"]) &&
    isObject(trials) &&
    (trials.since === null || typeof trials.since === "string") &&
    hasNumbers(legacy, ["members", "spenders", "spendUsd"]) &&
    isObject(legacy) &&
    (legacy.endsOn === null || typeof legacy.endsOn === "string");
  return ok ? (t as unknown as GoodCustomersTiers) : null;
}

/** Spend per spender for a row, or null with no spenders. */
export function perSpender(row: { spendUsd: number; spenders: number }): number | null {
  return row.spenders > 0 ? row.spendUsd / row.spenders : null;
}

/** Members (Ultra and Prime cardholders) taken together. */
export function memberTotals(tiers: GoodCustomersTiers) {
  const members = tiers.table.filter((row) => row.tier !== "core");
  return {
    cardholders: members.reduce((sum, r) => sum + r.cardholders, 0),
    spenders: members.reduce((sum, r) => sum + r.spenders, 0),
    qualified: members.reduce((sum, r) => sum + r.qualified, 0),
    spendUsd: members.reduce((sum, r) => sum + r.spendUsd, 0),
  };
}

/** People who bought a tier (paid or locked FUSE), taken together. */
export function buyerTotals(tiers: GoodCustomersTiers) {
  const rows = tiers.routes.filter((row) => row.route === "paid" || row.route === "lock");
  return {
    cardholders: rows.reduce((sum, r) => sum + r.cardholders, 0),
    spenders: rows.reduce((sum, r) => sum + r.spenders, 0),
    qualified: rows.reduce((sum, r) => sum + r.qualified, 0),
    spendUsd: rows.reduce((sum, r) => sum + r.spendUsd, 0),
  };
}

/** Tier purchases in the last `weeks` weeks and the same number of weeks before. */
export function buyersTrend(tiers: GoodCustomersTiers, weeks = 4) {
  const total = (w: { paid: number; lock: number }) => w.paid + w.lock;
  const list = tiers.weeklyBuyers;
  const recent = list.slice(-weeks).reduce((sum, w) => sum + total(w), 0);
  const before = list.slice(-2 * weeks, -weeks).reduce((sum, w) => sum + total(w), 0);
  return { recent, before, weeks };
}

/** The weekly buyers chart from the first week anyone bought (all 13 if nobody has). */
export function buyersBars(tiers: GoodCustomersTiers) {
  const first = tiers.weeklyBuyers.findIndex((w) => w.paid + w.lock > 0);
  return tiers.weeklyBuyers.slice(first < 0 ? 0 : first).map((w) => ({
    ...w,
    total: w.paid + w.lock,
  }));
}

/** `part / whole`, or null when there is nothing to divide by. */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/** Fees and Prime minus cashback, per qualified customer, over the economics window. */
export function netPerQualified(data: GoodCustomersResponse): number | null {
  const { economics, ladder } = data;
  if (ladder.qualified === 0) return null;
  return (economics.feesUsd + economics.primeUsd - economics.cashbackUsd) / ladder.qualified;
}

/** Qualified people's cashback over what they paid in fees and Prime. */
export function qualifiedCashbackMultiple(data: GoodCustomersResponse): number | null {
  const paid = data.economics.feesUsd + data.economics.primeUsd;
  return paid > 0 ? data.economics.cashbackUsd / paid : null;
}

/** Everyone's cashback over tracked revenue (fees + Prime), 90 days. */
export function cashbackToRevenue(data: GoodCustomersResponse): number | null {
  if (data.feeRevenueUsd90 === null) return null;
  const revenue = data.feeRevenueUsd90 + data.allCustomers90.primeUsd;
  return revenue > 0 ? data.allCustomers90.cashbackUsd / revenue : null;
}

export type GuardrailStatus = "off" | "watch" | "ok" | "unknown";

export interface Guardrail {
  key: string;
  title: string;
  detail: string;
  value: string;
  status: GuardrailStatus;
}

/**
 * First limits, to be agreed with the team: past one, a guardrail is off
 * track (cost) or worth watching (quality of the base).
 */
export const GUARDRAIL_LIMITS = {
  /** Cashback above tracked revenue is a loss before any other cost. */
  cashbackToRevenue: 1,
  /** Fewer than half the qualified paying for their own cashback. */
  coveringShare: 0.5,
  /** A quarter of cardholders who never funded or spent. */
  neverFundedShare: 0.25,
  /** One spender in twenty sitting just above the referral bar. */
  referralBunchedShare: 0.05,
  /** Fewer than one in ten ended free trials turning into a purchase. */
  trialToPaid: 0.1,
};

const usd = (value: number) =>
  `$${Math.abs(value) >= 1_000 ? `${(value / 1_000).toFixed(1)}K` : Math.round(value)}`;
const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const count = new Intl.NumberFormat("en-US");
const regions = new Intl.DisplayNames(["en"], { type: "region" });

/** `BD` → `Bangladesh`; the code itself when it is not one. */
export function countryName(code: string): string {
  try {
    return regions.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function guardrails(data: GoodCustomersResponse): Guardrail[] {
  const { ladder, economics, allCustomers90, referralBar } = data;
  const ratio = cashbackToRevenue(data);
  const covering = share(economics.coveringOwnCashback, ladder.qualified);
  const neverFunded = share(ladder.neverFundedOrSpent, ladder.cardholders);
  const top = ladder.neverFundedTopCountry;
  const rows: Guardrail[] = [
    {
      key: "cashback",
      title: `Cashback vs tracked revenue, ${economics.days} days`,
      detail:
        data.feeRevenueUsd90 === null
          ? `${usd(allCustomers90.cashbackUsd)} of cashback; fee revenue could not be read`
          : `${usd(allCustomers90.cashbackUsd)} of cashback against ${usd(
              data.feeRevenueUsd90 + allCustomers90.primeUsd,
            )} of fees and Prime`,
      value: ratio === null ? "—" : `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×`,
      status:
        ratio === null ? "unknown" : ratio > GUARDRAIL_LIMITS.cashbackToRevenue ? "off" : "ok",
    },
    {
      key: "covering",
      title: "Qualified customers who cover their cashback",
      detail: "Fees and Prime they paid, against the cashback they earned",
      value: `${count.format(economics.coveringOwnCashback)} of ${count.format(ladder.qualified)}`,
      status:
        covering === null ? "unknown" : covering < GUARDRAIL_LIMITS.coveringShare ? "off" : "ok",
    },
    {
      key: "never-funded",
      title: "Cardholders who never funded or spent",
      detail: top
        ? `${count.format(ladder.neverFundedOrSpent)} people; ${count.format(top.count)} of them in ${countryName(top.country)}`
        : `${count.format(ladder.neverFundedOrSpent)} people`,
      value: pct(neverFunded),
      status:
        neverFunded === null
          ? "unknown"
          : neverFunded > GUARDRAIL_LIMITS.neverFundedShare
            ? "watch"
            : "ok",
    },
  ];
  if (referralBar) {
    const bunched = share(referralBar.bunched, ladder.activeSpenders);
    rows.push({
      key: "referral-bar",
      title: "Spend bunched at the referral bar",
      detail: `People whose ${data.definition.windowDays}-day spend sits just above the $${referralBar.spendUsd} a referred friend needs`,
      value: count.format(referralBar.bunched),
      status:
        bunched === null
          ? "unknown"
          : bunched > GUARDRAIL_LIMITS.referralBunchedShare
            ? "watch"
            : "ok",
    });
  }
  const tiers = tiersOf(data);
  if (tiers && tiers.legacy.endsOn && tiers.legacy.members > 0) {
    rows.push({
      key: "legacy-ending",
      title: `Legacy members whose tier ends ${dayLabel(tiers.legacy.endsOn)}`,
      detail: `${count.format(tiers.legacy.spenders)} of the ${count.format(
        tiers.legacy.members,
      )} spent ${usd(tiers.legacy.spendUsd)} in the last ${data.definition.windowDays} days. Their tier was kept from before tiers v3`,
      value: count.format(tiers.legacy.members),
      status: "watch",
    });
  }
  if (tiers && tiers.trials.ended > 0) {
    const toPaid = share(tiers.trials.endedThenBought, tiers.trials.ended);
    const neverAccepted = tiers.trials.gifted - tiers.trials.accepted;
    rows.push({
      key: "trial-to-paid",
      title: "Free trials that led to a purchase",
      detail: `${count.format(tiers.trials.endedThenBought)} of ${count.format(
        tiers.trials.ended,
      )} people whose trial ended bought a tier after accepting it. ${count.format(
        neverAccepted,
      )} gifted trials were never accepted`,
      value: pct(toPaid),
      status: toPaid === null ? "unknown" : toPaid < GUARDRAIL_LIMITS.trialToPaid ? "watch" : "ok",
    });
  }
  return rows;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** `September`, or `November (so far)` while the month's 30 days are still running. */
export function cohortLabel(cohort: GoodCustomersCohort): string {
  const name = MONTH_NAMES[Number(cohort.month.slice(5, 7)) - 1] ?? cohort.month;
  return cohort.complete ? name : `${name} (so far)`;
}

/** Bars for the weekly chart: qualified at the bottom, other spenders on top. */
export function weeklyBars(data: GoodCustomersResponse) {
  return data.weekly.map((week) => ({
    date: week.date,
    qualified: week.qualified,
    others: Math.max(week.activeSpenders - week.qualified, 0),
    activeSpenders: week.activeSpenders,
  }));
}
