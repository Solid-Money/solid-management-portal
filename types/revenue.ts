/**
 * Revenue Dashboard Types
 *
 * TypeScript interfaces for the revenue dashboard API responses and components.
 */

// Revenue breakdown by type
export type RevenueType = 'yield_share' | 'borrowing_fee';

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
  total: number;
}

export interface RevenueSummaryResponse {
  periods: RevenuePeriodData[];
  totals: {
    yieldShare: number;
    borrowingFees: number;
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
export type DashboardView = 'executive' | 'finance' | 'fees-yields' | 'analytics' | 'operations' | 'investor';

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
  yieldShare: '#6366f1',   // indigo-500
  borrowingFees: '#8b5cf6', // violet-500
  total: '#3b82f6',        // blue-500
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
