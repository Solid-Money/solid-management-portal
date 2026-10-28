import { formatDateTime } from "@/lib/utils";
import type {
  CardCreditEntryKind,
  CardCreditSourceType,
  ReferralBoostAdmin,
  ReferralV4BoostSides,
  ReferralV4FriendStage,
  ReferralV4RewardStatus,
  ReferralV4Step,
} from "@/types/referral-v4";

export type BadgeVariant = "warning" | "success" | "info" | "danger" | "muted";

/** The HTTP status of a failed axios call, if it got that far. */
export function statusOf(error: unknown): number | undefined {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Whether a failed read means "this backend doesn't serve it yet" rather than
 * "it broke": the v4 endpoints ship after this portal does, so a 404 or a 503
 * from a service still on the old build is expected, and the screen says so
 * quietly instead of showing an error.
 */
export function isNotAvailable(error: unknown): boolean {
  const status = statusOf(error);
  return (
    status === 404 ||
    status === 405 ||
    status === 501 ||
    status === 502 ||
    status === 503
  );
}

/**
 * Retry policy for the v4 reads: never retry an answer (4xx) or a "not
 * deployed yet" (503 and friends) — retrying only delays the muted state.
 */
export function referralV4Retry(failureCount: number, error: unknown) {
  const status = statusOf(error);
  if (isNotAvailable(error)) return false;
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

/** How each v4 reward state reads in the portal. */
export const REFERRAL_V4_STATUS: Record<
  ReferralV4RewardStatus,
  { label: string; variant: BadgeVariant }
> = {
  locked: { label: "Locked", variant: "muted" },
  in_progress: { label: "In progress", variant: "info" },
  on_hold: { label: "On hold", variant: "warning" },
  limit_reached: { label: "Over bonus limit", variant: "warning" },
  under_review: { label: "Under review", variant: "warning" },
  credited: { label: "Credited", variant: "success" },
  paid: { label: "Paid", variant: "success" },
  expired: { label: "Expired", variant: "muted" },
  excluded: { label: "Excluded (country)", variant: "muted" },
  cancelled: { label: "Cancelled", variant: "danger" },
};

export function referralV4Status(status: string | null | undefined) {
  if (!status) return { label: "—", variant: "muted" as const };
  return (
    REFERRAL_V4_STATUS[status as ReferralV4RewardStatus] ?? {
      label: status,
      variant: "muted" as const,
    }
  );
}

/** Rewards an admin can still cancel: earned, but not credited yet. */
export const CANCELLABLE_V4_STATUSES: ReadonlySet<string> = new Set([
  "on_hold",
  "limit_reached",
  "under_review",
]);

export const REFERRAL_V4_STAGE: Record<
  ReferralV4FriendStage,
  { label: string; variant: BadgeVariant }
> = {
  registered: { label: "Registered", variant: "muted" },
  verifying: { label: "Verifying ID", variant: "muted" },
  card_ordered: { label: "Card ordered", variant: "muted" },
  spending: { label: "Spending", variant: "info" },
  earning: { label: "Earning", variant: "success" },
  idle: { label: "Idle this week", variant: "muted" },
  capped: { label: "Capped", variant: "info" },
  expired: { label: "Expired", variant: "muted" },
  under_review: { label: "Under review", variant: "warning" },
  reversed: { label: "Reversed", variant: "danger" },
};

export function referralV4Stage(stage: string | null | undefined) {
  if (!stage) return { label: "—", variant: "muted" as const };
  return (
    REFERRAL_V4_STAGE[stage as ReferralV4FriendStage] ?? {
      label: stage,
      variant: "muted" as const,
    }
  );
}

export const REFERRAL_V4_STEP_LABELS: Record<ReferralV4Step, string> = {
  welcome: "Welcome",
  big_spender: "Big spender",
  upgrade: "Upgrade",
};

export function referralV4StepLabel(step: string | undefined): string {
  if (!step) return "—";
  return REFERRAL_V4_STEP_LABELS[step as ReferralV4Step] ?? step;
}

export const BOOST_SIDES_LABELS: Record<ReferralV4BoostSides, string> = {
  both: "Both sides",
  referrer: "Referrer only",
  friend: "Friend only",
};

export const CARD_CREDIT_KIND_LABELS: Record<CardCreditEntryKind, string> = {
  grant: "Granted",
  hold: "Held",
  spend: "Spent",
  release: "Released",
  refund: "Refunded",
  revoke: "Removed",
};

/** Ledger kinds that take credit away from what is available. */
const DEBIT_KINDS: ReadonlySet<CardCreditEntryKind> = new Set([
  "hold",
  "spend",
  "revoke",
]);

/**
 * An entry's amount with its direction. Taken from the number when the
 * backend signs it, from the kind otherwise.
 */
export function signedCreditAmount(kind: CardCreditEntryKind, amount: number) {
  if (amount < 0) return amount;
  return DEBIT_KINDS.has(kind) ? -amount : amount;
}

export const CARD_CREDIT_SOURCE_LABELS: Record<CardCreditSourceType, string> = {
  referral_welcome: "Welcome bonus",
  referral_big_spender: "Big spender bonus",
  referral_upgrade: "Upgrade bonus",
  referral_boost: "Boost",
  admin_grant: "Admin grant",
};

/** "Nov 2, 2026, 14:00 UTC" — the program runs on UTC, so the portal does too. */
export function formatUtc(value?: string | null): string {
  if (!value) return "—";
  const formatted = formatDateTime(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  });
  return formatted === "—" ? formatted : `${formatted} UTC`;
}

/** "Nov 2, 2026" in UTC. */
export function formatUtcDay(value?: string | null): string {
  if (!value) return "—";
  return formatDateTime(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * An ISO instant as the value of a `datetime-local` input read in UTC
 * (`2026-11-02T14:00`), or "" for none.
 */
export function isoToUtcInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

/** A `datetime-local` value typed as UTC, back to an ISO instant. */
export function utcInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type BoostStatus = "Scheduled" | "Live" | "Ended" | "Disabled";

export function boostStatus(
  boost: Pick<ReferralBoostAdmin, "enabled" | "startsAt" | "endsAt">,
  now: number = Date.now(),
): BoostStatus {
  if (!boost.enabled) return "Disabled";
  if (now < new Date(boost.startsAt).getTime()) return "Scheduled";
  if (now >= new Date(boost.endsAt).getTime()) return "Ended";
  return "Live";
}

export const BOOST_STATUS_VARIANT: Record<BoostStatus, BadgeVariant> = {
  Scheduled: "info",
  Live: "success",
  Ended: "muted",
  Disabled: "warning",
};
