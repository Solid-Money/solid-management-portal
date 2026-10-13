import { formatUsd } from "@/lib/utils";
import { ReferralRewardStatus, ReferralSpendReading } from "@/types";

type BadgeVariant = "warning" | "success" | "info" | "danger" | "muted";

/** How each ledger state of a referral reward reads in the portal. */
export const REFERRAL_STATUS: Record<
  ReferralRewardStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending: { label: "Pending", variant: "muted" },
  qualified: { label: "Qualified", variant: "info" },
  paid: { label: "Paid", variant: "success" },
  expired: { label: "Expired", variant: "muted" },
  reversed: { label: "Reversed", variant: "danger" },
  under_review: { label: "Under review", variant: "warning" },
};

export function referralStatus(status: string | null | undefined) {
  if (!status) return { label: "Not tracked yet", variant: "muted" as const };
  return (
    REFERRAL_STATUS[status as ReferralRewardStatus] ?? {
      label: status,
      variant: "muted" as const,
    }
  );
}

/**
 * Why the engine voided a reward, in words support can repeat to the user.
 *
 * `chargeback` is the engine's word for "the friend's spend no longer cleared
 * the bar when the payout re-checked it". Rewards reversed before refunds were
 * netted against the bar carry it for any refund at all, however small — which
 * is what re-evaluating is for.
 */
export function reversalReasonLabel(reason: string | undefined): string {
  switch (reason) {
    case "chargeback":
      return "Spend net of refunds fell under the bar at payout";
    case "ineligible_spend":
      return "Never cleared the bar on eligible purchases (excluded merchants, purchases under the minimum, or too few merchants with the minimum spent)";
    case "no_activity_after_qualifying":
      return "No eligible purchase between qualifying and the payout";
    case "account_closed":
      return "The friend's account no longer exists";
    case "self_referral_suspected":
      return "Friend shares a wallet or email with the referrer";
    case "rejected_in_review":
      return "Rejected by an admin in referral review";
    case "referrer_blocked":
      return "The referrer is blocked from referral rewards";
    default:
      return reason ?? "No reason recorded";
  }
}

/** "$80.17 of $75 · 5/3 merchants" — progress against the row's own bar. */
export function spendAgainstBar(
  spendUsd: number,
  spendTargetUsd: number,
  merchantCount: number,
  merchantTarget: number
): string {
  return `${formatUsd(spendUsd)} of ${formatUsd(spendTargetUsd, 0)} · ${merchantCount}/${merchantTarget} merchants`;
}

/** "$80.17 spent − $0.40 refunded = $79.77 net" — how the net figure was reached. */
export function spendBreakdown(spend: ReferralSpendReading): string {
  if (spend.refundedSpendUsd <= 0) {
    return `${formatUsd(spend.netSpendUsd)} spent, no refunds`;
  }
  return `${formatUsd(spend.qualifiedSpendUsd)} spent − ${formatUsd(
    spend.refundedSpendUsd
  )} refunded = ${formatUsd(spend.netSpendUsd)} net`;
}

/** Why a reward is held for review, as one short phrase. */
export function reviewReasonLabel(reason: string): string {
  switch (reason) {
    case "manual_hold":
      return "Held by an admin";
    case "referrer_blocked":
      return "Referrer blocked (hold)";
    case "velocity_over_monthly_threshold":
      return "Referrer over the monthly threshold";
    default:
      return reason;
  }
}

/** How each way of blocking a referrer reads, and what it does. */
export const BLOCK_MODES: Record<
  "hold" | "void" | "withhold_referrer",
  { label: string; variant: BadgeVariant; description: string }
> = {
  hold: {
    label: "Hold",
    variant: "warning",
    description:
      "Every reward of theirs waits in the review queue until an admin approves or rejects it.",
  },
  void: {
    label: "Void",
    variant: "danger",
    description:
      "Every unpaid reward of theirs is cancelled — neither side is paid. Use Pay friend only for a genuine friend.",
  },
  withhold_referrer: {
    label: "Pay friends only",
    variant: "info",
    description:
      "Their friends are paid as normal; the referrer's share is withheld.",
  },
};
