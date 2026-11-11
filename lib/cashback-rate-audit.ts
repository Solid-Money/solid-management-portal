import type { CashbackRateAuditRequest } from "@/types";

/** The Bulk → "Top up short-paid cashback" form, as typed. */
export interface RateAuditForm {
  /** Percent, as typed: "4" is 4%. */
  ratePct: string;
  /** First UTC day of the window, `YYYY-MM-DD`, included. */
  fromDate: string;
  /** Last UTC day of the window, `YYYY-MM-DD`, included. */
  toDate: string;
  /** Issuer transaction ids, pasted in any shape. Empty audits the whole window. */
  transactionIds: string;
  /** USD; empty applies each cardholder's tier ceiling. */
  monthlyCapUsd: string;
  includeUsersWithDebt: boolean;
}

export type RateAuditFormErrors = Partial<Record<keyof RateAuditForm, string>>;

/** The request without `dryRun`: the same body previews and then pays. */
export type RateAuditQuery = Omit<CashbackRateAuditRequest, "dryRun">;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
/** The server's own ceiling on `transactionIds`. */
const MAX_TRANSACTION_IDS = 20_000;

/**
 * Transaction ids pasted from anywhere — a support chat, a spreadsheet column,
 * a comma list — deduplicated, in the order given.
 *
 * The app shows a card purchase's id as `card-<uuid>`, which is what customers
 * quote; cashback rows store the bare issuer id, so the prefix is dropped or the
 * audit would match nothing.
 */
export function parseTransactionIds(text: string): string[] {
  const ids = text
    .split(/[\s,;]+/)
    .map((value) => value.trim().replace(/^card-/i, ""))
    .filter(Boolean);
  return [...new Set(ids)];
}

function utcDay(value: string): number | null {
  if (!DATE.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(time) ? null : time;
}

/**
 * Turn the form into the audit request, or say what is wrong with it.
 *
 * The form takes whole UTC days with both ends included, which is how support
 * describes an incident ("purchases on 20 Oct"); the API's `to` is exclusive,
 * so it becomes the start of the day after.
 */
export function buildRateAuditQuery(form: RateAuditForm): {
  query?: RateAuditQuery;
  errors: RateAuditFormErrors;
} {
  const errors: RateAuditFormErrors = {};

  const ratePct = Number(form.ratePct);
  if (!form.ratePct.trim() || !Number.isFinite(ratePct)) {
    errors.ratePct = "Enter the rate they should have earned, e.g. 4";
  } else if (ratePct < 0.1 || ratePct > 100) {
    errors.ratePct = "Between 0.1% and 100%";
  }

  const from = utcDay(form.fromDate);
  const to = utcDay(form.toDate);
  if (from === null) errors.fromDate = "Pick a start day";
  if (to === null) errors.toDate = "Pick an end day";
  if (from !== null && to !== null && to < from) {
    errors.toDate = "The end day is before the start day";
  }

  const transactionIds = parseTransactionIds(form.transactionIds);
  if (transactionIds.length > MAX_TRANSACTION_IDS) {
    errors.transactionIds = `At most ${MAX_TRANSACTION_IDS.toLocaleString("en-US")} ids per run`;
  }

  let monthlyCapUsd: number | undefined;
  if (form.monthlyCapUsd.trim()) {
    monthlyCapUsd = Number(form.monthlyCapUsd);
    if (
      !Number.isFinite(monthlyCapUsd) ||
      monthlyCapUsd < 0 ||
      monthlyCapUsd > 100_000
    ) {
      errors.monthlyCapUsd =
        "A dollar amount between 0 and 100,000, or leave empty";
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    query: {
      // Rounded so 4.1 does not travel as 0.041000000000000005.
      rate: Number((ratePct / 100).toFixed(6)),
      from: new Date(from!).toISOString(),
      to: new Date(to! + DAY_MS).toISOString(),
      dateField: "postedAt",
      ...(transactionIds.length > 0 && { transactionIds }),
      ...(monthlyCapUsd !== undefined && { monthlyCapUsd }),
      ...(form.includeUsersWithDebt && { includeUsersWithDebt: true }),
    },
  };
}

/**
 * Identity of a query, for "is the preview on screen still the one Pay would
 * send". Order of the pasted ids does not change what is audited.
 */
export function rateAuditQueryKey(query: RateAuditQuery): string {
  return JSON.stringify({
    ...query,
    transactionIds: query.transactionIds
      ? [...query.transactionIds].sort()
      : undefined,
  });
}

/** "20 Oct 2026" or "20 Oct – 22 Oct 2026": an exclusive-end window, as whole UTC days. */
export function describeRateAuditWindow(from: string, to: string): string {
  const format = (time: number, withYear: boolean) =>
    new Date(time).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      ...(withYear && { year: "numeric" }),
      timeZone: "UTC",
    });
  const start = Date.parse(from);
  const lastDay = Date.parse(to) - DAY_MS;
  if (Number.isNaN(start) || Number.isNaN(lastDay)) return `${from} – ${to}`;
  if (lastDay <= start) return format(start, true);
  return `${format(start, false)} – ${format(lastDay, true)}`;
}
