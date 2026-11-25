/**
 * Growth → KOLs, as `admins-service`'s `AdminKolsController` serves it
 * (`/admin/v1/kols`), from accounts-service's `KolAdminService`.
 *
 * A KOL is a Solid user the growth team works with. A perk is a campaign offer
 * with its own referral code: a friend who signs up with it is referred by the
 * KOL — exactly as with the KOL's own code — and is granted the perk's
 * benefits while it runs.
 */

export type KolStatus = "active" | "removed";

export type KolPerkStatus =
  | "unattached"
  | "disabled"
  | "scheduled"
  | "live"
  | "ended"
  | "full"
  | "kol_removed";

export interface KolStats {
  /** Every user the KOL has referred, by any code. */
  referrals: number;
  /** Of those, referred since the KOL was added. */
  referralsSinceAdded: number;
  /** Signups through the KOL's perk codes that were granted a perk. */
  perkSignups: number;
}

export interface Kol {
  id: string;
  userId: string;
  username: string;
  email?: string;
  /** The KOL's own referral code. */
  referralCode: string;
  status: KolStatus;
  note?: string;
  addedAt: string;
  addedByEmail: string;
  removedAt?: string;
  removedByEmail?: string;
  /** Sent back with a save; a stale one is refused with 409. */
  version: number;
  perkIds: string[];
  stats: KolStats;
}

export interface KolPerkStats {
  granted: number;
  ineligible: number;
  tierDiscountsClaimed: number;
  tierDiscountsPaid: number;
  sepaDeposits: number;
  sepaCoveredUsd: number;
  sepaWaivedFeeUsd: number;
}

export interface KolPerk {
  id: string;
  name: string;
  /** The special referral code, upper case. */
  code: string;
  kolId: string | null;
  kolUsername: string | null;
  attachedAt?: string;
  enabled: boolean;
  status: KolPerkStatus;
  /** Signups in [startsAt, endsAt) get the perk. */
  startsAt: string;
  endsAt: string;
  /** Off the first year of the first paid membership. 0 = none. */
  tierDiscountPct: number;
  /** Months of free SEPA deposits from signing up. 0 = none. */
  sepaFreeMonths: number;
  /** The most deposit volume, in USD, those months make free for one user. */
  sepaFreeCapUsd: number;
  maxSignups: number | null;
  createdByEmail?: string;
  updatedByEmail?: string;
  updatedAt?: string;
  version: number;
  stats: KolPerkStats;
}

export interface KolLimits {
  maxTierDiscountPct: number;
  maxSepaFreeMonths: number;
  maxSepaFreeCapUsd: number;
  maxSignups: number;
  maxDays: number;
  codeMinLength: number;
  codeMaxLength: number;
  lateAddDays: number;
}

export interface KolsOverview {
  kols: Kol[];
  perks: KolPerk[];
  limits: KolLimits;
}

export type KolPerkGrantSource = "signup" | "add_referrer";
export type KolPerkGrantStatus = "granted" | "ineligible";
export type KolPerkIneligibleReason =
  | "disabled"
  | "not_started"
  | "ended"
  | "kol_removed"
  | "signup_limit"
  | "late_add";

export interface KolPerkGrant {
  id: string;
  userId: string;
  username: string | null;
  source: KolPerkGrantSource;
  status: KolPerkGrantStatus;
  ineligibleReason: KolPerkIneligibleReason | null;
  grantedAt: string;
  tierDiscountPct: number;
  tierDiscountTier: string | null;
  tierDiscountClaimedAt: string | null;
  tierDiscountFirstYearUsd: string | null;
  sepaFreeUntil: string | null;
  sepaCoveredUsd: number;
  sepaFreeCapUsd: number;
  sepaWaivedFeeUsd: number;
  sepaDepositCount: number;
}

export interface KolPerkGrantList {
  grants: KolPerkGrant[];
  /** More than the 500 shown. */
  truncated: boolean;
}

export interface CreateKolPerkBody {
  name: string;
  /** Leave out to have one generated. */
  code?: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  tierDiscountPct: number;
  sepaFreeMonths: number;
  sepaFreeCapUsd: number;
  maxSignups: number | null;
  kolId?: string;
}

/** Only the fields that changed, plus the version the page loaded. */
export interface UpdateKolPerkBody {
  version: number;
  name?: string;
  code?: string;
  enabled?: boolean;
  startsAt?: string;
  endsAt?: string;
  tierDiscountPct?: number;
  sepaFreeMonths?: number;
  sepaFreeCapUsd?: number;
  /** null clears the limit. */
  maxSignups?: number | null;
}
