import type { GoodCustomersCohort, GoodCustomersResponse } from "@/types/overview";

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
