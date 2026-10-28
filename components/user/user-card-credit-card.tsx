"use client";

import { useState } from "react";
import { Loader2, MinusCircle, PlusCircle, Ticket } from "lucide-react";

import {
  useReferralV4Access,
  useUserCardCredit,
} from "@/hooks/use-referral-v4";
import {
  CARD_CREDIT_KIND_LABELS,
  CARD_CREDIT_SOURCE_LABELS,
  formatUtc,
  isNotAvailable,
  signedCreditAmount,
} from "@/lib/referral-v4";
import { formatUsd } from "@/lib/utils";
import type { AdminCardCreditEntry } from "@/types/referral-v4";
import CardCreditAdjustDialog from "@/components/user/card-credit-adjust-dialog";
import { NotAvailableYet } from "@/components/referral-v4/not-available";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KIND_VARIANT: Record<
  AdminCardCreditEntry["kind"],
  "success" | "info" | "warning" | "danger" | "muted"
> = {
  grant: "success",
  hold: "warning",
  spend: "info",
  release: "muted",
  refund: "success",
  revoke: "danger",
};

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "strong";
}) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p
        className={`font-semibold text-gray-900 ${
          tone === "strong" ? "text-base" : "text-sm"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The user's card credit: what is available and held, lifetime totals, and
 * every ledger entry — grants (referral bonuses, boosts, admin grants), holds
 * and spends at Wirex authorization, releases, refunds and removals.
 *
 * Credit is Wirex-only: a user without an active Wirex card can hold it but
 * not spend it, which the badge says up front because it is the first thing
 * asked about "my credit isn't being used". Grant and Remove are shown only
 * to admins the backend allows (`canManageCredit`).
 */
export default function UserCardCreditCard({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const { data, isLoading, error } = useUserCardCredit(userId);
  const access = useReferralV4Access();
  const [dialog, setDialog] = useState<"grant" | "remove" | null>(null);

  const account = data?.account;
  const entries = data?.entries ?? [];
  const canManage = access.data?.canManageCredit === true;
  const notAvailable = !!error && isNotAvailable(error);

  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-gray-400" />
          Card credit
        </CardTitle>
        {account && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {account.spendable ? (
              <Badge variant="success">Wirex card</Badge>
            ) : (
              <Badge variant="warning">Not spendable — no Wirex card</Badge>
            )}
            {canManage && (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setDialog("grant")}
                  className="cursor-pointer"
                >
                  <PlusCircle />
                  Grant credit
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setDialog("remove")}
                  disabled={account.availableUsd <= 0}
                  className="cursor-pointer"
                  title={
                    account.availableUsd <= 0
                      ? "Nothing available to remove"
                      : undefined
                  }
                >
                  <MinusCircle />
                  Remove credit
                </Button>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : notAvailable ? (
          <NotAvailableYet what="Card credit" />
        ) : error || !account ? (
          <p className="text-sm text-red-600">Failed to load card credit.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 @lg:grid-cols-5">
              <Stat
                label="Available"
                value={formatUsd(account.availableUsd)}
                tone="strong"
              />
              <Stat label="Pending" value={formatUsd(account.pendingUsd)} />
              <Stat
                label="Granted"
                value={formatUsd(account.lifetimeGrantedUsd)}
              />
              <Stat label="Spent" value={formatUsd(account.lifetimeSpentUsd)} />
              <Stat
                label="Removed"
                value={formatUsd(account.lifetimeRevokedUsd ?? 0)}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              Pending is held by card authorizations still waiting to settle.
              Lifetime totals since the account&apos;s first credit.
            </p>

            {entries.length === 0 ? (
              <p className="text-sm text-gray-500">
                No card credit has been granted yet.
              </p>
            ) : (
              <div className="max-h-96 overflow-auto rounded-lg border border-gray-100">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Date (UTC)
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Kind</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Balance after
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Detail
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        By / reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.map((entry) => {
                      const signed = signedCreditAmount(
                        entry.kind,
                        entry.amountUsd,
                      );
                      return (
                        <tr key={entry.id} className="align-top">
                          <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                            {formatUtc(entry.createdAt)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={KIND_VARIANT[entry.kind] ?? "muted"}>
                              {CARD_CREDIT_KIND_LABELS[entry.kind] ??
                                entry.kind}
                            </Badge>
                          </td>
                          <td
                            className={`px-3 py-2 text-right whitespace-nowrap font-medium ${
                              signed < 0 ? "text-red-600" : "text-emerald-700"
                            }`}
                          >
                            {signed < 0 ? "−" : "+"}
                            {formatUsd(Math.abs(signed))}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap text-gray-700">
                            {formatUsd(entry.balanceAfterUsd)}
                          </td>
                          <td className="px-3 py-2 text-gray-900">
                            <div>{entry.label || "—"}</div>
                            {entry.merchantName && (
                              <div className="text-[11px] text-gray-500">
                                {entry.merchantName}
                              </div>
                            )}
                            {entry.sourceType && (
                              <div className="text-[10px] uppercase text-gray-400">
                                {CARD_CREDIT_SOURCE_LABELS[entry.sourceType] ??
                                  entry.sourceType}
                              </div>
                            )}
                            {entry.transactionId && (
                              <div
                                className="font-mono text-[10px] text-gray-400"
                                title={entry.transactionId}
                              >
                                tx {entry.transactionId.slice(0, 10)}…
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {entry.adminEmail ? (
                              <div className="font-medium text-gray-800">
                                {entry.adminEmail}
                              </div>
                            ) : (
                              !entry.reason && (
                                <span className="text-gray-400">—</span>
                              )
                            )}
                            {entry.reason && (
                              <div className="whitespace-pre-line">
                                “{entry.reason}”
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>

      {account && dialog && (
        <CardCreditAdjustDialog
          userId={userId}
          username={username}
          mode={dialog}
          availableUsd={account.availableUsd}
          open
          onOpenChange={(next) => {
            if (!next) setDialog(null);
          }}
        />
      )}
    </Card>
  );
}
