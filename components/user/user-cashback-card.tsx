"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Percent } from "lucide-react";

import { getUserCashback } from "@/lib/api";
import { CashbackEntry, CashbackHistory } from "@/types";
import { cashbackStatusVariant } from "@/lib/card-transactions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** What a row actually paid out, in the asset it was paid in. */
function payoutOf(entry: CashbackEntry): string {
  const soUsd = Number(entry.soUsdAmount ?? 0);
  if (soUsd > 0) return `${soUsd.toFixed(4)} soUSD`;

  const fuse = Number(entry.fuseAmount ?? 0);
  if (fuse > 0) return `${fuse.toFixed(4)} FUSE`;

  return "—";
}

/**
 * Cashback and subscription discounts the user has earned.
 *
 * The totals sit above the rows because "how much cashback have I actually
 * been paid?" is the question, and answering it from the raw list means
 * knowing which of nine statuses count as settled.
 */
export default function UserCashbackCard({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery<{ data: CashbackHistory }>({
    queryKey: ["user-cashback", userId],
    queryFn: async () => (await getUserCashback(userId)).data,
  });

  const history = data?.data;
  const entries = history?.entries ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-gray-400" />
          Cashback received
        </CardTitle>
        {history && (
          <span className="text-sm font-semibold text-gray-900">
            ${history.totalPaidUsd.toFixed(2)}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : error || !history ? (
          <p className="text-sm text-red-600">Failed to load cashback.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-gray-500">Paid</p>
                <p className="text-sm font-semibold text-gray-900">
                  {history.totalPaidSoUsd.toFixed(4)} soUSD
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">On spend of</p>
                <p className="text-sm font-semibold text-gray-900">
                  ${history.totalQualifyingSpend.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Pending</p>
                <p className="text-sm font-semibold text-gray-900">
                  {history.pendingCount}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Failed</p>
                <p
                  className={`text-sm font-semibold ${
                    history.failedCount > 0 ? "text-red-600" : "text-gray-900"
                  }`}
                >
                  {history.failedCount}
                </p>
              </div>
            </div>

            {entries.length === 0 ? (
              <p className="text-sm text-gray-500">
                No cashback has been earned yet.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-100">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Merchant
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Spend
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Payout
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.map((entry) => (
                      <tr key={entry._id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                          {new Date(entry.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" }
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {entry.merchantName || "—"}
                          {entry.type === "SubscriptionDiscount" && (
                            <span className="ml-1 text-[10px] text-indigo-600">
                              subscription
                              {entry.subscriptionCategory
                                ? ` · ${entry.subscriptionCategory}`
                                : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-gray-700">
                          {Number(entry.fiatAmount || 0).toFixed(2)}{" "}
                          {entry.fiatCurrency}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-gray-900">
                          {payoutOf(entry)}
                          {entry.payoutTxHash && (
                            <a
                              href={`https://explorer.fuse.io/tx/${entry.payoutTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1 inline-block text-indigo-600 hover:text-indigo-800"
                              title="View payout on Fuse explorer"
                            >
                              <ExternalLink className="inline h-3 w-3" />
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={cashbackStatusVariant(entry.status)}>
                            {entry.status}
                          </Badge>
                          {entry.lastError && (
                            <p className="mt-0.5 text-[10px] text-red-600">
                              {entry.lastError}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
