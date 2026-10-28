import type { ReferralRewardStatus } from "@/types";

/**
 * Referrals → Review: the shapes rewards-service returns for the review
 * queue, the bulk decisions, blocked referrers and the re-check of unpaid
 * rewards (via admins-service `/referral-review`).
 */

/** Why a reward is held for review. */
export type ReferralReviewReason =
  | "manual_hold"
  | "referrer_blocked"
  | "velocity_over_monthly_threshold";

/**
 * How a referrer is blocked: `hold` stops each reward for a decision, `void`
 * cancels them, `withhold_referrer` pays the friends and not the referrer.
 */
export type ReferralBlockMode = "hold" | "void" | "withhold_referrer";

export type ReferralDecisionAction =
  | "hold"
  | "approve"
  | "approve_friend_only"
  | "reject";

/** The review table's status filter; `unpaid` is pending + qualified + under review. */
export type ReferralReviewStatusFilter =
  | "under_review"
  | "qualified"
  | "pending"
  | "unpaid"
  | "reversed"
  | "expired"
  | "paid";

export interface ReferralReviewRow {
  referredUserId: string;
  username: string;
  referrerId: string;
  referrerUsername: string;
  status: ReferralRewardStatus;
  signupAt: string;
  qualifiedAt?: string;
  payoutDueAt?: string;
  spendUsd: number;
  merchantCount: number;
  spendTargetUsd: number;
  merchantTarget: number;
  /** $0 when the referrer's share is withheld. */
  referrerRewardUsd: number;
  newUserRewardUsd: number;
  reviewReasons: string[];
  heldAt?: string;
  heldBy?: string;
  reviewApprovedAt?: string;
  reviewApprovedBy?: string;
  reversedAt?: string;
  reversalReason?: string;
  reversedBy?: string;
  referrerLegWithheld: boolean;
  /** How the referrer is blocked, if they are. */
  referrerBlockMode?: ReferralBlockMode;
  /** A leg has been initiated or sent: nothing here can stop it. */
  payoutInFlight: boolean;
}

export interface ReferralReviewPage {
  rows: ReferralReviewRow[];
  total: number;
  page: number;
  limit: number;
  /** Rewards per status across the whole ledger. */
  counts: Partial<Record<ReferralRewardStatus, number>>;
}

export interface ReferralReviewQuery {
  status: ReferralReviewStatusFilter;
  reason?: string;
  referrer?: string;
  users?: string;
  page: number;
  limit: number;
}

export interface ReferralDecisionOutcome {
  /** The username or id as it was given. */
  input: string;
  referredUserId?: string;
  username?: string;
  ok: boolean;
  previousStatus?: ReferralRewardStatus;
  status?: ReferralRewardStatus;
  /** Why it was left alone. */
  error?: string;
}

export interface ReferralDecisionResult {
  action: ReferralDecisionAction;
  changed: number;
  unchanged: number;
  outcomes: ReferralDecisionOutcome[];
}

export interface ReferralBlockedReferrerRow {
  referrerId: string;
  username: string;
  mode: ReferralBlockMode;
  reason: string;
  blockedBy: string;
  blockedAt: string;
  /** Their rewards per status. */
  rewards: Partial<Record<ReferralRewardStatus, number>>;
}

export interface ReferralBlockResult {
  referrerId: string;
  username: string;
  mode: ReferralBlockMode;
  applied: {
    held: number;
    voided: number;
    withheld: number;
    /** Already decided by an admin, so left as decided. */
    kept: number;
    /** Payout in flight, or changed meanwhile. */
    skipped: number;
  };
}

export interface ReferralUnblockResult {
  referrerId: string;
  username: string;
  released: number;
  restored: number;
}

interface RecheckEntry {
  referredUserId: string;
  username?: string;
}

export interface ReferralRecheckRun {
  id: string;
  dryRun: boolean;
  status: "running" | "done" | "failed";
  startedBy: string;
  reason?: string;
  startedAt: string;
  finishedAt?: string;
  total: number;
  processed: number;
  counts: {
    stays: number;
    needsPurchase: number;
    hold: number;
    void: number;
    skipped: number;
  };
  hold: (RecheckEntry & { reasons: string[] })[];
  void: (RecheckEntry & { reason: string })[];
  needsPurchase: RecheckEntry[];
  skipped: (RecheckEntry & { error: string })[];
  error?: string;
}
