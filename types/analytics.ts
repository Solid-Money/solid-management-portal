/**
 * Analytics API response types.
 *
 * Mirrors `libs/common/src/types/analytics.types.ts` in solid-backend. Kept as
 * a hand-written copy rather than generated, matching how `types/revenue.ts`
 * already tracks the revenue responses — but the backend file is the authority,
 * so a change there needs the same change here.
 */

export type AnalyticsSourceId =
  | "database"
  | "amplitude"
  | "brevo"
  | "on-chain"
  | "intercom"
  | "sentry"
  | "rain"
  | "wirex"
  | "manual"
  | "derived";

export interface SeriesMeta {
  source: AnalyticsSourceId;
  updatedAt: string;
}

/** A measured value, or an explicit statement that we cannot measure it. */
export type Measured<T> =
  | ({ instrumented: true } & T)
  | { instrumented: false; reason: string };

export interface LiabilityBucket {
  date: string;
  count: number;
  usd: number;
}

export interface ReferralProgramTerms {
  enabled: boolean;
  referrerRewardUsd: number;
  newUserRewardUsd: number;
  spendTargetUsd: number;
  merchantTarget: number;
  qualifyWindowDays: number;
  payoutDelayDays: number;
  payoutToken: string;
}

export interface ReferralLiability {
  terms: ReferralProgramTerms;
  pending: {
    count: number;
    expectedUsd: number;
    riskAdjustedUsd: number;
    byWindowClose: LiabilityBucket[];
  };
  qualifiedUnpaid: {
    count: number;
    usd: number;
    overdue: LiabilityBucket;
    byDueDate: LiabilityBucket[];
  };
  underReview: { count: number; usd: number };
  qualificationRate: number | null;
  meta: SeriesMeta;
}

export interface CashbackLiability {
  accruedUsd: number;
  count: number;
  unratedSpend: number;
  byCreditDate: LiabilityBucket[];
  overdue: LiabilityBucket;
  unscheduled: { count: number; usd: number };
  meta: SeriesMeta;
}

export interface PointsLiability {
  totalPoints: number;
  holders: number;
  byType: Array<{ type: string; points: number; count: number }>;
  impliedUsd: Measured<{ usd: number; conversionRate: number }>;
  meta: SeriesMeta;
}

export interface RewardsOwedResponse {
  referrals: ReferralLiability;
  cashback: CashbackLiability;
  points: PointsLiability;
  totals: {
    committedUsd: number;
    forecastUsd: number;
  };
  generatedAt: string;
}

export interface RewardsPaidResponse {
  referrals: {
    byDay: Array<{
      date: string;
      count: number;
      referrerUsd: number;
      newUserUsd: number;
      payoutToken: string | null;
    }>;
    totalUsd: number;
    count: number;
    meta: SeriesMeta;
  };
  /**
   * Cashback credited per day, keyed on when it paid rather than when it was
   * earned — this is the series the payout wallet's outflow is matched against.
   */
  cashback: {
    byDay: Array<{ date: string; usd: number; count: number }>;
    totalUsd: number;
    count: number;
    meta: SeriesMeta;
  };
  points: {
    byDay: Array<{ date: string; points: number }>;
    totalPoints: number;
    meta: SeriesMeta;
  };
  generatedAt: string;
}

export interface ReferralProgramResponse {
  terms: ReferralProgramTerms;
  counts: {
    referrers: number;
    invited: number;
    pending: number;
    qualified: number;
    paid: number;
    expired: number;
    reversed: number;
    underReview: number;
  };
  qualificationRate: number | null;
  topReferrers: Array<{
    referrerId: string;
    invited: number;
    qualified: number;
    paid: number;
    paidUsd: number;
  }>;
  meta: SeriesMeta;
  generatedAt: string;
}

export type DepositRail =
  | "on_chain"
  | "virtual_account"
  | "transfi"
  | "rain_card_collateral";

/**
 * Every rail the deposits panel knows about, with the label and the note shown
 * when the backend returns no row for it.
 *
 * The list lives here rather than being inferred from the response, because a
 * rail with no ledger yet must render as "not instrumented" — inferring the
 * list from the data would make an unmeasured rail simply vanish, which is the
 * blind spot this panel exists to expose.
 */
