"use client";

import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";

import { getUserAuditLog } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { AdminAuditEntry } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BadgeVariant = "warning" | "success" | "info" | "danger" | "muted";

/**
 * How each admin action reads in the trail. Mirrors `AdminAuditAction` in
 * accounts-service; an action added there before it is added here still shows,
 * under its raw name.
 */
const ACTION_LABELS: Record<string, { label: string; variant: BadgeVariant }> =
  {
    account_recovered: { label: "Account recovered", variant: "success" },
    card_frozen: { label: "Card frozen", variant: "warning" },
    card_unfrozen: { label: "Card unfrozen", variant: "success" },
    card_issued: { label: "Card issued", variant: "info" },
    card_canceled: { label: "Card canceled", variant: "danger" },
    cashback_rate_user_set: { label: "Cashback rate set", variant: "info" },
    cashback_rate_user_cleared: {
      label: "Cashback rate cleared",
      variant: "muted",
    },
    cashback_rate_transaction_set: {
      label: "Transaction cashback rate set",
      variant: "info",
    },
    cashback_rate_transaction_cleared: {
      label: "Transaction cashback rate cleared",
      variant: "muted",
    },
    tier_trial_gifted: { label: "Tier trial gifted", variant: "info" },
    tier_trial_extended: { label: "Tier trial extended", variant: "info" },
    tier_trial_revoked: { label: "Tier trial revoked", variant: "warning" },
  };

const stringField = (entry: AdminAuditEntry, key: string): string | null => {
  const value = entry.metadata?.[key];
  return typeof value === "string" && value ? value : null;
};

/** The one or two facts that make an entry readable without opening Mongo. */
function detailFor(entry: AdminAuditEntry): string | null {
  if (entry.action === "account_recovered") {
    const closedAt = stringField(entry, "closedAt");
    const stillBlocked = stringField(entry, "remainingSpendBlockReason");
    const parts = [
      closedAt ? `closed ${formatDateTime(closedAt)}` : null,
      stillBlocked ? `card spend still blocked: ${stillBlocked}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  }

  const cardId = stringField(entry, "cardId");
  return cardId ? `card ${cardId.slice(0, 8)}…` : null;
}

/**
 * Every admin action taken on this user — card, cashback, tier trial and
 * account alike — newest first, with who did it, when and why.
 *
 * The card panel keeps its own narrower history; this is the one that answers
 * "what has support done to this account?", including recoveries of a closed
 * account, which used to be done by hand in the database with no record at all.
 */
export default function UserAuditLogCard({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useQuery<{ data: AdminAuditEntry[] }>({
    queryKey: ["user-audit-log", userId],
    queryFn: async () => (await getUserAuditLog(userId)).data,
  });

  const entries = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-gray-400" />
          Admin audit trail
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          </div>
        ) : isError ? (
          <p className="text-xs text-red-600">
            The audit trail could not be loaded.
          </p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-gray-500">
            No admin has changed anything on this account.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const action = ACTION_LABELS[entry.action] ?? {
                label: entry.action,
                variant: "muted" as const,
              };
              const detail = detailFor(entry);

              return (
                <li
                  key={entry._id}
                  className="flex flex-col gap-1 border-l-2 border-gray-200 pl-3 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={entry.success ? action.variant : "danger"}>
                      {action.label}
                      {!entry.success && " (failed)"}
                    </Badge>
                    <span
                      className="font-medium text-gray-900"
                      title={entry.adminEmail}
                    >
                      {entry.adminUsername}
                    </span>
                    <span className="text-gray-500">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                  {detail && <span className="text-gray-500">{detail}</span>}
                  {entry.reason && (
                    <span className="whitespace-pre-line text-gray-600">
                      “{entry.reason}”
                    </span>
                  )}
                  {entry.error && (
                    <span className="text-red-600">{entry.error}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
