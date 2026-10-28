/**
 * Referral program v4 (card credit) and card credit, as admins-service serves
 * them under `/admin/v1`.
 *
 * Mirrors the cross-repo contract: friends whose referral is recorded while
 * v4 is open to new signups (and its launch has passed) earn card credit
 * (welcome, big spender, upgrade) and their referrer earns a share of their
 * card spend in soFUSE. The program is stamped on the friend when the referral
 * is recorded, so later config changes never move anyone between programs;
 * friends from before launch stay on the legacy soFUSE cashback program.
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
  | "cancelled"
  /**
   * Credited, then taken back: the qualifying spend was refunded below the bar
   * within the clawback window, and a debt was booked for the amount.
   */
  | "reversed";

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
  /** Open to new signups: referrals recorded now are on v4. */
  enabled: boolean;
  launchAt: string | null;
  /** Payouts paused: no card credit is credited and no spend share sent. */
  paused: boolean;
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
    /** Weekday of the payout run: 0 = Sunday … 6 = Saturday. */
    payoutWeekday: number;
    /** Hour (UTC) of the payout run, 0–23. */
    payoutHourUtc: number;
    /** Smaller weekly spend-share transfers wait for the next week. */
    minWeeklyPayoutUsd: number;
  };
  holdDays: number;
  bonusLimit: {
    enabled: boolean;
    base: number;
    perActiveFriend: number;
    activeSpendUsd: number;
    /** The friend's "second month", in days after signup: start… */
    monthTwoFromDays: number;
    /** …and end. */
    monthTwoToDays: number;
  };
  /** Reversal of credited spend bonuses whose spend is refunded later. */
  clawback: { enabled: boolean; watchDays: number };
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
  /** When a credited bonus was reversed. */
  reversedAt?: string;
  /** The part of this bonus that went to repaying a reversed one. */
  offsetUsd?: number;
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
  /** When a credited bonus was reversed. */
  reversedAt?: string;
  /** The part of this bonus that went to repaying a reversed one. */
  offsetUsd?: number;
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
  /** Accrued for the current week, paid in the next payout run. */
  pendingSpendShareUsd: number;
  /** Next payout run (ISO). */
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
  /**
   * Open to new signups: a referral recorded while this is on and `launchAt`
   * has passed is on v4, anything else legacy. Stamped on the friend when the
   * referral is recorded, so changing it never moves existing friends.
   */
  enabled: boolean;
  /** v4 opens at this instant (UTC), when `enabled`. */
  launchAt: string | null;
  /**
   * Incident switch: stops crediting card credit and sending spend share.
   * Earning and tracking continue; nothing is lost.
   */
  paused: boolean;
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
  /** Smaller weekly spend-share transfers wait for the next week. */
  minWeeklyPayoutUsd: number;
  holdDays: number;
  /** Weekday of the payout run: 0 = Sunday … 6 = Saturday. */
  payoutWeekday: number;
  /** Hour (UTC) of the payout run, 0–23. */
  payoutHourUtc: number;
  /** Days a step stays open after its window, for late settlements. */
  settlementGraceDays: number;
  bonusLimitEnabled: boolean;
  bonusLimitBase: number;
  bonusLimitPerActiveFriend: number;
  bonusLimitActiveSpendUsd: number;
  /** The friend's "second month" (days after signup), for the bonus limit. */
  monthTwoFromDays: number;
  /** Its end; must be after `monthTwoFromDays`. */
  monthTwoToDays: number;
  /** More qualified friends than this within `reviewWindowDays` go to review. */
  reviewMonthlyThreshold: number;
  /** The window the review threshold counts friends over. */
  reviewWindowDays: number;
  /** The highest multiplier a boost may be created with. */
  maxBoostMultiplier: number;
  /** ISO-2 country codes. */
  excludedCountries: string[];
  /** A code added later than this after signup earns nothing in v4. */
  linkMaxDaysAfterSignup: number;
  /**
   * Reverse a credited welcome / big-spender bonus whose qualifying spend is
   * later refunded below the bar, booking a debt for the amount.
   */
  clawbackEnabled: boolean;
  /** How long after crediting such a refund still reverses the bonus. */
  clawbackWatchDays: number;
  /** An unrecovered debt is written off this many days after it is booked. */
  debtWriteOffDays: number;
  /** A debt whose remainder falls below this is waived (closed). */
  debtWaiveBelowUsd: number;
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
  /** When this credited bonus was reversed (status `reversed`). */
  reversedAt?: string;
  /** The part of this bonus that went to repaying a reversed one. */
  debtOffsetUsd?: number;
}

export interface AdminReferralV4FriendRow extends ReferralV4FriendRow {
  referrerId: string;
  country?: string;
  idCountry?: string;
  rewards: AdminReferralV4Reward[];
}

export type ReferralV4DebtStatus =
  /** Still being recovered from future bonuses and spend share. */
  | "open"
  /** Repaid in full. */
  | "recovered"
  /** Closed: the remainder fell below the waive threshold. */
  | "waived"
  /** Closed unrecovered: by age, or by an admin. */
  | "written_off";

export interface ReferralV4DebtRecovery {
  at: string;
  usd: number;
  /** Taken from a later v4 bonus, or from a weekly spend-share payout. */
  via: "bonus" | "spend_share";
  /** The reward or payout it was taken from. */
  ref: string;
}

/**
 * What this user owes for a credited bonus that was reversed. Recovered from
 * their future v4 bonuses (before the card credit is granted) and weekly spend
 * share (before the transfer) — never from the card credit balance.
 */
export interface AdminReferralV4Debt {
  id: string;
  /** The side this user was on in the referral. */
  side: "referrer" | "friend";
  step: "welcome" | "big_spender";
  /** The reversed reward. */
  rewardId: string;
  friend: { id: string; username: string };
  amountUsd: number;
  remainingUsd: number;
  status: ReferralV4DebtStatus;
  createdAt: string;
  /** When it is written off automatically if still open. */
  writeOffAt: string;
  closedAt?: string;
  /** Admin email, when written off by hand. */
  closedBy?: string;
  recoveries: ReferralV4DebtRecovery[];
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
  /** Debts this user owes from reversed bonuses, open and closed. */
  debts: AdminReferralV4Debt[];
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
  /** Above 1, at most the config's `maxBoostMultiplier`. */
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
  /** Clawback: debts from reversed bonuses. */
  debts: {
    openUsd: number;
    recoveredUsd: number;
    writtenOffUsd: number;
    waivedUsd: number;
    /** Credited bonuses reversed, all time. */
    reversedBonuses: number;
  };
}
