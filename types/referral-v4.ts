/**
 * Referral program v4 (card credit) and card credit, as admins-service serves
 * them under `/admin/v1`.
 *
 * Mirrors the cross-repo contract: friends who sign up at or after the v4
 * launch earn card credit (welcome, big spender, upgrade) and their referrer
 * earns a share of their card spend in soFUSE; friends from before launch stay
 * on the legacy $25 + $25 soFUSE program.
 */

export type ReferralV4Program = "v4" | "legacy";

export type ReferralV4RewardStatus =
  /** Not reached, still reachable (friend hasn't started). */
  | "locked"
  /** Friend is working toward it. */
  | "in_progress"
  /** Earned; unlocking (hold) — see `unlocksAt`. */
  | "on_hold"
  /** Earned; over the referrer's bonus limit (kept, paid when it grows). */
  | "limit_reached"
  /** Earned; held for manual review. */
  | "under_review"
  /** Card credit granted. */
  | "credited"
  /** Spend share paid (soFUSE). */
  | "paid"
  /** Window closed without reaching it. */
  | "expired"
  /** Country rule. */
  | "excluded"
  /** Refunded / fraud / rejected. */
  | "cancelled";

export type ReferralV4Step = "welcome" | "big_spender" | "upgrade";
export type ReferralV4BoostSides = "both" | "referrer" | "friend";

export interface ReferralV4Boost {
  id: string;
  name: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
  steps: ReferralV4Step[];
  sides: ReferralV4BoostSides;
}

export interface ReferralV4Terms {
  enabled: boolean;
  launchAt: string | null;
  welcome: {
    referrerUsd: number;
    friendUsd: number;
    spendTargetUsd: number;
    merchantTarget: number;
    windowDays: number;
  };
  bigSpender: {
    referrerUsd: number;
    friendUsd: number;
    spendTargetUsd: number;
    windowDays: number;
  };
  upgrade: {
    primeUsd: number;
    ultraUsd: number;
    primeLockFuse: number;
    ultraLockFuse: number;
    lockHoldDays: number;
  };
  spendShare: {
    rate: number;
    capPerFriendUsd: number;
    /** 4 = Thursday. */
    payoutWeekday: number;
  };
  holdDays: number;
  bonusLimit: {
    enabled: boolean;
    base: number;
    perActiveFriend: number;
    activeSpendUsd: number;
  };
  excludedCountries: string[];
  /** The boost running right now, if any. */
  boost: ReferralV4Boost | null;
}

export interface ReferralV4StepView {
  status: ReferralV4RewardStatus;
  /** What this step pays the referrer (or the friend, on the friend's side). */
  amountUsd: number;
  progressUsd?: number;
  targetUsd?: number;
  /** Welcome only. */
  merchantCount?: number;
  merchantTarget?: number;
  /** Window end. */
  deadlineAt?: string;
  earnedAt?: string;
  unlocksAt?: string;
  creditedAt?: string;
}

export interface ReferralV4UpgradeView {
  status: ReferralV4RewardStatus;
  /** 20 or 100: total earned/earnable from this friend's upgrade. */
  amountUsd: number;
  tier: "prime" | "ultra" | null;
  via: "paid" | "lock" | null;
  /** Lock route: when the lock hold completes. */
  lockEligibleAt?: string;
  earnedAt?: string;
  unlocksAt?: string;
  creditedAt?: string;
}

export type ReferralV4FriendStage =
  | "registered"
  | "verifying"
  | "card_ordered"
  | "spending"
  | "earning"
  | "idle"
  | "capped"
  | "expired"
  | "under_review"
  | "reversed";

/**
 * A legacy (pre-launch) friend's reward, as the app's referral list carries
 * it. Loosely typed on purpose: only read for display.
 */
