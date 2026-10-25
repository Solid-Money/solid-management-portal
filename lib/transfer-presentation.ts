import { TransactionStatus, TransactionType } from "@/types";

/**
 * Saying what a wallet send or receive actually was, for support.
 *
 * The indexers title every transfer by token and direction only — "Send USDC.e",
 * "Receive EURC" — so an agent looking at a cardholder's feed could not tell a
 * refund from a stranger's payment without opening the explorer. The backend now
 * names the transfers that are money Solid paid (a card refund, cashback, a
 * deposit arriving) and records what it found on `metadata.transferContext`; every
 * other transfer is named here by its counterparty. Mirrors the app's
 * `lib/utils/transferPresentation`, so support reads the row the user reads.
 */

/** Mirrors `TransferContextKind` in solid-backend. */
export enum TransferContextKind {
  CARD_REFUND = "card_refund",
  CARD_CREDIT = "card_credit",
  CARD_CASHBACK = "card_cashback",
  DEPOSIT_DELIVERY = "deposit_delivery",
}

export interface TransferContext {
  kind: TransferContextKind;
  summary?: string;
  merchantName?: string;
  creditReason?: string;
  cardTransactionId?: string;
  linkedClientTxId?: string;
}

interface TransferActivity {
  type: string;
  title?: string;
  status: string;
  fromAddress?: string;
  toAddress?: string;
  metadata?: Record<string, unknown>;
}

const KNOWN_KINDS = new Set<string>(Object.values(TransferContextKind));

const textOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

/**
 * What the backend found the transfer to be, rebuilt field by field rather than
 * cast: `metadata` is free-form, and the summary is rendered as a text child,
 * where anything but a string throws.
 */
export function getTransferContext(
  activity: Pick<TransferActivity, "metadata">,
): TransferContext | undefined {
  const context: unknown = activity.metadata?.transferContext;
  if (!context || typeof context !== "object") return undefined;

  const raw = context as Record<string, unknown>;
  if (typeof raw.kind !== "string" || !KNOWN_KINDS.has(raw.kind)) {
    return undefined;
  }

  return {
    kind: raw.kind as TransferContextKind,
    summary: textOrUndefined(raw.summary),
    merchantName: textOrUndefined(raw.merchantName),
    creditReason: textOrUndefined(raw.creditReason),
    cardTransactionId: textOrUndefined(raw.cardTransactionId),
    linkedClientTxId: textOrUndefined(raw.linkedClientTxId),
  };
}

/**
 * The category column for a transfer the backend named. A deposit delivery says
 * what it is to support plainly: the app hides it, because the deposit's own row
 * already shows the same money.
 */
const CONTEXT_CATEGORY: Record<TransferContextKind, string> = {
  [TransferContextKind.CARD_REFUND]: "Card refund",
  [TransferContextKind.CARD_CREDIT]: "Card credit",
  [TransferContextKind.CARD_CASHBACK]: "Cashback",
  [TransferContextKind.DEPOSIT_DELIVERY]: "Deposit delivery",
};

export function getTransferCategory(
  activity: Pick<TransferActivity, "metadata">,
): string | undefined {
  const context = getTransferContext(activity);
  return context ? CONTEXT_CATEGORY[context.kind] : undefined;
}

const isTransfer = (type: string) =>
  type === TransactionType.SEND || type === TransactionType.RECEIVE;

/** "Send USDC.e", "Receive EURC", "Send 10 USDC" — a title nobody chose. */
const BARE_TRANSFER_TITLE = /^(send|receive)(\s+[\d.,]+)?\s+\S+$/i;

const shortAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

/**
 * The title a send or receive shows: the backend's own name for one it
 * recognised ("Refund from UBER"), "Sent to 0x…" / "Received from 0x…" for a
 * plain transfer, and the stored title for anything else.
 */
export function getTransferTitle(
  activity: TransferActivity,
): string | undefined {
  const title = activity.title;
  if (!isTransfer(activity.type)) return title;
  if (getTransferContext(activity)) return title;
  // A missing title is as bare as "Send USDC" — name it by the counterparty too.
  if (title?.trim() && !BARE_TRANSFER_TITLE.test(title.trim())) return title;

  const counterparty = (
    activity.type === TransactionType.SEND
      ? activity.toAddress
      : activity.fromAddress
  )?.trim();
  if (!counterparty) return title;

  const who = shortAddress(counterparty);
  if (activity.type === TransactionType.RECEIVE) return `Received from ${who}`;
  if (
    activity.status === TransactionStatus.PENDING ||
    activity.status === TransactionStatus.DETECTED ||
    activity.status === TransactionStatus.PROCESSING
  ) {
    return `Sending to ${who}`;
  }
  if (
    activity.status === TransactionStatus.FAILED ||
    activity.status === TransactionStatus.CANCELLED ||
    activity.status === TransactionStatus.EXPIRED
  ) {
    return `Send to ${who}`;
  }
  return `Sent to ${who}`;
}

/**
 * The backend's one-line account of a transfer it recognised, with the row the
 * app shows instead named, so an agent can find what the user sees: the
 * deposit a delivery duplicates, or the card purchase whose cashback section
 * shows a cashback payout.
 */
export function getTransferSummary(
  activity: Pick<TransferActivity, "metadata">,
): string | undefined {
  const context = getTransferContext(activity);
  if (!context) return undefined;

  // What support needs to find, so it is named even when the descriptive
  // sentence is missing.
  let shownInstead: string | undefined;
  if (context.kind === TransferContextKind.DEPOSIT_DELIVERY) {
    shownInstead = context.linkedClientTxId
      ? `Hidden in the app; the deposit is ${context.linkedClientTxId}.`
      : undefined;
  } else if (context.kind === TransferContextKind.CARD_CASHBACK) {
    shownInstead = context.cardTransactionId
      ? `Hidden in the app; shown in the cashback section of card transaction ${context.cardTransactionId}.`
      : "Hidden in the app.";
  }

  return [context.summary, shownInstead].filter(Boolean).join(" ") || undefined;
}
