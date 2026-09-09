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



