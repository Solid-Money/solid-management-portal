import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Activity, TransactionStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  number: number,
  maximumFractionDigits = 6,
  minimumFractionDigits = 2
) {
  return new Intl.NumberFormat("en-us", {
    maximumFractionDigits,
    minimumFractionDigits: number >= 1 ? minimumFractionDigits : 0,
  }).format(number);
}

/**
 * Fraction digits for the tokens worth enough a unit that two would hide a
 * deposit: the app's minimum is about $10, which is 0.004 ETH, 0.00012 WBTC or
 * 0.0025 PAXG. Keyed by upper-cased symbol.
 */
const TOKEN_FRACTION_DIGITS: Record<string, number> = {
  // Bitcoin, wrapped: eight decimals, the token's own.
  WBTC: 8,
  CBBTC: 8,
  BTC: 8,
  // ETH in each of the forms a deposit arrives or is saved as, and the assets
  // priced like it.
  ETH: 6,
  WETH: 6,
  SOETH: 6,
  PAXG: 6,
  ZEC: 6,
  AAVE: 4,
  SOL: 4,
  SLVX: 4,
};

/**
 * Most fraction digits a token amount is shown with: more for an asset worth
 * hundreds or thousands a unit (see TOKEN_FRACTION_DIGITS), two for everything
 * else.
 */
export function tokenFractionDigits(symbol?: string | null): number {
  return (symbol && TOKEN_FRACTION_DIGITS[symbol.toUpperCase()]) || 2;
}

/**
 * FUSE to the millionth, with at least cents: "399,999.57 FUSE",
 * "49,999.999 FUSE".
 *
 * For figures a tier threshold is decided on, where any rounding coarser than
 * the grade's own slack would show a position just under a threshold as
 * reaching it — exactly the case these figures are shown to explain. Six
 * decimals matches that slack (the backend's 1e-6 FUSE rounding tolerance), so
 * a figure that reads at or above a threshold is one the grade grants. Zero for
 * anything that is not a number.
 */
export function formatFuseExact(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(safe)} FUSE`;
}

/**
 * A USD amount, always `$1,234.56` — the only way money should be rendered.
 *
 * Locked to en-US rather than the browser's locale. `toLocaleString(undefined,
 * …)` follows whatever the viewer's machine is set to, so the same revenue
 * figure read `$583.53` on one laptop and `$73,31` on a French one, and two
 * people comparing screenshots could not tell a formatting difference from a
 * data difference.
 *
 * Distinct from {@link formatNumber} because that one drops the minimum
 * fraction digits below 1 — right for a token balance, wrong for money, where
 * it turns a 50-cent fee into `$0.5`. Cents are never dropped here.
 *
 * `fractionDigits` is fixed rather than a maximum: a column of amounts only
 * lines up if every row has the same number of decimals. Pass 0 for the
 * whole-dollar aggregates on the charts.
 */
export function formatUsd(value: number, fractionDigits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;

  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe)}`;
}

/**
 * Money in its own currency — `€12.73`, `$1,234.56` — or null when the amount
 * is missing or unreadable.
 *
 * For any figure that is not necessarily dollars: a Wirex card's spendable
 * balance, a euro cardholder's cashback. Locked to en-US like
 * {@link formatUsd}, so only the symbol follows the currency.
 *
 * Deliberately tolerant of a figure that is not there, because callers render
 * whatever the backend sends: an empty string reads as missing rather than as
 * nothing (`Number("")` is 0), and a code Intl does not know still shows as
 * `12.73 XYZ` rather than throwing inside render.
 *
 * `fractionDigits` defaults to the currency's own (two for USD and EUR).
 */
export function formatCurrency(
  amount: string | number | null | undefined,
  currency: string,
  fractionDigits?: { minimum?: number; maximum?: number }
): string | null {
  if (amount === null || amount === undefined) return null;
  if (typeof amount === "string" && !amount.trim()) return null;

  const value = Number(amount);
  if (!Number.isFinite(value)) return null;

  try {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits?.minimum,
      maximumFractionDigits: fractionDigits?.maximum,
    });
  } catch {
    // Not a currency code Intl knows; still worth showing.
    return `${amount} ${currency}`;
  }
}

/**
 * A EUR amount, always `€1,234.56` — the euro twin of {@link formatUsd}, for a
 * figure that is euros end to end (euro cashback). Never a conversion: a euro
 * figure is shown in euros, a dollar one in dollars, and the two are not
 * added together.
 */
export function formatEur(value: number, fractionDigits = 2): string {
  return (
    formatCurrency(Number.isFinite(value) ? value : 0, "EUR", {
      minimum: fractionDigits,
      maximum: fractionDigits,
    }) ?? "—"
  );
}

