import { formatDateTime } from "@/lib/utils";
import type {
  CardCreditEntryKind,
  CardCreditSourceType,
  ReferralBoostAdmin,
  ReferralV4BoostSides,
  ReferralV4Config,
  ReferralV4DebtRecovery,
  ReferralV4DebtStatus,
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
  reversed: { label: "Reversed", variant: "danger" },
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

/** How each referral debt state reads in the portal. */
export const REFERRAL_V4_DEBT_STATUS: Record<
  ReferralV4DebtStatus,
  { label: string; variant: BadgeVariant }
> = {
  open: { label: "Open", variant: "warning" },
  recovered: { label: "Recovered", variant: "success" },
  waived: { label: "Waived", variant: "muted" },
  written_off: { label: "Written off", variant: "danger" },
};

export function referralV4DebtStatus(status: string | null | undefined) {
  if (!status) return { label: "—", variant: "muted" as const };
  return (
    REFERRAL_V4_DEBT_STATUS[status as ReferralV4DebtStatus] ?? {
      label: status,
      variant: "muted" as const,
    }
  );
}

export const DEBT_RECOVERY_VIA_LABELS: Record<
  ReferralV4DebtRecovery["via"],
  string
> = {
  bonus: "From a later bonus",
  spend_share: "From spend share",
};

/** The numeric fields of the v4 config. */
export type ReferralV4NumericField = {
  [K in keyof ReferralV4Config]: ReferralV4Config[K] extends number ? K : never;
}[keyof ReferralV4Config];

/**
 * What each numeric v4 field may be set to — the backend's own bounds
 * (`REFERRAL_V4_NUMBER_FIELDS` in admins-service, and the contract for the
 * fields added with clawback). Out of range, the backend refuses the save.
 * `integer` marks counts, day spans, the weekday and the hour.
 */
export const REFERRAL_V4_NUMBER_BOUNDS: Record<
  ReferralV4NumericField,
  { min: number; max: number; integer?: true }
> = {
  welcomeReferrerUsd: { min: 0, max: 500 },
  welcomeFriendUsd: { min: 0, max: 500 },
  welcomeSpendTargetUsd: { min: 1, max: 100_000 },
  welcomeMerchantTarget: { min: 1, max: 50, integer: true },
  welcomeWindowDays: { min: 1, max: 365, integer: true },
  bigSpenderReferrerUsd: { min: 0, max: 500 },
  bigSpenderFriendUsd: { min: 0, max: 500 },
  bigSpenderSpendTargetUsd: { min: 1, max: 1_000_000 },
  bigSpenderWindowDays: { min: 1, max: 365, integer: true },
  upgradePrimeUsd: { min: 0, max: 500 },
  upgradeUltraUsd: { min: 0, max: 500 },
  upgradePrimeLockFuse: { min: 1, max: 100_000_000 },
  upgradeUltraLockFuse: { min: 1, max: 100_000_000 },
  upgradeLockHoldDays: { min: 0, max: 730, integer: true },
  spendShareRate: { min: 0, max: 0.05 },
  spendShareCapPerFriendUsd: { min: 0, max: 100_000 },
  spendShareMaxWeeklyPayoutUsd: { min: 0, max: 50_000 },
  minWeeklyPayoutUsd: { min: 0, max: 100 },
  holdDays: { min: 0, max: 120, integer: true },
  payoutWeekday: { min: 0, max: 6, integer: true },
  payoutHourUtc: { min: 0, max: 23, integer: true },
  settlementGraceDays: { min: 0, max: 60, integer: true },
  bonusLimitBase: { min: 0, max: 10_000, integer: true },
  bonusLimitPerActiveFriend: { min: 0, max: 1_000, integer: true },
  bonusLimitActiveSpendUsd: { min: 0, max: 100_000 },
  monthTwoFromDays: { min: 1, max: 365, integer: true },
  monthTwoToDays: { min: 2, max: 400, integer: true },
  reviewMonthlyThreshold: { min: 0, max: 10_000, integer: true },
  reviewWindowDays: { min: 1, max: 365, integer: true },
  maxBoostMultiplier: { min: 1, max: 20 },
  linkMaxDaysAfterSignup: { min: 0, max: 365, integer: true },
  clawbackWatchDays: { min: 0, max: 730, integer: true },
  debtWriteOffDays: { min: 1, max: 1825, integer: true },
  debtWaiveBelowUsd: { min: 0, max: 100 },
};

/** Weekday names by `getUTCDay()` index — how the payout weekday is stored. */
export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** "Thursday" for 4, or null for anything that isn't a weekday index. */
export function weekdayName(day: number | null | undefined): string | null {
  if (typeof day !== "number" || !Number.isInteger(day)) return null;
  return WEEKDAYS[day] ?? null;
}

/** "10:00 UTC" for 10, or null for anything that isn't an hour. */
export function utcHourLabel(hour: number | null | undefined): string | null {
  if (typeof hour !== "number" || !Number.isInteger(hour)) return null;
  if (hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:00 UTC`;
}

/**
 * The weekly payout run as configured — "Thursdays at 10:00 UTC" — or null
 * when the config hasn't loaded, so copy can fall back to "the weekly run"
 * instead of naming a day it doesn't know.
 */
export function payoutScheduleLabel(
  weekday: number | null | undefined,
  hourUtc?: number | null,
): string | null {
  const day = weekdayName(weekday);
  if (!day) return null;
  const at = utcHourLabel(hourUtc);
  return at ? `${day}s at ${at}` : `${day}s`;
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
