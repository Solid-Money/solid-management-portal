/**
 * Yield Metrics Types
 *
 * TypeScript interfaces for DefiLlama-style fee & yield chart data.
 * Mirrors the backend types from @app/common/types/yield-metrics.types.ts
 */

/**
 * Daily yield metrics for a single day
 */
export interface DailyYieldMetrics {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Total yield + platform fee (USD) - DefiLlama dailyFees */
  dailyFees: number;
  /** Performance fee + platform fee (USD) - DefiLlama dailyProtocolRevenue */
  dailyProtocolRevenue: number;
  /** Stakers' yield share (USD) - DefiLlama dailySupplySideRevenue */
  dailySupplySideRevenue: number;
  /** Total Value Locked at end of day (USD) */
  tvl: number;
  /** Vault exchange rate (raw value from contract) */
  exchangeRate: string;
  /** Daily exchange rate growth percentage */
  exchangeRateGrowth: number;
}

/**
 * Response for daily yield metrics endpoint
 */
export interface YieldMetricsResponse {
  metrics: DailyYieldMetrics[];
  totals: {
    totalFees: number;
    totalProtocolRevenue: number;
    totalSupplySideRevenue: number;
    avgTvl: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Fee breakdown showing performance vs platform fees
 */
export interface FeeBreakdownData {
  date: string;
  performanceFee: number;
  platformFee: number;
  totalProtocolFee: number;
}

/**
 * Response for fee breakdown endpoint
 */
export interface FeeBreakdownResponse {
  breakdown: FeeBreakdownData[];
  totals: {
    totalPerformanceFee: number;
    totalPlatformFee: number;
    total: number;
  };
  feeRates: {
    performanceFeeRate: number;
    platformFeeRate: number;
  };
}

/**
 * Single exchange rate update event
 */
export interface ExchangeRateHistoryData {
  timestamp: string;
  exchangeRate: string;
  oldExchangeRate: string;
  growthRate: number;
  blockNumber: string;
  transactionHash: string;
}

/**
 * Response for exchange rate history endpoint
 */
export interface ExchangeRateHistoryResponse {
  history: ExchangeRateHistoryData[];
  summary: {
    startRate: string;
    endRate: string;
    totalGrowth: number;
    avgDailyGrowth: number;
  };
}

/**
 * TVL vs Yield correlation data point
 */
export interface TvlYieldCorrelationData {
  date: string;
  tvl: number;
  yieldRate: number;
  dailyYield: number;
}

/**
 * Response for TVL vs Yield correlation endpoint
 */
export interface TvlYieldCorrelationResponse {
  data: TvlYieldCorrelationData[];
  stats: {
    correlation: number;
    avgTvl: number;
    avgYieldRate: number;
  };
}

/**
 * Current fee configuration
 */
export interface FeeConfigurationResponse {
  performanceFeeRate: number;
  platformFeeRate: number;
  vaultRateBase: string;
  lastUpdated: string;
}

/**
 * Query keys for React Query caching
 */
export const YIELD_METRICS_QUERY_KEYS = {
  yieldMetrics: (start: string, end: string) =>
    ["yield-metrics", start, end] as const,
  feeBreakdown: (start: string, end: string) =>
    ["fee-breakdown", start, end] as const,
  exchangeRateHistory: (start: string, end: string) =>
    ["exchange-rate-history", start, end] as const,
  tvlYieldCorrelation: (start: string, end: string) =>
    ["tvl-yield-correlation", start, end] as const,
  feeConfiguration: ["fee-configuration"] as const,
} as const;

/**
 * Refresh intervals for yield metrics data (in milliseconds)
 */
export const YIELD_METRICS_REFRESH_INTERVALS = {
  yieldMetrics: 5 * 60 * 1000, // 5 minutes
  feeBreakdown: 5 * 60 * 1000, // 5 minutes
  exchangeRateHistory: 10 * 60 * 1000, // 10 minutes
  tvlYieldCorrelation: 5 * 60 * 1000, // 5 minutes
  feeConfiguration: 30 * 60 * 1000, // 30 minutes
} as const;

/**
 * Chart color scheme for yield metrics visualization
 */
export const YIELD_CHART_COLORS = {
  dailyFees: "#6366f1", // indigo-500
  protocolRevenue: "#8b5cf6", // violet-500
  supplySideRevenue: "#10b981", // emerald-500
  performanceFee: "#f59e0b", // amber-500
  platformFee: "#3b82f6", // blue-500
  tvl: "#6b7280", // gray-500
  exchangeRate: "#14b8a6", // teal-500
  yieldRate: "#ec4899", // pink-500
} as const;
