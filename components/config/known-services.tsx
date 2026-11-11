"use client";

import { Loader2, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { ConfigSection } from "@/components/config/config-fields";
import { useKnownServices, useRemoveKnownService } from "@/hooks/use-attention";
import { describeApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

/**
 * Config → Anti-abuse → Known services: outside wallets many honest users pay
 * (an exchange's deposit address, a bridge), which the radar's shared
 * cash-out check leaves out. Added from a radar item ("Known service…");
 * removing one is the undo, and the check looks at the address again from
 * its next run.
 */
export function KnownServicesSection() {
  const { data, isLoading, error } = useKnownServices();
  const remove = useRemoveKnownService();

  return (
    <ConfigSection
      id="known-services"
      title="Known services"
      description="Wallets the shared cash-out check leaves out: exchanges, bridges, payment services"
      icon={<Wallet className="h-5 w-5 text-indigo-600" />}
      defaultOpen
    >
      <p className="text-sm text-gray-500">
        Added from a radar alert with &ldquo;Known service…&rdquo;. Remove one
        and the radar checks that address again from its next run (5 minutes).
      </p>
      {error ? (
        <p className="text-sm text-red-700">
          Could not load the known services: {describeApiError(error)}.
        </p>
      ) : null}
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden />
      ) : null}
      {data && data.length === 0 ? (
        <p className="text-sm text-gray-500">None yet.</p>
      ) : null}
      {data && data.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
              <th className="py-2 pr-4 font-medium">Service</th>
              <th className="py-2 pr-4 font-medium">Wallet</th>
              <th className="py-2 pr-4 font-medium">Added</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.address} className="border-b border-gray-100">
                <td className="py-2 pr-4 font-medium text-gray-900">{row.name}</td>
                <td className="py-2 pr-4 font-mono text-xs text-gray-600" title={row.address}>
                  {row.address.slice(0, 8)}…{row.address.slice(-4)}
                </td>
                <td className="py-2 pr-4 text-gray-500">
                  {formatDateTime(row.addedAt)} · {row.addedBy.split("@")[0]}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(row.address, {
                        onSuccess: () =>
                          toast.success(`Removed ${row.name}: checked again from the next run`),
                        onError: (e) => toast.error(describeApiError(e)),
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:border-gray-300 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </ConfigSection>
  );
}
