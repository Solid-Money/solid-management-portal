/**
 * Revenue Dashboard Types
 *
 * TypeScript interfaces for the revenue dashboard API responses and components.
 */

// Revenue breakdown by type
export type RevenueType =
  | 'yield_share'
  | 'borrowing_fee'
  | 'treasury_interest'
  | FeeRevenueType;

/**
 * The revenue lines produced by the per-tier product fee program.
 *
 * Must stay in step with `RevenueType` / `PRODUCT_FEE_REVENUE_TYPES` in the
 * backend's `revenue-event.schema.ts`. A product missing here is not a cosmetic
 * gap: the fee views key their rows off this union, so its fees are dropped from
 * the breakdown without any error, and the total silently disagrees with the
 * ledger.
 *
 * Note `transfi_fee`, not `buy_crypto_fee`: buy-crypto orders run through
 * TransFi and the ledger records the rail, so the backend enum — and therefore
 * the wire format — calls it `transfi_fee`.
 */
export type FeeRevenueType =
  | 'swap_fee'
  | 'fx_fee'
  | 'bank_withdrawal_fee'
  | 'bank_deposit_fee'
  | 'stocks_fee'
  | 'transfi_fee';

export type ReconciliationStatusType = 'pending' | 'verified' | 'discrepancy' | 'resolved';

// Executive Summary Response
export interface ExecutiveSummaryResponse {
  totalRevenue: {
    value: string;
    change: string;
  };
  monthOverMonth: {
    value: string;
    trend: 'up' | 'down' | 'flat';
  };
  revenuePerUser: {
    value: string;
    change: string;
  };
  activeUsers: {
    value: string;
    change: string;
  };
  sparklineData: number[];
}

// Revenue Summary Query/Response
export interface RevenueSummaryQuery {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
}

export interface RevenuePeriodData {
  period: string;
  yieldShare: number;
  borrowingFees: number;
  treasuryInterest: number;
  total: number;
}

export interface RevenueSummaryResponse {
  periods: RevenuePeriodData[];
  totals: {
    yieldShare: number;
    borrowingFees: number;
    treasuryInterest: number;
    total: number;
  };
  comparison: {
    previousPeriodTotal: number;
    changePercent: number;
  };
}

// Finance Detail Response
export interface FinanceDailyBreakdown {
  date: string;
  yieldShare: {
    gross: string;
    fees: string;
    net: string;
  };
  total: string;
  reconciliationStatus: ReconciliationStatusType;
  lastVerified?: string;
}

export interface FinanceDetailResponse {
  dailyBreakdown: FinanceDailyBreakdown[];
  adjustments: Array<{
    date: string;
    type: string;
    amount: string;
    reason: string;
  }>;
}

// User Revenue Response
export interface UserRevenueData {
  userId: string;
  username?: string;
  email?: string;
  totalRevenue: number;
  yieldShare: number;
  revenueEvents: number;
  lastActivityDate?: string;
}

