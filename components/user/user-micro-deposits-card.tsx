"use client";

import { useQuery } from "@tanstack/react-query";
import { Landmark, Loader2 } from "lucide-react";

import { getUserMicroDeposits } from "@/lib/api";
import { VirtualAccountMicroDeposit } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";

/** "0.23" → "$0.23". Rain sends dollars as a decimal string, never cents. */
function formatAmount(amount: string): string {
  const value = Number(amount);
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : `$${amount}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Verification deposits on the user's Rain virtual account.
 *
 * Answers the ticket "my bank says it sent two small deposits but I can't see
 * them": Rain never converts a deposit under $2, so these are in no balance
 * and no activity feed. The app shows the user the last 30 days; this shows
 * everything we hold, with the memo and trace number the sending bank can
 * look up.
 */
export default function UserMicroDepositsCard({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery<{
    data: VirtualAccountMicroDeposit[];
  }>({
    queryKey: ["user-micro-deposits", userId],
    queryFn: async () => (await getUserMicroDeposits(userId)).data,
  });

  const deposits = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-gray-400" />
          Verification deposits (under $2)
        </CardTitle>
        {deposits.length > 0 && (
          <Badge variant="muted">
            {deposits.length} {deposits.length === 1 ? "deposit" : "deposits"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-500">
          Rain does not process bank deposits under $2, so none of these are in
          the user&apos;s balance. Most are a bank or broker verifying the
          account: the user confirms the amounts with the sender.
        </p>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">
            Failed to load verification deposits.
          </p>
        ) : deposits.length === 0 ? (
          <p className="text-sm text-gray-500">
            No deposits under $2 have reached this user&apos;s virtual account.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Received</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">From</th>
                  <th className="py-2 pr-4 font-medium">Rail</th>
                  <th className="py-2 pr-4 font-medium">Kind</th>
                  <th className="py-2 pr-4 font-medium">Memo</th>
                  <th className="py-2 font-medium">Trace / IMAD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deposits.map((deposit) => (
                  <tr key={deposit._id} className="align-top">
                    <td className="whitespace-nowrap py-2 pr-4 text-gray-600">
                      {formatDate(deposit.receivedAt)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 font-medium text-gray-900">
                      {formatAmount(deposit.amount)}
                    </td>
                    <td className="py-2 pr-4 text-gray-900">
                      {deposit.originatorName || "—"}
                    </td>
                    <td className="py-2 pr-4 uppercase text-gray-600">
                      {deposit.rail}
                    </td>
                    <td className="py-2 pr-4">
                      {deposit.isAccountVerification ? (
                        <Badge variant="info">Verification</Badge>
                      ) : (
                        <Badge variant="warning">Under minimum</Badge>
                      )}
                    </td>
                    <td
                      className="max-w-[16rem] truncate py-2 pr-4 text-xs text-gray-500"
                      title={deposit.description}
                    >
                      {deposit.description || "—"}
                    </td>
                    <td className="py-2">
                      {deposit.referenceId ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-gray-600">
                          {deposit.referenceId}
                          <CopyButton
                            value={deposit.referenceId}
                            label="Trace number"
                          />
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
