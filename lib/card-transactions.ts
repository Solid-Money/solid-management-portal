import {
  CARD_FEE_WAIVE_REASONS,
  CardTransaction,
  CardTransactionCashback,
  CardTransactionFee,
} from "@/types";

/** Badge variant for a card transaction's own status. */
export function cardStatusVariant(
  status?: string
): "success" | "info" | "warning" | "danger" | "muted" {
  switch (status?.toLowerCase()) {
    case "posted":
    case "settled":
      return "success";
    case "authorized":
    case "approved":
      return "info";
    case "pending":
      return "warning";
    case "declined":
    case "denied":
      return "danger";
    default:
      return "muted";
  }
}

/**
 * Badge variant for a cashback status. Covers all nine statuses the backend
 * can produce — an unmapped one used to render in the same neutral grey as
 * "no cashback at all", which reads as "nothing happened" rather than
 * "refunded" or "cancelled".
 */
export function cashbackStatusVariant(
  status?: string
): "success" | "info" | "warning" | "danger" | "muted" {
  switch (status) {
    case "Paid":
    case "DeductedFromDebt":
      return "success";
    case "Escrowed":
      return "info";
    case "Pending":
      return "warning";
    case "Failed":
    case "PermanentlyFailed":
      return "danger";
    case "PartiallyRefunded":
    case "FullyRefunded":
    case "Canceled":
      return "muted";
    default:
      return "muted";
  }
}

/**
 * What a cashback actually paid out, in the asset it was paid in.
 *
 * Cashback moved from native FUSE to soUSD; the table showed only the FUSE
 * field, so every cashback paid since the migration rendered as "—" — the
 * dashboard looked like cashback had stopped being paid.
 */
export function formatCashbackAmount(
  cashback?: CardTransactionCashback
): { amount: string; usd: string | null } | null {
  if (!cashback) return null;

  const soUsd = Number(cashback.soUsdAmount ?? 0);
  if (soUsd > 0) {
    const rate = Number(cashback.soUsdRate ?? 0) || 1;
    return {
      amount: `${soUsd.toFixed(4)} soUSD`,
      usd: `$${(soUsd * rate).toFixed(2)}`,
    };
  }

  const fuse = Number(cashback.fuseAmount ?? 0);
  if (fuse > 0) {
    const price = Number(cashback.fuseUsdPrice ?? 0);
    return {
      amount: `${fuse.toFixed(4)} FUSE`,
      usd: price > 0 ? `$${(fuse * price).toFixed(2)}` : null,
    };
  }

  return null;
}

/** Badge variant for a card fee's status. */
export function cardFeeStatusVariant(
  status?: string
): "success" | "warning" | "danger" | "muted" {
  switch (status) {
    case "Charged":
      return "success";
    case "Pending":
      return "warning";
    case "Failed":
    case "PermanentlyFailed":
      return "danger";
    default:
      return "muted";
  }
}

/** "FX · 0.99% of $42.00 → $0.42", or the reason it was waived. */
export function describeCardFee(fee: CardTransactionFee): string {
  const category = fee.category === "fx" ? "FX" : fee.category;
  const rate = `${(fee.percentage * 100).toFixed(2)}%`;
  const base = `$${Number(fee.baseAmountUsd || 0).toFixed(2)}`;

  if (fee.status === "Waived") {
    const reason = fee.waiveReason
      ? CARD_FEE_WAIVE_REASONS[fee.waiveReason] ?? fee.waiveReason
      : "waived";
    return `${category} waived — ${reason}`;
  }

  return `${category} · ${rate} of ${base} → $${Number(
    fee.feeAmountUsd || 0
  ).toFixed(2)}`;
}

/**
 * The fee total to show next to a spend. Only charged fees count toward what
 * the user actually paid; the backend computes this, but a transaction fetched
 * before that existed falls back to summing here.
 */
export function chargedFeeTotal(tx: CardTransaction): number {
  if (typeof tx.totalFeeUsd === "number") return tx.totalFeeUsd;
  return (tx.fees ?? [])
    .filter((fee) => fee.status === "Charged")
    .reduce((sum, fee) => sum + Number(fee.feeAmountUsd || 0), 0);
}
