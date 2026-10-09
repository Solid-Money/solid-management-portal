"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

import { getUserCardHolds } from "@/lib/api";
import { formatDateTime, formatUsd } from "@/lib/utils";
import { CardHoldEntry, CardHolds } from "@/types/cash-holds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyableValue } from "@/components/ui/copy-button";
import ReleaseCardHoldDialog from "@/components/user/release-card-hold-dialog";

const KIND_LABELS: Record<string, string> = {
  HOLD: "Hold",
  DEBIT: "Settled, not swept",
  SWEEP_PENDING: "Sweeping",
  ARREARS: "Arrears",
  REJECTED: "Rejection marker",
};

function HoldRow({
  userId,
  username,
  entry,
}: {
  userId: string;
  username: string;
  entry: CardHoldEntry;
}) {
  const payment = entry.operation;

  return (
    <li
      className={`space-y-1.5 rounded-md border p-2.5 text-xs ${
        entry.stale
          ? "border-amber-300 bg-amber-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`font-semibold ${
                entry.countsAgainstSpending
                  ? "text-gray-900"
                  : "text-gray-400 line-through"
              }`}
            >
              {formatUsd(entry.amountUsd)}
            </span>
            <Badge variant={entry.kind === "ARREARS" ? "danger" : "muted"}>
              {KIND_LABELS[entry.kind] ?? entry.kind}
            </Badge>
            {entry.stale && <Badge variant="warning">Stale</Badge>}
            {payment?.status && (
              <Badge variant="outline">{payment.status}</Badge>
            )}
            <span className="text-gray-500">{entry.instance}</span>
          </div>
          <CopyableValue
            value={entry.uniqueOperationId}
            label="Operation ID"
            truncate
          />
        </div>
        <ReleaseCardHoldDialog
          userId={userId}
          username={username}
          entry={entry}
        />
      </div>

      <p className="text-gray-600">{entry.explanation}</p>

      <p className="text-[11px] text-gray-500">
        {entry.placedAt && <>Placed {formatDateTime(entry.placedAt)} · </>}
        {entry.expiresAt && <>Expires {formatDateTime(entry.expiresAt)}</>}
        {payment?.merchantAmount && (
          <>
            {" "}
            · {payment.merchantAmount} {payment.merchantCurrency}
          </>
        )}
        {payment && !payment.hasAuthorizeDecision && (
          <> · No authorize decision on record</>
        )}
      </p>
    </li>
  );
}

/**
 * What is reserved against a Wirex card's spending power, and the way to
 * release what nothing will ever clear.
 *
 * Read from the card-spend hold store, which only the backend can reach. This
 * is the answer to "the Safe has money but the card declines" when the panel
 * above shows a large On hold figure: each entry is named, joined to its
 * payment, and marked Stale when the backend can see no clearing will ever
 * convert it. Release is per entry and audited.
 */
export default function CardHoldsSection({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const { data, isLoading, isError, isFetching, refetch } = useQuery<CardHolds>(
    {
      queryKey: ["user-card-holds", userId],
      queryFn: async () => (await getUserCardHolds(userId)).data,
    },
  );

  const entries = data?.entries ?? [];
  const live = entries.filter((e) => e.countsAgainstSpending);

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase text-gray-500">Holds</h4>
        <div className="flex items-center gap-2">
          {data && data.staleUsd > 0 && (
            <Badge variant="warning">{formatUsd(data.staleUsd)} stale</Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="h-7 cursor-pointer px-2"
            aria-label="Reload holds"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        </div>
      ) : isError ? (
        <p className="text-xs text-gray-600">
          Could not read the hold store. Reload before concluding there is
          nothing held.
        </p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-600">
          Nothing is reserved against this card.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-600">
            {live.length} {live.length === 1 ? "entry" : "entries"} holding{" "}
            {formatUsd(data?.heldUsd ?? 0)} of spending power.
          </p>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <HoldRow
                key={`${entry.chainId}:${entry.uniqueOperationId}`}
                userId={userId}
                username={username}
                entry={entry}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
