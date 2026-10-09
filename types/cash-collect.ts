/**
 * A card spend Wirex paid for that we never swept from the cardholder's Safe.
 *
 * Mirrors `AdminUncollectedSettlement` in accounts-service. Either the sweep
 * failed (arrears), or we refused a mandatory payment at settle and Wirex
 * debited its Master Account anyway. Nothing automatic will ever collect it.
 */
export interface UncollectedSettlement {
  uniqueOperationId: string;
  transactionId?: string;
  chainId: number;
  amountMicroUsd: string;
  amountUsd: number;
  cause: "ARREARS" | "REFUSED_MANDATORY";
  explanation: string;
  status?: string;
  transactionReason?: string;
  merchantAmount?: string;
  merchantCurrency?: string;
  mcc?: string;
  createdAt?: string;
  mandatory: boolean;
  /** Refunds on the same transaction our payout cron already paid the user. */
  refundsPaidUsd: number;
  /** Present when this panel cannot collect it, with the reason. */
  unsupportedReason?: string;
}

export interface UncollectedSettlements {
  userId: string;
  safeAddress?: string;
  settlements: UncollectedSettlement[];
  totalUsd: number;
  /** What the Safe can cover right now. Absent when the chain could not be read. */
  spendableUsd?: number;
  moduleEnabled?: boolean;
}

export interface CollectSettlementRequest {
  reason: string;
  /** Collect despite a shortfall: the sweep then fails into arrears and blocks the card. */
  force?: boolean;
}

export interface CollectSettlementResult {
  started: true;
  uniqueOperationId: string;
  amountUsd: number;
  sweepWorkflowId?: string;
}
