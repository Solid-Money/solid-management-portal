/**
 * Analytics Charts Types
 *
 * TypeScript interfaces for advanced analytics charts:
 * - Withdrawal Latency Analysis
 * - Bridge Activity Timeline
 * - Share Premium/Discount Analysis
 * - User Cohort Analysis
 */

// ============================================
// Withdrawal Latency Analysis Types
// ============================================

/**
 * Single withdrawal with latency data
 */
export interface WithdrawalLatencyData {
  id: string;
  creationTime: string;
  solveTimestamp: string;
  latencySeconds: number;
  amountOfAssets: string;
  amountOfShares: string;
}

/**
 * Latency distribution bucket for histogram
 */
export interface LatencyBucket {
  range: string;
  minSeconds: number;
  maxSeconds: number;
  count: number;
  totalAmount: number;
}

/**
 * Response for withdrawal latency analysis endpoint
 */
export interface WithdrawalLatencyResponse {
  withdrawals: WithdrawalLatencyData[];
  distribution: LatencyBucket[];
  summary: {
    totalWithdrawals: number;
    avgLatencySeconds: number;
    medianLatencySeconds: number;
    p95LatencySeconds: number;
    minLatencySeconds: number;
    maxLatencySeconds: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

// ============================================
// Bridge Activity Timeline Types
// ============================================

/**
 * Single bridge event data
 */
export interface BridgeEventData {
  id: string;
  user: string;
  shareAmount: string;
  blockTimestamp: string;
  transactionHash: string;
}

/**
 * Daily aggregated bridge activity
 */
export interface DailyBridgeActivity {
  date: string;
  count: number;
  totalShareAmount: string;
  totalValueUsd: number;
  uniqueUsers: number;
}

/**
 * Response for bridge activity timeline endpoint
 */
export interface BridgeActivityResponse {
  events: BridgeEventData[];
  dailyActivity: DailyBridgeActivity[];
  summary: {
    totalEvents: number;
    totalShareAmount: string;
    totalValueUsd: number;
    uniqueUsers: number;
    avgDailyCount: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

// ============================================
// Share Premium/Discount Analysis Types
// ============================================

/**
 * Single deposit with share ratio data
 */
export interface DepositShareRatioData {
  id: string;
  depositor: string;
  depositAmount: string;
  shareAmount: string;
  exchangeRateAtDeposit: string;
  actualRatio: number;
  premiumPercent: number;
  depositTimestamp: string;
  isBridged: boolean;
}

/**
 * Daily aggregated share premium/discount data
 */
export interface DailySharePremium {
  date: string;
  avgPremiumPercent: number;
  depositCount: number;
  totalDepositAmount: number;
  avgExchangeRate: string;
}

/**
 * Response for share premium/discount analysis endpoint
 */
export interface SharePremiumResponse {
  deposits: DepositShareRatioData[];
  dailyData: DailySharePremium[];
  summary: {
    totalDeposits: number;
    avgPremiumPercent: number;
    currentExchangeRate: string;
    initialExchangeRate: string;
    exchangeRateGrowth: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

// ============================================
// User Cohort Analysis Types
// ============================================

/**
 * Cohort aggregated data
 */
export interface CohortData {
  cohort: string;
  userCount: number;
  activeUsers: number;
  retentionRate: number;
  totalDeposits: number;
  totalDepositAmount: number;
  avgDepositsPerUser: number;
  avgAmountPerUser: number;
}

/**
 * Cohort retention matrix row
 */
export interface CohortRetentionRow {
  cohort: string;
  month0: number;
  retentionByMonth: {
    [monthOffset: number]: number;
  };
}

/**
 * Response for user cohort analysis endpoint
 */
export interface UserCohortResponse {
  cohorts: CohortData[];
  retentionMatrix: CohortRetentionRow[];
  summary: {
    totalUsers: number;
    avgRetentionRate: number;
    bestCohort: string;
    avgLifetimeDeposits: number;
  };
  period: {
    earliestCohort: string;
    latestCohort: string;
    dataAsOf: string;
  };
}

// ============================================
// Chart Configuration Constants
// ============================================

/**
 * Chart color scheme for analytics charts
 */
export const ANALYTICS_CHART_COLORS = {
  // Withdrawal Latency
  latencyBar: "#6366f1", // indigo-500
  latencyLine: "#8b5cf6", // violet-500

  // Bridge Activity
  bridgeCount: "#10b981", // emerald-500
  bridgeVolume: "#3b82f6", // blue-500

  // Share Premium
  premium: "#22c55e", // green-500
  discount: "#ef4444", // red-500
  neutral: "#6b7280", // gray-500

  // Cohorts
  cohortPrimary: "#6366f1", // indigo-500
  cohortSecondary: "#a855f7", // purple-500
  retention: "#14b8a6", // teal-500
} as const;

/**
 * Query keys for React Query caching
 */
export const ANALYTICS_CHARTS_QUERY_KEYS = {
  withdrawalLatency: (start: string, end: string) =>
    ["withdrawal-latency", start, end] as const,
  bridgeActivity: (start: string, end: string) =>
    ["bridge-activity", start, end] as const,
  sharePremium: (start: string, end: string) =>
    ["share-premium", start, end] as const,
  userCohorts: (start: string, end: string) =>
    ["user-cohorts", start, end] as const,
} as const;

/**
 * Refresh intervals for analytics charts (in milliseconds)
 */
export const ANALYTICS_CHARTS_REFRESH_INTERVALS = {
  withdrawalLatency: 5 * 60 * 1000, // 5 minutes
  bridgeActivity: 5 * 60 * 1000, // 5 minutes
  sharePremium: 10 * 60 * 1000, // 10 minutes
  userCohorts: 30 * 60 * 1000, // 30 minutes
} as const;

/**
 * Utility to format latency in human-readable format
 */
export function formatLatency(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

/**
 * Utility to format share amounts
 */
export function formatShareAmount(amount: string, decimals = 6): string {
  const value = Number(BigInt(amount)) / 10 ** decimals;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
