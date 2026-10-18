import {
  BulkResendRowOutcome,
  BulkResendRunStatus,
  CashbackEstimateBasis,
  FailedCashbackCause,
} from "@/types";

type BadgeVariant = "success" | "info" | "warning" | "danger" | "muted";

/** Matches the caps accounts-service enforces on one bulk re-send. */
export const MAX_BULK_RESEND_ROWS = 1000;
export const MAX_BULK_RESEND_USERS = 500;

export const FAILED_CASHBACK_CAUSES: {
  value: FailedCashbackCause;
  label: string;
  hint: string;
  /** Ticked when the page opens. */
  defaultOn: boolean;
}[] = [
  {
    value: "payout_wallet",
    label: "Payout wallet empty or out of gas",
    hint: "Failed before anything was sent — safe to re-send once the wallet is funded.",
    defaultOn: true,
  },
  {
    value: "no_payout_address",
    label: "No payout address",
    hint: "The cardholder had no Safe at the time. Re-sent only if they have one now.",
    defaultOn: true,
  },
  {
    value: "other",
    label: "Other errors",
    hint: "Some of these can fail after the transfer was broadcast. Check the error, and the user's wallet, before re-sending.",
    defaultOn: false,
  },
];

export function failedCashbackCauseLabel(cause: FailedCashbackCause): string {
  return (
    FAILED_CASHBACK_CAUSES.find((entry) => entry.value === cause)?.label ??
    cause
  );
}

export function failedCashbackCauseVariant(
  cause: FailedCashbackCause,
): BadgeVariant {
  switch (cause) {
    case "payout_wallet":
      return "info";
    case "no_payout_address":
      return "muted";
    default:
      return "warning";
  }
}

/** What a row's estimate is worth, for the tooltip beside it. */
export function estimateBasisLabel(basis: CashbackEstimateBasis): string {
  switch (basis) {
    case "fixed":
      return "Its own figure (campaign or subscription discount)";
    case "row_rate":
      return "Spend × the rate frozen on the row";
    case "user_rate":
      return "Spend × the rate pinned to this cardholder";
    case "max_tier_rate":
      return "Spend × the highest tier rate — an upper bound; it pays their tier's";
    case "none":
      return "Pays nothing";
  }
}

const OUTCOME_LABELS: Record<
  BulkResendRowOutcome,
  { label: string; variant: BadgeVariant }
> = {
  queued: { label: "Queued", variant: "success" },
  skipped: { label: "Skipped", variant: "muted" },
  blocked: { label: "Blocked", variant: "warning" },
  not_sent: { label: "Not sent", variant: "muted" },
  failed: { label: "Failed", variant: "danger" },
};

/** The order outcome totals are read in: what went out, then what did not. */
export const BULK_RESEND_OUTCOME_ORDER: BulkResendRowOutcome[] = [
  "queued",
  "skipped",
  "blocked",
  "not_sent",
  "failed",
];

export function bulkResendOutcomeLabel(outcome: BulkResendRowOutcome): string {
  return OUTCOME_LABELS[outcome]?.label ?? outcome;
}

export function bulkResendOutcomeVariant(
  outcome: BulkResendRowOutcome,
): BadgeVariant {
  return OUTCOME_LABELS[outcome]?.variant ?? "muted";
}

export function bulkResendRunStatusLabel(status: BulkResendRunStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "blocked":
      return "Refused";
    // Still "running" after the fact means the process stopped mid-run: the
    // run was recorded but its outcome never was.
    case "running":
      return "Interrupted";
  }
}

export function bulkResendRunStatusVariant(
  status: BulkResendRunStatus,
): BadgeVariant {
  switch (status) {
    case "completed":
      return "success";
    case "blocked":
      return "warning";
    case "running":
      return "danger";
  }
}

/**
 * User ids or usernames from a pasted block — one per line or separated by
 * commas, the way a column copied out of a sheet or a Slack thread arrives.
 * A leading "@" is dropped and duplicates are removed.
 */
export function parseUserList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,]/)
        .map((entry) => entry.trim().replace(/^@+/, ""))
        .filter(Boolean),
    ),
  ];
}

/**
 * Rounded up to the cent, for a top-up that has to cover a shortfall. Through
 * whole micro-units first: 1.2 * 100 is 120.00000000000001 in binary, and a
 * bare ceil would ask for 1.21.
 */
export function roundUpToCents(value: number): number {
  return Math.ceil(Math.round(value * 1e6) / 1e4) / 100;
}

/** A soUSD amount to two places, which is what a top-up is decided in. */
export function formatSoUsd(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)} soUSD`;
}