export interface ReferralV4LegacyRow {
  stage?: string;
  status?: string;
  spendUsd?: number;
  spendTargetUsd?: number;
  merchantCount?: number;
  merchantTarget?: number;
  rewardUsd?: number;
  payoutToken?: string;
  payoutEtaAt?: string;
  paidAt?: string;
  payoutTxUrl?: string;
}

export interface ReferralV4FriendRow {
  referredUserId: string;
  username: string;
  joinedAt: string;
  program: ReferralV4Program;
  stage: ReferralV4FriendStage;
  /** Credited + paid to the referrer from this friend. */
  earnedUsd: number;
  /** Earned but not yet credited (on_hold / limit_reached / under_review). */
  onHoldUsd: number;
  /** 2000 for v4; the legacy reward amount for legacy friends. */
  capUsd: number;
  countryExcluded: boolean;
  spendShare: { earnedUsd: number; thisWeekUsd: number };
  welcome: ReferralV4StepView;
  bigSpender: ReferralV4StepView;
  upgrade: ReferralV4UpgradeView;
  legacy?: ReferralV4LegacyRow;
}

export interface ReferralV4Totals {
  /** Lifetime credited + paid (v4) + legacy paid referrer rewards. */
  earnedUsd: number;
  /** Same, credited/paid in the current UTC month. */
  thisMonthUsd: number;
  /** Earned, not yet credited. */
  onHoldUsd: number;
  /** Accrued for the current week, paid next Thursday. */
  pendingSpendShareUsd: number;
  /** Next Thursday payout run (ISO). */
  nextPayoutAt: string;
}

export interface ReferralV4BonusLimit {
  limit: number;
  used: number;
  waiting: number;
}

// ---------------------------------------------------------------------------
// Admin: access
// ---------------------------------------------------------------------------

/** What the signed-in admin may do (env `REFERRAL_ADMIN_EMAILS`). */
export interface ReferralV4Access {
  canEditConfig: boolean;
  canManageCredit: boolean;
  canReview: boolean;
}

// ---------------------------------------------------------------------------
// Admin: config (`referralV4` on the rewards config)
// ---------------------------------------------------------------------------

export interface ReferralV4Config {
  enabled: boolean;
  /** Friends who sign up at or after this instant (UTC) are on v4. */
  launchAt: string | null;
  welcomeReferrerUsd: number;
  welcomeFriendUsd: number;
  welcomeSpendTargetUsd: number;
  welcomeMerchantTarget: number;
  welcomeWindowDays: number;
  bigSpenderReferrerUsd: number;
  bigSpenderFriendUsd: number;
  bigSpenderSpendTargetUsd: number;
  bigSpenderWindowDays: number;
  upgradePrimeUsd: number;
  upgradeUltraUsd: number;
  upgradePrimeLockFuse: number;
  upgradeUltraLockFuse: number;
  upgradeLockHoldDays: number;
  /** A fraction: 0.01 is 1%. */
  spendShareRate: number;
  spendShareCapPerFriendUsd: number;
  /** Safety ceiling per referrer per week. */
  spendShareMaxWeeklyPayoutUsd: number;
  holdDays: number;
  bonusLimitEnabled: boolean;
  bonusLimitBase: number;
  bonusLimitPerActiveFriend: number;
  bonusLimitActiveSpendUsd: number;
  reviewMonthlyThreshold: number;
  /** ISO-2 country codes. */
  excludedCountries: string[];
  /** A code added later than this after signup earns nothing in v4. */
  linkMaxDaysAfterSignup: number;
}

// ---------------------------------------------------------------------------
// Admin: card credit per user
// ---------------------------------------------------------------------------

export type CardCreditSourceType =
  | "referral_welcome"
  | "referral_big_spender"
  | "referral_upgrade"
  | "referral_boost"
  | "admin_grant";

export type CardCreditEntryKind =
  | "grant"
  | "hold"
  | "spend"
  | "release"
  | "refund"
  | "revoke";

