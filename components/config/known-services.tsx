"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { ConfigSection } from "@/components/config/config-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKnownServices, useRemoveKnownService } from "@/hooks/use-attention";
import { describeApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { RadarKnownService } from "@/types/radar";

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
  // Removing can't be undone from here (it comes back only from a new radar
  // alert), so it asks first, naming the service and wallet.
  const [confirming, setConfirming] = useState<RadarKnownService | null>(null);
  // The dialog has no trigger, so focus is put back by hand when it closes:
  // on the Remove that opened it after Cancel or Escape, on the list after a
  // removal (that row's Remove is disabled, then gone).
  const opener = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const removed = useRef(false);
  const confirmRemove = () => {
    const row = confirming;
    if (!row) return;
    removed.current = true;
    setConfirming(null);
    remove.mutate(row.address, {
      onSuccess: () =>
        toast.success(`Removed ${row.name}: checked again from the next run`),
      onError: (e) => toast.error(describeApiError(e)),
    });
  };

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
        // Scrolls sideways when a long name would push Remove out of reach.
        <div
          ref={list}
          tabIndex={-1}
          className="overflow-x-auto focus:outline-none"
        >
          <table className="w-full min-w-[520px] text-sm">
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
                  <td className="max-w-[240px] py-2 pr-4 font-medium break-words text-gray-900">
                    {row.name}
                  </td>
                  <td
                    className="py-2 pr-4 font-mono text-xs text-gray-600"
                    title={row.address}
                  >
                    {row.address.slice(0, 8)}…{row.address.slice(-4)}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {formatDateTime(row.addedAt)} · {row.addedBy.split("@")[0]}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={remove.isPending}
                      onClick={(e) => {
                        opener.current = e.currentTarget;
                        setConfirming(row);
                      }}
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
        </div>
      ) : null}
      {/* Radix dialog: moves focus in, keeps it there and announces itself;
          where focus goes on close is set below. */}
      <Dialog
        open={!!confirming}
        onOpenChange={(next) => {
          if (!next) setConfirming(null);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const target = removed.current ? list.current : opener.current;
            removed.current = false;
            opener.current = null;
            if (target?.isConnected) target.focus();
          }}
        >
          <DialogHeader className="min-w-0">
            {/* Wraps an 80-character name with no spaces; clear of the close button. */}
            <DialogTitle className="pr-6 leading-snug [overflow-wrap:anywhere]">
              Remove {confirming?.name ?? "this service"}?
            </DialogTitle>
            <DialogDescription>
              The radar checks{" "}
              <span className="font-mono break-all text-gray-900">
                {confirming?.address}
              </span>{" "}
              for shared cash-outs again from its next run. To add it back, use
              &ldquo;Known service…&rdquo; on its next alert.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded-md border border-[#e6e8ee] px-3 py-1.5 text-[13px] text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRemove}
              className="rounded-md bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-red-700"
            >
              Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfigSection>
  );
}
