/**
 * Card tab response types.
 *
 * Mirrors `libs/common/src/types/card-analytics.types.ts` in solid-backend,
 * hand-kept like the other analytics types — the backend file is the
 * authority, so a change there needs the same change here.
 */
import type { SeriesMeta } from "@/types/analytics";

export type CardRail = "rain" | "wirex" | "legacy";
export type CardRevenueProvider = "rain" | "wirex";

export const RAIL_LABELS: Record<CardRail, string> = {
  rain: "Rain",
  wirex: "Wirex",
  legacy: "Legacy (Bridge)",
};

/** Series colours per rail, fixed so a filter never repaints a series. */
export const RAIL_COLORS: Record<CardRail, string> = {
  rain: "#4f46e5", // indigo-600
  wirex: "#d97706", // amber-600
  legacy: "#0891b2", // cyan-600
};

export interface CardRailActivity {
  rail: CardRail;
  settledSpendUsd: number;
  purchaseCount: number;
  pendingSpendUsd: number;
  pendingCount: number;
  refundUsd: number;
  refundCount: number;
  activeCards: number;
  averageTicketUsd: number | null;
  foreignSpendUsd: number;
  foreignPurchaseCount: number;
  declineCount: number;
  attemptCount: number;
  declineRate: number | null;
}

export interface CardSpendingResponse {
  rails: CardRailActivity[];
  totals: Omit<CardRailActivity, "rail">;
  byDay: Array<{
    date: string;
    rail: CardRail;
    settledSpendUsd: number;
    purchaseCount: number;
    foreignSpendUsd: number;
    declineCount: number;
  }>;
  topCategories: Array<{ category: string; settledSpendUsd: number; purchaseCount: number }>;
  topCountries: Array<{ country: string; settledSpendUsd: number; purchaseCount: number }>;
  topCurrencies: Array<{ currency: string; settledSpendUsd: number; purchaseCount: number }>;
  declineReasons: Array<{ rail: CardRail; reason: string; count: number; lastSeen: string }>;
  topDeclinedMerchants: Array<{
    merchant: string;
    rail: CardRail;
    count: number;
    declinedUsd: number;
  }>;
  meta: SeriesMeta;
  generatedAt: string;
}

export interface CardIssuanceRail {
  rail: CardRail;
  issued: number;
  issuedAndUsed: number;
  activationRate: number | null;
  medianDaysToFirstSpend: number | null;
  book: {
    total: number;
    active: number;
    frozen: number;
    inactive: number;
    pending: number;
  };
}

export interface CardIssuanceResponse {
  rails: CardIssuanceRail[];
  byDay: Array<{ date: string; rail: CardRail; issued: number }>;
  meta: SeriesMeta;
  generatedAt: string;
}

export type CardPayoutStatus =
  | "accruing"
  | "awaiting_report"
  | "awaiting_payout"
  | "overdue"
  | "received"
  | "received_variance"
  | "nothing_owed";

export type ReportAmountUnit = "usd" | "cents" | "micro_usd";

export interface CardProviderReportSummary {
  reportMonth: string;
  fetchedAt: string;
  rowCount: number;
  spendCount: number;
  settledSpendUsd: number;
  fxFeesUsd: number | null;
  interchangeUsd: number | null;
  crossBorderFeesUsd: number | null;
  internationalCount: number;
  units: {
    settlement: ReportAmountUnit;
    foreignExchangeFees: ReportAmountUnit | null;
    interchange: ReportAmountUnit | null;
    crossBorderFees: ReportAmountUnit | null;
  };
}

export interface CardReportReconciliation {
  reportCount: number;
  ledgerCount: number;
  matched: number;
  onlyInReport: number;
  onlyInLedger: number;
  reportSettledUsd: number;
  ledgerSettledUsd: number;
  differenceUsd: number;
  sampleOnlyInReport: string[];
  sampleOnlyInLedger: string[];
}

export interface CardPayoutRecord {
  amountUsd: number;
  receivedAt: string;
  reference?: string;
  note?: string;
  recordedBy?: string;
  recordedAt: string;
}

export interface CardRevenueMonth {
  billingMonth: string;
  provider: CardRevenueProvider;
  settledSpendUsd: number;
  foreignSpendUsd: number;
  foreignPurchaseCount: number;
  fxRate: number;
  fxRateAssumed: boolean;
  estimatedFxUsd: number;
  report: CardProviderReportSummary | null;
  reconciliation: CardReportReconciliation | null;
  expectedPayoutUsd: number;
  expectedBasis: "reported" | "estimated";
  payoutDueBy: string;
  payout: CardPayoutRecord | null;
  varianceUsd: number | null;
  status: CardPayoutStatus;
}

export interface CardRevenueResponse {
  months: CardRevenueMonth[];
  ownFees: Array<{
    month: string;
    provider: CardRevenueProvider;
    product: string;
    feeUsd: number;
    count: number;
  }>;
  totals: {
    reportedFxUsd: number;
    expectedFxUsd: number;
    receivedUsd: number;
    outstandingUsd: number;
  };
  assumptions: {
    rainFxRate: number;
    wirexFxRate: number;
    rainFxRateAssumed: boolean;
    wirexFxRateAssumed: boolean;
  };
  meta: SeriesMeta;
  generatedAt: string;
}

export interface CardCostLine {
  key: string;
  label: string;
  quantity: number;
  unitUsd: number | null;
  usd: number | null;
  missingInput?: string;
}

export interface CardRailEconomics {
  rail: CardRevenueProvider;
  settledSpendUsd: number;
  activeCards: number;
  revenue: {
    fxPayoutUsd: number;
    fxBasis: "reported" | "estimated" | "mixed";
    ownFeesUsd: number;
    totalUsd: number;
  };
  costs: CardCostLine[];
  knownCostUsd: number;
  costsIncomplete: boolean;
  contributionUsd: number;
  revenuePerActiveCardUsd: number | null;
  costPerActiveCardUsd: number | null;
  revenueBpsOfSpend: number | null;
}

export interface CardEconomicsResponse {
  rails: CardRailEconomics[];
  missingInputs: string[];
  generatedAt: string;
}

export interface RecordCardPayoutInput {
  provider: CardRevenueProvider;
  billingMonth: string;
  amountUsd: number;
  receivedAt: string;
  reference?: string;
  note?: string;
}

export interface RefreshRainReportResult {
  reportMonth: string;
  billingMonth: string;
  status: "fetched" | "not_available" | "failed";
  rowCount?: number;
  fxFeesUsd?: number | null;
  error?: string;
}

export const CARD_QUERY_KEYS = {
  all: ["analytics", "card"] as const,
  spending: (query: string) => ["analytics", "card", "spending", query] as const,
  issuance: (query: string) => ["analytics", "card", "issuance", query] as const,
  revenue: (months: number) => ["analytics", "card", "revenue", months] as const,
  economics: (query: string) => ["analytics", "card", "economics", query] as const,
};

/** Spend moves by the minute; statements and payouts by the day. */
export const CARD_REFRESH_INTERVALS = {
  spending: 5 * 60 * 1000,
  issuance: 10 * 60 * 1000,
  revenue: 15 * 60 * 1000,
  economics: 15 * 60 * 1000,
};
