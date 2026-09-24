/** Mirrors DepositFeeRoute in solid-backend (libs/common deposit-fee.constants). */
export type DepositFeeRoute =
  | "rain_card"
  | "wirex_card"
  | "savings_deposit_address"
  | "savings_safe_move";

export interface DepositFeeCell {
  chainId: number;
  locked: boolean;
  lockedReason?: "home_chain" | "same_chain";
  /** Parts per million: 0.03% = 300. */
  ratePpm: number;
  source: "custom" | "default" | "locked";
  updatedByEmail?: string;
  updatedAt?: string;
}

export interface DepositFeeMatrix {
  version: number;
  defaultRatePpm: number;
  maxRatePpm: number;
  warnRatePpm: number;
  chains: number[];
  routes: {
    route: DepositFeeRoute;
    label: string;
    description: string;
    cells: DepositFeeCell[];
  }[];
  switches: { program: boolean; cardLine: boolean; savingsLine: boolean };
  effectiveAt: string | null;
  /** Whether the signed-in admin may save rates (DEPOSIT_FEE_ADMIN_EMAILS). */
  canEdit: boolean;
}

export interface DepositFeeChange {
  route: DepositFeeRoute;
  chainId: number;
  /** null resets the cell to the default. */
  ratePpm: number | null;
}

export interface DepositFeeHistoryRow {
  _id: string;
  route: DepositFeeRoute;
  chainId: number;
  previousRatePpm: number | null;
  newRatePpm: number | null;
  adminEmail: string;
  note?: string;
  createdAt: string;
}

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
  56: "BNB Chain",
  122: "Fuse",
};
