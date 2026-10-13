"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { formatDateTime, getWalletAudit } from "@/lib/wallets";
import { WalletTreasuryAuditEntry } from "@/types";

/**
 * Who changed what, newest first.
 *
 * Exists because the two things an operator can now do from this page — move a
 * threshold and say they have funded something — both change what everybody
 * else sees. A floor that quietly dropped by half explains an alert that
 * stopped firing, and without this the only way to find that out is to ask
 * around.
 */
export default function TreasuryAudit() {
  const { data, isLoading, error } = useQuery<WalletTreasuryAuditEntry[]>({
    queryKey: ["wallet-audit"],
    queryFn: () => getWalletAudit(100),
  });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
        Failed to load the history.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
        Nothing has been changed from this page yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2">When</th>
            <th className="px-4 py-2">Who</th>
            <th className="px-4 py-2">What</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((entry, index) => (
            <tr key={`${entry.at}:${index}`}>
              <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                {formatDateTime(entry.at)}
              </td>
              <td className="px-4 py-2 text-gray-700">{entry.actor}</td>
              <td className="px-4 py-2 text-gray-900">{describe(entry)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One entry as a sentence, because a row of codes is not a trail anyone reads. */
function describe(entry: WalletTreasuryAuditEntry): string {
  const where = entry.walletName
    ? `${entry.walletName} · ${entry.symbol ?? entry.asset ?? ""}`
    : "";

  switch (entry.action) {
    case "threshold_changed":
      return `Changed the ${where} threshold from ${entry.previousValue} to ${entry.newValue}`;
    case "threshold_reset":
      return `Reset the ${where} threshold to the configured ${entry.newValue}`;
    case "refill_acknowledged":
      return `Marked ${where} as paid`;
    case "setting_changed":
      return entry.newValue === "true"
        ? "Turned on the Slack mention for urgent balance alerts"
        : "Turned off the Slack mention for urgent balance alerts";
    default:
      return entry.action;
  }
}
