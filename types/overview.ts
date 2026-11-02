/**
 * The admin Overview page, `GET /admin/v1/overview`.
 *
 * Mirrors `libs/common/src/types/overview.types.ts` in solid-backend (the
 * composed response only); keep the two in step.
 */

/** A value for the picked range and for the same-length period before it. */
export interface Compared {
  current: number;
  previous: number;
}

/** A ratio or a duration that may not exist (nothing to divide, no samples). */
export interface ComparedNullable {
  current: number | null;
  previous: number | null;
}

export type CardDeclineProvider = "rain" | "wirex";

export interface OverviewFunnelSteps {
  signUps: number;
  gotCard: number;
  firstPurchase: number;
}

/** How money arrives. Chains are the direct-deposit networks; the rest are cash. */
export type MoneyInMethod =
  | "base"
  | "bnb"
  | "arbitrum"
  | "ethereum"
  | "polygon"
  | "fuse"
  | "bank"
  | "transfi";

/** The open queues Support pulse shows, as they stand now. */
export const OVERVIEW_SUPPORT_QUEUES = [
  "needs_human",
  "ai_handling",
  "escalated",
  "waiting_customer",
] as const;
export type OverviewSupportQueue = (typeof OVERVIEW_SUPPORT_QUEUES)[number];

export interface OverviewRange {
  /** First day of the picked range, `YYYY-MM-DD`. */
  from: string;
  /** Last day of the picked range, inclusive. */
  to: string;
  previousFrom: string;
  previousTo: string;
  days: number;
  /** First day the charts draw (at least 30 days before `to`). */
  chartFrom: string;
  /**
   * Last day the charts draw: `to`, or today when the range ends yesterday,
   * so today's partial bar shows after a "Last 7 days" range.
   */
  chartTo: string;
  /** Today in UTC, and whether `to` is today (its numbers are partial). */
  today: string;
  includesToday: boolean;
}

export interface OverviewKpis {
  cardSpend: {
    usd: Compared;
    payments: Compared;
    averageUsd: ComparedNullable;
    /** Daily settled spend for the 14 days ending on `to`. */
    sparkline: number[];
  };
  activeSpenders: { count: Compared; sparkline: number[] };
  signUps: { count: Compared; deleted: Compared; sparkline: number[] };
  revenue: {
    usd: Compared;
    primeUsd: Compared;
    feesUsd: Compared;
    primeCharges: Compared;
    sparkline: number[];
  };
  rewardsCost: {
    usd: Compared;
    /** Rewards cost ÷ revenue for the range, when there is revenue. */
    costToRevenue: number | null;
    sparkline: number[];
  };
  declineRate: {
    rate: ComparedNullable;
    declined: Compared;
    attempts: Compared;
    byProvider: Array<{
      provider: CardDeclineProvider;
      declined: Compared;
      attempts: Compared;
      rate: ComparedNullable;
    }>;
    topReasons: Array<{ reason: string; count: number }>;
    /** Lowest and highest daily declines in the range (full days only). */
    dailyDeclines: { min: number; max: number } | null;
    /** `spike` when a day in the range passed 2× its trailing 14-day median. */
    status: "steady" | "spike";
    spikeDays: string[];
    /** Daily decline rate (0–1) for the 14 days ending on `to`. */
    sparkline: Array<number | null>;
  };
}

export interface OverviewSpendChartDay {
  date: string;
  usd: number;
  payments: number;
  inRange: boolean;
  /** Today: drawn hatched and never compared. */
  partial: boolean;
  /** Why the day is marked, when it is. */
  incident: { reason: "notice" | "spend_drop"; label: string } | null;
}

export interface OverviewSpendDaily {
  days: OverviewSpendChartDay[];
  /** The range's best full day, and the last earlier day that beat it. */
  bestDay: { date: string; usd: number; bestSince: string | null } | null;
}

export interface OverviewNewUsers {
  current: OverviewFunnelSteps;
  previous: OverviewFunnelSteps;
  /** The step that lost the most people this period. */
  biggestDrop: { step: "gotCard" | "firstPurchase"; stopped: number } | null;
}

export type MoneyInMethodGroup = "crypto" | "cash";

export interface OverviewMoneyInMethod {
  method: MoneyInMethod;
  label: string;
  group: MoneyInMethodGroup;
  usd: Compared;
  count: Compared;
  /** Change in USD against the previous period; null unless both had deposits. */
  change: number | null;
}

export interface OverviewMoneyInDay {
  date: string;
  inRange: boolean;
  partial: boolean;
  totalUsd: number;
  count: number;
  byMethod: Partial<Record<MoneyInMethod, { usd: number; count: number }>>;
}

/** A run of days where a normally active method wrote no rows. */
export interface OverviewMoneyInGap {
  method: MoneyInMethod;
  /** First and last empty day, inclusive. */
  from: string;
  to: string;
}

/**
 * One sentence about deposits, written by Solid AI at most once an hour and
 * shown only when every number in it matches the card's data.
 */
export interface OverviewInsight {
  /** The bold opening, e.g. "Most money comes in through Base." */
  lead: string;
  text: string;
}

export interface OverviewMoneyIn {
  total: Compared;
  deposits: Compared;
  methods: OverviewMoneyInMethod[];
  daily: OverviewMoneyInDay[];
  gaps: OverviewMoneyInGap[];
  underTenToWallet: Compared;
  refunded: Compared;
  /** Absent until insights are on; hidden when empty. */
  insights?: OverviewInsight[];
}

export interface OverviewSupport {
  newCases: Compared;
  open: Record<OverviewSupportQueue, number>;
  solvedAlone: Compared;
  solvedAloneRate: ComparedNullable;
  firstReplyMedianSeconds: ComparedNullable;
  topIntents: Array<{ intent: string; count: number }>;
  withoutIntent: Compared;
}

export interface OverviewResponse {
  range: OverviewRange;
  kpis: OverviewKpis;
  spendDaily: OverviewSpendDaily;
  newUsers: OverviewNewUsers;
  moneyIn: OverviewMoneyIn;
  support: OverviewSupport;
  generatedAt: string;
}

/** The page refreshes every five minutes, the backend's cache. */
export const OVERVIEW_REFRESH_MS = 5 * 60_000;

export const OVERVIEW_QUERY_KEYS = {
  all: ["overview"] as const,
  range: (from: string, to: string) => ["overview", from, to] as const,
};
