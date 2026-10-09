/**
 * One entry of a Safe's card-spend hold store.
 *
 * Mirrors `AdminHoldEntry` in accounts-service. The store is Redis, which
 * support cannot reach. Each entry is something reserved against the
 * cardholder's spending power: a hold Wirex has not cleared yet, a settled
 * debit waiting to be swept, arrears, or a marker a rejected payment left
 * behind.
 */
export interface CardHoldEntry {
  chainId: number;
  /** "Fuse" or "Base". */
  instance: string;
  uniqueOperationId: string;
  /** The exact stored value. Sent back on release, which refuses if it changed. */
  raw: string;
  kind: "HOLD" | "DEBIT" | "SWEEP_PENDING" | "ARREARS" | "REJECTED" | string;
  amountMicroUsd: string;
  amountUsd: number;
  placedAt?: string;
  expiresAt?: string;
  sweepBlockNumber?: number;
  fundingPath?: string;
  transactionId?: string;
  /** Whether this entry currently reduces what the card can spend. */
  countsAgainstSpending: boolean;
  operation?: {
    status?: string;
    transactionReason?: string;
    merchantAmount?: string;
    merchantCurrency?: string;
    createdAt?: string;
    /** False when the payment record was created by Wirex's settle, not our authorize. */
    hasAuthorizeDecision: boolean;
  };
  /** The backend's judgement that nothing will ever clear this entry. */
  stale: boolean;
  explanation: string;
}

export interface CardHolds {
  userId: string;
  safeAddress?: string;
  entries: CardHoldEntry[];
  heldUsd: number;
  staleUsd: number;
}

export interface ReleaseCardHoldRequest {
  chainId: number;
  expectedValue: string;
  reason: string;
  /** Required for anything but a plain HOLD or a rejection marker. */
  force?: boolean;
}

export interface ReleaseCardHoldResult {
  released: true;
  uniqueOperationId: string;
  kind: string;
  amountUsd: number;
}