export interface PaginatedUserRevenueResponse {
  data: UserRevenueData[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Product Revenue Response
export interface ProductRevenue {
  name: string;
  revenue: number;
  users: number;
  trend: string;
  revenueType: RevenueType;
}

export interface ProductRevenueResponse {
  products: ProductRevenue[];
  totalRevenue: number;
}

// Investor Report Response
export interface InvestorReportResponse {
  month: string;
  summary: {
    totalRevenue: string;
    growth: {
      mom: string;
      yoy: string;
    };
    revenuePerUser: string;
  };
  unitEconomics: {
    ltv: string;
    cac: string;
    ltvCacRatio: string;
    paybackMonths: number;
  };
  chartData: Array<{
    date: string;
    revenue: number;
  }>;
}

// Dashboard View Types
export type DashboardView =
  | 'executive'
  | 'finance'
  | 'product-fees'
  | 'fees-yields'
  | 'analytics'
  | 'operations'
  | 'investor';

// Export Formats
export type ExportFormat = 'csv' | 'pdf' | 'xlsx';

// API Query Keys
export const REVENUE_QUERY_KEYS = {
  executiveSummary: ['revenue', 'executive-summary'],
  summary: (filters: RevenueSummaryQuery) => ['revenue', 'summary', filters],
  financeDetail: (start: string, end: string) => ['revenue', 'finance', start, end],
  dailyFlow: (start: string, end: string) => ['revenue', 'daily-flow', start, end],
  byUser: (page: number, limit: number) => ['revenue', 'users', page, limit],
  byProduct: (start: string, end: string) => ['revenue', 'products', start, end],
  investorReport: (month: string) => ['revenue', 'investor', month],
  treasuryInterest: (start: string, end: string) => ['revenue', 'treasury-interest', start, end],
} as const;

// Refresh Intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  executiveSummary: 5 * 60 * 1000,  // 5 minutes
  financeDetail: 15 * 60 * 1000,    // 15 minutes
  dailyFlow: 5 * 60 * 1000,         // 5 minutes
  operationsView: 10 * 60 * 1000,   // 10 minutes
  investorReport: 30 * 60 * 1000,   // 30 minutes
} as const;

// Chart Colors
export const REVENUE_COLORS = {
  yieldShare: '#6366f1',         // indigo-500
  borrowingFees: '#8b5cf6',     // violet-500
  treasuryInterest: '#10b981',  // emerald-500
  total: '#3b82f6',             // blue-500
} as const;

// Daily Flow Types (Deposits vs Withdrawals)
export interface DailyFlowData {
  date: string;        // YYYY-MM-DD
  deposits: number;    // USD
  withdrawals: number; // USD (positive number)
  netFlow: number;     // deposits - withdrawals (can be negative)
}

export interface DailyFlowResponse {
  dailyFlow: DailyFlowData[];
  totals: {
    totalDeposits: number;
    totalWithdrawals: number;
    netChange: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

// Daily Flow Chart Colors
export const DAILY_FLOW_COLORS = {
  deposits: '#10B981',    // emerald-500 (green)
  withdrawals: '#EF4444', // red-500
  netFlow: '#6366F1',     // indigo-500 (purple line)
} as const;

// Treasury Interest Types
export interface TreasuryInterestPeriodData {
  period: string;
  treasuryInterest: number;
  eventCount: number;
}

export interface TreasuryInterestResponse {
  periods: TreasuryInterestPeriodData[];
  totals: {
    treasuryInterest: number;
    eventCount: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

// ============================================
// Product Fee Revenue
// ============================================

/** One product's row in the fee revenue table. */
export interface FeeRevenueProductRow {
  revenueType: FeeRevenueType;
  /** Display name, e.g. 'FX conversion'. */
  name: string;
  revenue: number;
  feeCount: number;
  userCount: number;
  previousRevenue: number;
  /**
   * Change against the previous equal-length window, as a percentage.
   *
   * Null when the previous window earned nothing — the first period after a fee
   * is switched on has no baseline, and both "+∞%" and "0%" misrepresent that.
   */
  changePercent: number | null;
}

/** One bucket of the fee revenue growth series. */
export interface FeeRevenueGrowthPoint {
  /** 'YYYY-MM-DD' | 'YYYY-Www' | 'YYYY-MM', per the requested grouping. */
  period: string;
  total: number;
  /** Running total across the series, so chart and totals can't disagree. */
  cumulative: number;
  feeCount: number;
  /** Revenue per revenue type in this bucket, zero-filled. */
  byProduct: Record<string, number>;
}

export interface FeeRevenueOverviewResponse {
  products: FeeRevenueProductRow[];
  totals: {
    revenue: number;
    feeCount: number;
    previousRevenue: number;
    changePercent: number | null;
  };
  growth: FeeRevenueGrowthPoint[];
  period: {
    startDate: string;
    endDate: string;
    groupBy: FeeRevenueGroupBy;
  };
}

export type FeeRevenueGroupBy = 'day' | 'week' | 'month';

/** One charged fee, as an expanded product row shows it. */
export interface FeeRevenueRow {
  eventId: string;
  userId?: string;
  /** Which rail carried it: 'rain' | 'wirex' | 'bank' | 'onchain'. */
  rail?: string;
  /** 'Charge' when billed through a provider, 'Collected' when taken at source. */
  settlement?: string;
  /** Tier the fee was rated at — not the tier the user holds now. */
  tierName?: string;
  percentage?: number;
  baseAmountUsd?: string;
  feeAmountUsd: string;
  foreignCurrency?: string;
  description?: string;
  sourceId?: string;
  transactionHash?: string;
  chargedAt?: string;
}

export interface FeeRevenueDetailResponse {
  revenueType: FeeRevenueType;
  name: string;
  fees: FeeRevenueRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Series colors for the fee products, in fixed assignment order.
 *
 * Validated for colorblind separation against the dashboard's white surface:
 * adjacent-pair ΔE 10.2 at worst under deuteranopia, 17.6 under tritanopia,
 * 25.6 for normal vision. Colour follows the product, never its rank, so
 * filtering or re-sorting the table never repaints a series.
 *
 * Amber sits below 3:1 against white on its own, which is why the legend is
 * always shown and the table below carries every number — the chart is never
 * the only way to read a value.
 */
export const FEE_REVENUE_COLORS: Record<FeeRevenueType, string> = {
  swap_fee: '#6366f1', // indigo-500
  fx_fee: '#f59e0b', // amber-500
  bank_withdrawal_fee: '#e11d48', // rose-600
  bank_deposit_fee: '#0d9488', // teal-600
  transfi_fee: '#7c3aed', // violet-600
  stocks_fee: '#0284c7', // sky-600
};

/**
 * Fee products in the order the app's own fee table lists them.
 *
 * Every product in the backend's `PRODUCT_FEE_REVENUE_TYPES` appears here, even
 * one configured but currently disabled: a product with no charges renders as a
 * zero row, which is how an operator sees that a fee they switched on is not
 * being collected. Omitting it would make "no revenue" and "not tracked" look
 * identical.
 */
export const FEE_REVENUE_TYPES: FeeRevenueType[] = [
  'bank_deposit_fee',
  'swap_fee',
  'fx_fee',
  'bank_withdrawal_fee',
  'transfi_fee',
  'stocks_fee',
];

export const FEE_REVENUE_QUERY_KEYS = {
  overview: (start: string, end: string, groupBy: string) => [
    'revenue',
    'fees',
    start,
    end,
    groupBy,
  ],
  detail: (revenueType: string, start: string, end: string, page: number) => [
    'revenue',
    'fees',
    'detail',
    revenueType,
    start,
    end,
    page,
  ],
} as const;
