"use client";

import { useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, Snowflake } from "lucide-react";

import { getCardFreezeHistory } from "@/lib/api";
import { CardFreezeAuditEntry, UserCardOverview } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyableValue } from "@/components/ui/copy-button";
import FreezeCardDialog from "@/components/user/freeze-card-dialog";

const PROVIDER_LABELS: Record<string, string> = {
  rain: "Rain",
  wirex: "Wirex",
  bridge: "Bridge.xyz (legacy)",
};

function formatDateTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Who froze the card, and whether the cardholder can undo it themselves. */
function FreezeExplanation({ card }: { card: UserCardOverview }) {
  if (!card.frozen) return null;

  const byCustomer = card.freezeInitiator === "customer";

  return (
    <div
      className={`rounded-md border p-3 text-xs ${
        byCustomer
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      <span className="font-medium">
        {byCustomer
          ? "Frozen by the cardholder."
          : "Frozen by an admin or by the provider."}
      </span>{" "}
      {byCustomer
        ? "They can unfreeze it themselves in the app."
        : "The cardholder cannot unfreeze this from the app — it has to be lifted here."}
    </div>
  );
}

function FreezeHistory({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<{ data: CardFreezeAuditEntry[] }>({
    queryKey: ["user-freeze-history", userId],
    queryFn: async () => (await getCardFreezeHistory(userId)).data,
  });

  const entries = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No admin has frozen or unfrozen this card.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li
          key={entry._id}
          className="flex flex-col gap-1 border-l-2 border-gray-200 pl-3 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                !entry.success
                  ? "danger"
                  : entry.action === "card_frozen"
                    ? "warning"
                    : "success"
              }
            >
              {entry.action === "card_frozen" ? "Frozen" : "Unfrozen"}
              {!entry.success && " (failed)"}
            </Badge>
            <span className="font-medium text-gray-900">
              {entry.adminUsername}
            </span>
            <span className="text-gray-500">
              {formatDateTime(entry.createdAt)}
            </span>
          </div>
          {entry.reason && (
            <span className="text-gray-600">“{entry.reason}”</span>
          )}
          {entry.error && <span className="text-red-600">{entry.error}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * The user's card: which issuer holds it, what state it is in, and the audit
 * trail of every admin freeze. The freeze control lives here rather than in the
 * page header so the action sits next to the state it changes.
 */
export default function UserCardPanel({
  userId,
  username,
  card,
  isLoading,
}: {
  userId: string;
  username: string;
  card?: UserCardOverview;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-gray-400" />
          Card
        </CardTitle>
        {card?.hasCard && (
          <CardAction>
            <FreezeCardDialog
              userId={userId}
              username={username}
              card={card}
            />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : !card?.hasCard ? (
          <p className="text-sm text-gray-500">
            This user has no card. Nothing to freeze.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Provider
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {PROVIDER_LABELS[card.provider ?? ""] ?? card.provider ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Status
                </dt>
                <dd className="mt-1">
                  <Badge
                    variant={
                      card.frozen
                        ? "warning"
                        : card.status === "active"
                          ? "success"
                          : "muted"
                    }
                  >
                    {card.frozen ? (
                      <>
                        <Snowflake className="h-3 w-3" /> Frozen
                      </>
                    ) : (
                      (card.status ?? "unknown")
                    )}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Card balance
                </dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  ${card.balanceUsd.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Ordered
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDateTime(card.createdAt)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Card ID
                </dt>
                <dd className="mt-1">
                  <CopyableValue value={card.cardId} label="Card ID" />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Issuer customer ID
                </dt>
                <dd className="mt-1">
                  <CopyableValue
                    value={card.providerCustomerId}
                    label="Customer ID"
                  />
                </dd>
              </div>
            </dl>

            <FreezeExplanation card={card} />

            <div className="space-y-2 border-t border-gray-100 pt-3">
              <h4 className="text-xs font-semibold uppercase text-gray-500">
                Admin freeze history
              </h4>
              <FreezeHistory userId={userId} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
