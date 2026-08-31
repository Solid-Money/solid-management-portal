"use client";

import React from "react";
import { Activity, getTransactionCategory, TRANSACTION_DETAILS, TransactionStatus, TransactionDirection, TransactionType } from "@/types";
import { cn, formatNumber } from "@/lib/utils";
import { TokenIcon } from "./token-icon";
import { ExternalLink, Loader2 } from "lucide-react";

interface ActivityItemProps {
  activity: Activity;
  isFirst?: boolean;
  isLast?: boolean;
}

export const ActivityItem = ({
  activity,
  isFirst,
  isLast,
}: ActivityItemProps) => {
  const {
    title,
    shortTitle,
    type,
    amount,
    symbol,
    status,
    timestamp,
    createdAt,
    hash,
    url,
  } = activity;

  const transactionType = type as TransactionType;
  const details = TRANSACTION_DETAILS[transactionType];

  const isPending = status === TransactionStatus.PENDING;
  const isFailed = status === TransactionStatus.FAILED;
  const isCancelled = status === TransactionStatus.CANCELLED;
  const isProcessing = status === TransactionStatus.PROCESSING;
  const isExpired = status === TransactionStatus.EXPIRED;
  const isRefunded = status === TransactionStatus.REFUNDED;

  const statusBadge = isFailed
    ? { text: "Failed", bgColor: "bg-red-50", textColor: "text-red-600" }
    : isExpired
    ? { text: "Expired", bgColor: "bg-orange-50", textColor: "text-orange-600" }
    : isRefunded
    ? { text: "Refunded", bgColor: "bg-purple-50", textColor: "text-purple-600" }
    : null;

  const isIncoming = details?.sign === TransactionDirection.IN;

  const statusTextColor = isFailed
    ? "text-red-600"
    : isExpired
    ? "text-orange-600"
    : isRefunded
    ? "text-purple-600"
    : isCancelled
    ? "text-gray-400"
    : isIncoming
    ? "text-emerald-600"
    : "text-gray-900";

  const statusSign = isFailed
    ? TransactionDirection.FAILED
    : isExpired || isRefunded || isCancelled
    ? TransactionDirection.CANCELLED
    : (details?.sign ?? "");

  const displayTitle = shortTitle || title || type;
  // Resolved from the title too: `deposit` and `bridge_deposit` each back both a
  // savings deposit and a card deposit, so the static map alone labelled every
  // card deposit "Savings account".
  const description = getTransactionCategory(transactionType, title) || "Unknown";

  const formatActivityTimestamp = (ts?: string, createdAtDate?: string) => {
    const date = ts ? new Date(parseInt(ts) * 1000) : new Date(createdAtDate || "");
    // Format the parts rather than patching the string: the formatted date
    // carries two commas ("Aug 31, 2026, 3:07 PM"), and replacing the first one
    // — which sits between day and year — produced "Aug 31 at 2026, 3:07 PM".
    const day = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
    return `${day} at ${time}`;
  };

  const formattedTimestamp = formatActivityTimestamp(timestamp, createdAt);

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-4 bg-white transition-colors hover:bg-gray-50",
        !isLast && "border-b border-gray-100",
        isFirst && "rounded-t-2xl shadow-sm",
        isLast && "rounded-b-2xl shadow-sm"
      )}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <TokenIcon symbol={symbol} size={44} />
        <div className="shrink min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-gray-900 truncate">
              {displayTitle}
            </span>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-900"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPending || isProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
            ) : null}
            <span className="text-sm text-gray-600 font-medium">
              {description}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">{formattedTimestamp}</span>
          </div>
        </div>
        {(isFailed || isExpired || isRefunded) && statusBadge && (
          <div
            className={cn(
              statusBadge.bgColor,
              "px-2 py-0.5 rounded-full shrink-0"
            )}
          >
            <span className={cn(statusBadge.textColor, "text-[10px] font-bold uppercase tracking-wider")}>
              {statusBadge.text}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
        <span className={cn("text-base font-semibold", statusTextColor)}>
          {(isExpired || isFailed || isRefunded) && (!amount || parseFloat(amount) === 0) ? (
            <span className="capitalize">{status}</span>
          ) : (
            <>
              {statusSign}
              {formatNumber(parseFloat(amount || "0"), 2)} {symbol}
            </>
          )}
        </span>
        {hash && (
          <span className="text-[10px] font-mono text-gray-500 truncate max-w-[100px]">
            {hash.slice(0, 6)}...{hash.slice(-4)}
          </span>
        )}
      </div>
    </div>
  );
};



