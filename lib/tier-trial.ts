import { formatDateTime } from "@/lib/utils";
import { TierTrial, TierTrialStatus } from "@/types";

/** Matches the bounds accounts-service enforces on a gifted trial. */
export const MIN_TIER_TRIAL_DAYS = 1;
export const MAX_TIER_TRIAL_DAYS = 365;

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
