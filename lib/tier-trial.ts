import { formatDateTime } from "@/lib/utils";
import { TierTrial, TierTrialBatchOutcome, TierTrialStatus } from "@/types";

/** Matches the bounds accounts-service enforces on a gifted trial. */
export const MIN_TIER_TRIAL_DAYS = 1;
export const MAX_TIER_TRIAL_DAYS = 365;

/** Matches the cap accounts-service enforces on one batch of gifts. */
export const MAX_TIER_TRIAL_BATCH_SIZE = 500;

/**
 * The usernames in a pasted block, one per line.
 *
 * Blank lines vanish and a leading "@" is dropped — both are what a list
 * pasted out of Slack or a spreadsheet actually looks like. Duplicates are
 * kept: the backend reports them as their own outcome, and dropping them here
 * would leave the operator looking for a line that silently disappeared.
 */
export function parseUsernameList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().replace(/^@+/, ""))
    .filter(Boolean);
}

/** How many names in a parsed list repeat one above them, case-insensitively. */
export function countDuplicateUsernames(usernames: string[]): number {
  const seen = new Set<string>();

  return usernames.reduce((duplicates, username) => {
    const key = username.toLowerCase();
    const repeat = seen.has(key);
    seen.add(key);

    return duplicates + (repeat ? 1 : 0);
  }, 0);
}

/** What happened to one batch line, in the words the panel uses. */
export function tierTrialBatchOutcomeLabel(
  outcome: TierTrialBatchOutcome
): string {
  switch (outcome) {
    case "gifted":
      return "Gifted";
    case "extended":
      return "Extended";
    case "replaced":
      return "Replaced";
    case "skipped":
      return "Skipped";
    case "not_found":
      return "No such user";
    case "duplicate":
      return "Duplicate";
    case "failed":
      return "Failed";
    default:
      return outcome;
  }
}

/**
 * Which badge colour an outcome gets.
 *
 * Only a genuine failure is red. A skip and a duplicate are the batch doing
 * what it was told, and a username nobody holds is a typo to fix rather than
 * something that went wrong — amber, not alarm.
 */
export function tierTrialBatchOutcomeVariant(
  outcome: TierTrialBatchOutcome
): "success" | "info" | "warning" | "muted" | "danger" {
  switch (outcome) {
    case "gifted":
      return "success";
    case "extended":
    case "replaced":
      return "info";
    case "skipped":
    case "not_found":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "muted";
  }
}

/** A trial status in the words the panel uses. */
export function tierTrialStatusLabel(status: TierTrialStatus): string {
  switch (status) {
    case "pending_activation":
      return "Waiting for the user";
    case "active":
      return "Running";
    case "expired":
      return "Ended";
    case "revoked":
      return "Revoked";
    default:
      return status;
  }
}

/** Which badge colour a status gets, matching the tier badges above it. */
export function tierTrialStatusVariant(
  status: TierTrialStatus
): "success" | "warning" | "muted" | "danger" {
  switch (status) {
    case "active":
      return "success";
    case "pending_activation":
      return "warning";
    case "revoked":
      return "danger";
    default:
      return "muted";
  }
}

/**
 * How much of a running trial is left, in the app's own words ("29d 14h left").
 *
 * Reads the backend's `hoursRemaining` rather than recomputing from `expiresAt`
 * so the dashboard and the countdown in the app can't disagree about a trial
 * that is hours from ending.
 */
export function tierTrialRemaining(trial: TierTrial): string {
  if (trial.status !== "active") return "—";

  const hours = Math.max(0, trial.hoursRemaining);
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;

  if (days > 0) return `${days}d ${restHours}h left`;
  if (hours > 0) return `${hours}h left`;
  return "Less than an hour left";
}

/** A date as the panel shows it: "Oct 6, 2026, 02:00 PM". "—" for no date. */
export function formatTrialDate(date?: string | null): string {
  return date ? formatDateTime(date) : "—";
}
