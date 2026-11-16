import { formatEur, formatUsd, getExplorerTxUrl } from "@/lib/utils";
import {
  CARD_FEE_WAIVE_REASONS,
  CardTransaction,
  CardTransactionCashback,
  CardTransactionFee,
  CashbackCurrency,
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
    case "Ineligible":
      return "muted";
    default:
      return "muted";
  }
}

/**
 * The currency a cashback row is earned, capped and paid in. Absent — every
 * row written before euro cashback — or anything unrecognised reads as USD,
 * the same rule the backend applies.
 */
export function cashbackCurrencyOf(
  row?: { currency?: string | null } | null
): CashbackCurrency {
  return row?.currency === "EUR" ? "EUR" : "USD";
}

/**
 * Money on a cashback row, in the row's own currency: `$1.20` on a USD row,
 * `€1.20` on a EUR row. Never converts between the two.
 */
export function formatCashbackMoney(
  value: number,
  currency: CashbackCurrency
): string {
  return currency === "EUR" ? formatEur(value) : formatUsd(value);
}

/**
 * Per-currency amounts side by side, never summed — "$150.00 + €12.40".
 *
 * A side that is zero is left out, so a dollar-only figure reads exactly as
 * it did before euro cashback, and a euro-only one shows no "$0.00 +".
 */
export function formatCashbackTotals(usd: number, eur: number): string {
  if (!eur) return formatUsd(usd);
  if (!usd) return formatCashbackMoney(eur, "EUR");

  return `${formatUsd(usd)} + ${formatCashbackMoney(eur, "EUR")}`;
}

/**
 * Adds up a figure over cashback rows, keeping each currency's sum apart — the
 * only safe way to total rows that may be dollars or euros.
 */
export function sumByCashbackCurrency<T extends { currency?: string | null }>(
  rows: T[],
  amountOf: (row: T) => number | null | undefined
): { usd: number; eur: number } {
  return rows.reduce(
    (totals, row) => {
      const amount = amountOf(row) ?? 0;
      if (cashbackCurrencyOf(row) === "EUR") totals.eur += amount;
      else totals.usd += amount;
      return totals;
    },
    { usd: 0, eur: 0 }
  );
}

/** The payout fields `formatCashbackAmount` reads; shared by every cashback row shape. */
type CashbackPayoutFields = Pick<
  CardTransactionCashback,
  | "currency"
  | "soUsdAmount"
  | "soUsdRate"
  | "fuseAmount"
  | "fuseUsdPrice"
  | "soEurAmount"
  | "sentSoEurAmount"
  | "soEurRate"
>;

/**
 * What a cashback actually paid out, in the asset it was paid in, and what
 * that was worth in the row's own currency.
 *
 * Cashback moved from native FUSE to soUSD; the table showed only the FUSE
 * field, so every cashback paid since the migration rendered as "—" — the
 * dashboard looked like cashback had stopped being paid. A EUR row pays in
 * soEUR, worth `shares * soEurRate` euros — never shown in dollars.
 *
 * A EUR row's shares are `sentSoEurAmount`, what the transfer actually moved —
 * `soEurAmount` is the payout before debt collection and refunds rewrote it —
 * falling back to `soEurAmount` only when no sent figure was stored. A stored
 * sent figure of zero is shown as zero, not skipped.
 */
export function formatCashbackAmount(
  cashback?: CashbackPayoutFields
): { amount: string; value: string | null } | null {
  if (!cashback) return null;

  if (cashbackCurrencyOf(cashback) === "EUR") {
    const sent = cashback.sentSoEurAmount;
    const hasSent = sent !== undefined && sent !== null && sent !== "";
    const soEur = Number(hasSent ? sent : (cashback.soEurAmount ?? 0));
    if (!Number.isFinite(soEur) || soEur < 0) return null;
    if (!hasSent && !(soEur > 0)) return null;

    const rate = Number(cashback.soEurRate ?? 0);
    return {
      amount: `${soEur.toFixed(4)} soEUR`,
      value: rate > 0 ? formatCashbackMoney(soEur * rate, "EUR") : null,
    };
  }

  const soUsd = Number(cashback.soUsdAmount ?? 0);
  if (soUsd > 0) {
    const rate = Number(cashback.soUsdRate ?? 0) || 1;
    return {
      amount: `${soUsd.toFixed(4)} soUSD`,
      value: `$${(soUsd * rate).toFixed(2)}`,
    };
  }

  const fuse = Number(cashback.fuseAmount ?? 0);
  if (fuse > 0) {
    const price = Number(cashback.fuseUsdPrice ?? 0);
    return {
      amount: `${fuse.toFixed(4)} FUSE`,
      value: price > 0 ? `$${(fuse * price).toFixed(2)}` : null,
    };
  }

  return null;
}

/** What `payoutTxHash` holds when a debt absorbed the payout: no transaction. */
const DEDUCTED_FROM_DEBT = "DEDUCTED_FROM_DEBT";

/**
 * Where a cashback payout can be looked up: Basescan for a soEUR payout
 * (`payoutChainId` 8453), the Fuse explorer otherwise. Null when there is no
 * transaction to show — not paid yet, or deducted from a debt.
 */
export function cashbackPayoutLink(
  cashback?: Pick<CardTransactionCashback, "payoutTxHash" | "payoutChainId">
): { href: string; title: string } | null {
  const hash = cashback?.payoutTxHash;
  if (!hash || hash === DEDUCTED_FROM_DEBT) return null;

  return {
    href: getExplorerTxUrl(hash, cashback.payoutChainId),
    title:
      cashback.payoutChainId === 8453
        ? "View payout on Basescan"
        : "View payout on Fuse explorer",
  };
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
