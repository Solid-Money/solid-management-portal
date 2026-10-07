"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { acknowledgeRefill, formatAmount, truncateAddress } from "@/lib/wallets";
import { WalletAssetPlan } from "@/types";

/**
 * The queue of top-ups to make, one screen at a time.
 *
 * One at a time rather than a list because the task is physical — open a
 * wallet, scan or paste an address, pick the right chain, send a specific
 * amount — and a list of twelve of those invites doing two of them to the same
 * address. Each screen carries exactly what one transfer needs and nothing
 * from the next one.
 */
export default function RefillModal({
  items,
  open,
  onClose,
}: {
  items: WalletAssetPlan[];
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const queryClient = useQueryClient();

  const current = items[index];
  const total = items.length;

  const acknowledge = useMutation({
    mutationFn: (item: WalletAssetPlan) =>
      acknowledgeRefill(item.walletName, {
        chainId: item.chainId,
        asset: item.asset,
        amount: item.plan?.refillAmount,
      }),
    onSuccess: () => {
      if (index + 1 < total) {
        setIndex((position) => position + 1);
        return;
      }
      // Last one: the board is re-read so the next render reflects whatever
      // has actually landed on chain, which is not necessarily all of it.
      void queryClient.invalidateQueries({ queryKey: ["wallet-plans"] });
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-audit"] });
      toast.success("Refills recorded. Balances will update as they arrive.");
      onClose();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not record that refill"),
  });

  const amount = useMemo(() => {
    if (!current) return undefined;
    const planned = current.plan?.refillAmount;
    // Where no cost has been measured there is no target to compute from, so
    // the configured threshold is the honest answer and the screen says so.
    return planned && planned > 0 ? planned : Number(current.threshold);
  }, [current]);

  if (!current) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setIndex(0);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{current.walletName}</DialogTitle>
          <DialogDescription className="flex items-center gap-1 font-mono text-xs">
            {truncateAddress(current.address)}
            <CopyButton value={current.address} label="Wallet address" />
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {/* The address, scannable. Rendered as SVG so it stays crisp on a
              phone camera at any pixel ratio. */}
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <QRCodeSVG value={current.address} size={200} level="M" />
          </div>

          <dl className="w-full space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-gray-500">Transfer</dt>
              <dd className="font-medium text-gray-900">
                {amount != null ? formatAmount(amount) : "—"} {current.symbol}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-gray-500">Chain</dt>
              <dd className="text-gray-900">{current.chainName}</dd>
            </div>

            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-gray-500">
                {current.tokenAddress ? "Contract" : "Token"}
              </dt>
              <dd className="flex items-center gap-1 font-mono text-xs text-gray-900">
                {current.tokenAddress
                  ? truncateAddress(current.tokenAddress)
                  : `${current.symbol} (native)`}
                {current.explorerUrl && (
                  <a
                    href={current.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800"
                    aria-label={`Open ${current.symbol} on the block explorer`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </dd>
            </div>
          </dl>

          <p className="w-full rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Confirm Paid records that you sent this. It does not mark the wallet
            funded — the balance below updates when the transfer lands on chain.
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">
            {index + 1} / {total}
          </span>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIndex((position) => position - 1)}
                disabled={acknowledge.isPending}
              >
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => acknowledge.mutate(current)}
              disabled={acknowledge.isPending}
            >
              {acknowledge.isPending && (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              )}
              Confirm Paid
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