const EXPLORER_URLS: Record<number, string> = {
  1: "https://etherscan.io",
  // BSC is a supported bridge chain, so its deposits need an explorer too —
  // without it they silently fell back to the Fuse explorer, which cannot
  // resolve a BSC hash.
  56: "https://bscscan.com",
  122: "https://explorer.fuse.io",
  137: "https://polygonscan.com",
  8453: "https://basescan.org",
  42161: "https://arbiscan.io",
  // Optimism takes deposits to the Safe (OP, USDC, ...), so a deposit there must
  // not link to the Fuse explorer either.
  10: "https://optimistic.etherscan.io",
};

/** A transaction on its chain's explorer. No chain, or an unknown one, reads as Fuse. */
export function getExplorerTxUrl(
  hash: string,
  chainId: number | null | undefined
): string {
  const base = EXPLORER_URLS[chainId ?? 122] ?? EXPLORER_URLS[122];
  return `${base}/tx/${hash}`;
}

/**
 * A date and time in en-US, for the same reason as {@link formatUsd}: a
 * timestamp that reads `9/8/2026` for one operator and `08/09/2026` for another
 * is a support call waiting to happen.
 */
export function formatDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export const isTransactionStuck = (timestamp: string): boolean => {
  if (!timestamp) return false;
  const transactionDate = new Date(parseInt(timestamp) * 1000);
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  return transactionDate < oneDayAgo;
};

export type TimeGroupHeaderData = {
  title: string;
  key: string;
  status?: TransactionStatus;
  hasPendingTransactions?: boolean;
  hasCancelledTransactions?: boolean;
  hasActivePendingTransactions?: boolean;
};

export enum ActivityGroup {
  HEADER = "header",
  TRANSACTION = "transaction",
}

export type TimeGroup<T = Activity> =
  | {
      type: ActivityGroup.HEADER;
      data: TimeGroupHeaderData;
    }
  | {
      type: ActivityGroup.TRANSACTION;
      data: T;
    };

export const formatTimeGroup = (timestamp: string): string => {
  if (!timestamp) return "";

  const transactionDate = new Date(parseInt(timestamp) * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(transactionDate, today)) {
    return "Today";
  } else if (isSameDay(transactionDate, yesterday)) {
    return "Yesterday";
  } else {
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(transactionDate);
  }
};

export const groupTransactionsByTime = (
  transactions: Activity[],
  showStuck: boolean = false
): TimeGroup[] => {
  const filteredTransactions = showStuck
    ? transactions
    : transactions.filter((tx) => {
        const isPending = tx.status === TransactionStatus.PENDING;
        const isCancelled = tx.status === TransactionStatus.CANCELLED;
        const isFailed = tx.status === TransactionStatus.FAILED;
        const isStuck = isTransactionStuck(tx.timestamp || "");
        
        // Hide stuck pending or cancelled
        if ((isPending && isStuck) || isCancelled) return false;

        // Match app's specific filter: hide FAILED records that were actually just expired sessions
        if (isFailed && tx.metadata?.reason === "expired") return false;

        return true;
      });

  const grouped: TimeGroup[] = [];

  // Separate pending, cancelled and completed transactions
  const pendingTransactions = filteredTransactions.filter(
    (tx) => tx.status === TransactionStatus.PENDING
  );
  const cancelledTransactions = filteredTransactions.filter(
    (tx) => tx.status === TransactionStatus.CANCELLED
  );
  const completedTransactions = filteredTransactions.filter(
    (tx) =>
      tx.status !== TransactionStatus.PENDING &&
      tx.status !== TransactionStatus.CANCELLED
  );

  const hasActivePendingTransactions = pendingTransactions.some(
    (tx) => !isTransactionStuck(tx.timestamp || "")
  );

  // Add pending transactions group at the top if there are any pending or cancelled
  if (pendingTransactions.length > 0 || cancelledTransactions.length > 0) {
    grouped.push({
      type: ActivityGroup.HEADER,
      data: {
        title: "Pending activity",
        key: "header-pending",
        status: TransactionStatus.PENDING,
        hasPendingTransactions: pendingTransactions.length > 0,
        hasCancelledTransactions: cancelledTransactions.length > 0,
        hasActivePendingTransactions,
      },
    });

    pendingTransactions.forEach((transaction) => {
      grouped.push({
        type: ActivityGroup.TRANSACTION,
        data: transaction,
      });
    });

    cancelledTransactions.forEach((transaction) => {
      grouped.push({
        type: ActivityGroup.TRANSACTION,
        data: transaction,
      });
    });
  }

  // Add completed transactions grouped by time
  let currentGroup: string | null = null;
  completedTransactions.forEach((transaction) => {
    const groupTitle = formatTimeGroup(transaction?.timestamp || "");

    // Add group header if this is a new group
    if (currentGroup !== groupTitle) {
      grouped.push({
        type: ActivityGroup.HEADER,
        data: {
          title: groupTitle,
          key: `header-${groupTitle}`,
        },
      });
      currentGroup = groupTitle;
    }

    // Add the transaction
    grouped.push({
      type: ActivityGroup.TRANSACTION,
      data: transaction,
    });
  });

  return grouped;
};