export const DEPOSIT_RAILS: Array<{
  id: DepositRail;
  label: string;
  notInstrumentedReason?: string;
}> = [
  {
    id: "virtual_account",
    label: "Bank / virtual account",
  },
  {
    id: "on_chain",
    label: "On-chain direct",
    notInstrumentedReason:
      "Stablecoin receives are recorded per user but not yet aggregated as a deposit funnel with attempts and failures.",
  },
  {
    id: "transfi",
    label: "TransFi (buy crypto)",
    notInstrumentedReason:
      "TransFi orders are stored, but their attempt and failure states are not yet mapped onto the deposit funnel.",
  },
  {
    id: "rain_card_collateral",
    label: "Rain card collateral",
    notInstrumentedReason:
      "Rain collateral postings are recorded; the funnel view of them lands with the Card tab in Phase 2.",
  },
];

export interface DepositRailRow {
  rail: DepositRail;
  attempts: number;
  successes: number;
  failures: number;
  volumeUsd: number;
  uniqueUsers: number;
  medianSecondsToCredit: number | null;
  meta: SeriesMeta;
}

export interface DepositRailsResponse {
  rails: DepositRailRow[];
  byDay: Array<{
    date: string;
    rail: DepositRail;
    successes: number;
    volumeUsd: number;
  }>;
  failures: Array<{
    rail: DepositRail;
    reason: string;
    count: number;
    lastSeen: string;
  }>;
  generatedAt: string;
}

export interface CostsConfig {
  kycSolidUsd?: number;
  kycRainUsd?: number;
  kycWirexUsd?: number;
  cardIssuanceRainUsd?: number;
  inactiveCardWirexUsd?: number;
  internationalTxnRainUsd?: number;
  railFixedRainMonthlyUsd?: number;
  railFixedWirexMonthlyUsd?: number;
  disputeWirexUsd?: number;
  supportPerTicketUsd?: number;
  pointsConversionRateUsd?: number;
}

export interface CostsConfigResponse {
  config: CostsConfig;
  missing: Array<keyof CostsConfig>;
  updatedAt: string | null;
}

/** Cost inputs in display order, with what each one is for. */
export const COST_INPUT_FIELDS: Array<{
  key: keyof CostsConfig;
  label: string;
  hint: string;
}> = [
  {
    key: "kycSolidUsd",
    label: "KYC — Solid (Didit)",
    hint: "Per identity session. Charged even when the user never funds.",
  },
  {
    key: "kycRainUsd",
    label: "KYC — Rain",
    hint: "Per check, from Rain Schedule 2. Reconcile monthly against the invoice.",
  },
  {
    key: "kycWirexUsd",
    label: "KYC — Wirex (Sumsub)",
    hint: "Monthly Sumsub invoice divided by checks in the month.",
  },
  {
    key: "cardIssuanceRainUsd",
    label: "Card issuance — Rain",
    hint: "Per virtual card issued.",
  },
  {
    key: "inactiveCardWirexUsd",
    label: "Inactive card — Wirex",
    hint: "Per inactive card per month. Drives the issue-at-first-deposit decision.",
  },
  {
    key: "internationalTxnRainUsd",
    label: "International txn — Rain",
    hint: "Per international card transaction.",
  },
  {
    key: "railFixedRainMonthlyUsd",
    label: "Rail fixed — Rain",
    hint: "Program base fee per month, allocated across active Rain cards.",
  },
  {
    key: "railFixedWirexMonthlyUsd",
    label: "Rail fixed — Wirex",
    hint: "Platform fee per month, per contract.",
  },
  {
    key: "disputeWirexUsd",
    label: "Dispute — Wirex",
    hint: "Per dispute or chargeback.",
  },
  {
    key: "supportPerTicketUsd",
    label: "Support per ticket",
    hint: "Optional. Off by default; include it only if support cost is in scope.",
  },
  {
    key: "pointsConversionRateUsd",
    label: "Points conversion rate",
    hint: "USD per point. An explicit assumption — there is no market price before TGE.",
  },
];

export const ANALYTICS_QUERY_KEYS = {
  rewardsOwed: ["analytics", "rewards", "owed"] as const,
  rewardsPaid: (query: string) =>
    ["analytics", "rewards", "paid", query] as const,
  referralProgram: (limit: number) =>
    ["analytics", "rewards", "referrals", limit] as const,
  depositRails: (query: string) =>
    ["analytics", "funnel", "rails", query] as const,
  costsConfig: ["analytics", "costs-config"] as const,
};

/**
 * Refresh cadence per read.
 *
 * A liability changes when a payout sweep runs, not continuously, so polling it
 * harder than the sweep only adds load. Config barely changes at all.
 */
export const ANALYTICS_REFRESH_INTERVALS = {
  rewardsOwed: 5 * 60 * 1000,
  rewardsPaid: 5 * 60 * 1000,
  referralProgram: 10 * 60 * 1000,
  depositRails: 5 * 60 * 1000,
  costsConfig: 30 * 60 * 1000,
};