export interface CardCreditHistoryEntry {
  id: string;
  kind: CardCreditEntryKind;
  amountUsd: number;
  balanceAfterUsd: number;
  label: string;
  transactionId?: string;
  merchantName?: string;
  createdAt: string;
}

export interface AdminCardCreditEntry extends CardCreditHistoryEntry {
  sourceType?: CardCreditSourceType;
  adminEmail?: string;
  reason?: string;
  referralRewardId?: string;
}

export interface AdminCardCreditAccount {
  availableUsd: number;
  pendingUsd: number;
  lifetimeGrantedUsd: number;
  lifetimeSpentUsd: number;
  lifetimeRevokedUsd: number;
  /** The user has an active Wirex card. */
  spendable: boolean;
}

export interface AdminCardCredit {
  account: AdminCardCreditAccount;
  entries: AdminCardCreditEntry[];
}

export interface CardCreditAdjustment {
  amountUsd: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Admin: referral v4 per user
// ---------------------------------------------------------------------------

export interface AdminReferralV4Reward {
  id: string;
  step: ReferralV4Step;
  side: "referrer" | "friend";
  amountUsd: number;
  status: ReferralV4RewardStatus;
  earnedAt?: string;
  unlocksAt?: string;
  creditedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  reviewReason?: string;
  boostMultiplier?: number;
  cardCreditEntryId?: string;
}

export interface AdminReferralV4FriendRow extends ReferralV4FriendRow {
  referrerId: string;
  country?: string;
  idCountry?: string;
  rewards: AdminReferralV4Reward[];
}

export interface AdminUserReferralsV4 {
  terms: ReferralV4Terms;
  asReferrer: {
    bonusLimit: ReferralV4BonusLimit | null;
    monthQualifiedCount: number;
    reviewThreshold: number;
    totals: ReferralV4Totals;
    friends: AdminReferralV4FriendRow[];
  };
  asFriend: AdminReferralV4FriendRow | null;
}

// ---------------------------------------------------------------------------
// Admin: review queue
// ---------------------------------------------------------------------------

export type ReferralReviewItemKind = "v4" | "legacy";

export interface ReferralReviewItem {
  kind: ReferralReviewItemKind;
  /** v4 reward id, or the legacy referredUserId. */
  id: string;
  friend: { id: string; username: string; country?: string };
  step?: string;
  side?: string;
  amountUsd: number;
  earnedAt?: string;
  reviewReason?: string;
}

export interface ReferralReviewGroup {
  referrerId: string;
  referrerUsername: string;
  monthQualifiedCount: number;
  items: ReferralReviewItem[];
}

export interface ReferralReviewQueue {
  groups: ReferralReviewGroup[];
}

export type ReferralReviewDecision = "approve" | "reject";

export interface ReferralReviewDecisionRequest {
  items: Array<{ kind: ReferralReviewItemKind; id: string }>;
  decision: ReferralReviewDecision;
  reason: string;
}

export interface ReferralReviewDecisionResult {
  results: Array<{
    kind: ReferralReviewItemKind;
    id: string;
    ok: boolean;
    status?: string;
    error?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Admin: boosts
// ---------------------------------------------------------------------------

export interface ReferralBoostAdmin extends ReferralV4Boost {
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creditGrantedUsd: number;
}

export interface ReferralBoostInput {
  name: string;
  /** 1 < x ≤ 5. */
  multiplier: number;
  startsAt: string;
  endsAt: string;
  steps: ReferralV4Step[];
  sides: ReferralV4BoostSides;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Admin: analytics
// ---------------------------------------------------------------------------

export interface ReferralV4Analytics {
  creditGrantedUsd: number;
  creditSpentUsd: number;
  creditOutstandingUsd: number;
  creditPendingUsd: number;
  onHoldUsd: number;
  spendSharePaidUsd: number;
  nextPayout: { at: string; estimateUsd: number; referrers: number };
  weekly: Array<{
    weekStart: string;
    creditGrantedUsd: number;
    spendSharePaidUsd: number;
  }>;
}
