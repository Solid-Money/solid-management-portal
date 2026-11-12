/**
 * Mirrors the fee promotion API in solid-backend:
 * `apps/flash-admins-service/src/admin-fee-promotions` (HTTP) and
 * `apps/flash-accounts-service/src/product-fees/fee-promotions` (records).
 */

/** Mirrors FeePromotionScope in libs/common fee-promotion.constants. */
export type FeePromotionScope = "eur_bank_deposit";

/** Derived by the backend from the switch and the window. */
export type FeePromotionStatus = "disabled" | "scheduled" | "live" | "ended";

export interface FeePromotionStats {
  /** Fees waived so far. */
  redemptions: number;
  /** Users who had at least one fee waived. */
  users: number;
  /** What those fees would have been, in USD. */
  waivedFeeUsd: number;
  /** What the waived deposits were worth, in USD. */
  baseAmountUsd: number;
}

export interface FeePromotion {
  id: string;
  name: string;
  scope: FeePromotionScope;
  scopeLabel: string;
  scopeDescription: string;
  product: string;
  currency: string;
  enabled: boolean;
  /** ISO 8601. The window is [startsAt, endsAt). */
  startsAt: string;
  endsAt: string;
  freeCountPerUser: number;
  /** Sent back on every change; a stale one is refused with 409. */
  version: number;
  status: FeePromotionStatus;
  createdByEmail?: string;
  updatedByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  stats: FeePromotionStats;
}

/**
 * What a create or update answers with. `stats` is null when the save went
 * through but its totals could not be read; the list reload reads them again.
 */
export interface SavedFeePromotion extends Omit<FeePromotion, "stats"> {
  stats: FeePromotionStats | null;
}

export interface FeePromotionScopeOption {
  scope: FeePromotionScope;
  label: string;
  description: string;
  product: string;
  currency: string;
}

export interface FeePromotionList {
  promotions: FeePromotion[];
  scopes: FeePromotionScopeOption[];
  limits: { maxFreeCountPerUser: number; maxDays: number };
  /** Whether this admin is in DEPOSIT_FEE_ADMIN_EMAILS. */
  canEdit: boolean;
}

/** POST /admin/v1/fee-promotions */
export interface CreateFeePromotionBody {
  name: string;
  scope: FeePromotionScope;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  freeCountPerUser: number;
}

/** PATCH /admin/v1/fee-promotions/:id */
export interface UpdateFeePromotionBody {
  version: number;
  name?: string;
  enabled?: boolean;
  startsAt?: string;
  endsAt?: string;
  freeCountPerUser?: number;
}
