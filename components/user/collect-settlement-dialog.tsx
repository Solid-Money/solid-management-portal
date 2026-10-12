"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { collectUserSettlement } from "@/lib/api";
import { formatUsd } from "@/lib/utils";
import { UncollectedSettlement } from "@/types/cash-collect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CollectSettlementDialogProps {
  userId: string;
  username: string;
  settlement: UncollectedSettlement;
  /** What the Safe can cover right now, when the chain could be read. */
  spendableUsd?: number;
}

/**
 * Collect one card spend Wirex paid for and we never swept.
 *
 * This moves the cardholder's money: it books the debit and starts the same
 * sweep an approved settlement would have. So it asks for a reason, says
 * plainly what the Safe can cover, and makes a shortfall an explicit choice: a
 * sweep the Safe cannot cover fails into arrears and blocks the card.
 */
export default function CollectSettlementDialog({
  userId,
  username,
  settlement,
  spendableUsd,
}: CollectSettlementDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmedShortfall, setConfirmedShortfall] = useState(false);
  const queryClient = useQueryClient();

  const shortfall =
    typeof spendableUsd === "number" && spendableUsd < settlement.amountUsd;
  const canSubmit =
    reason.trim().length > 0 && (!shortfall || confirmedShortfall);

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["user-card-uncollected", userId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["user-card-holds", userId],
    });
    void queryClient.invalidateQueries({ queryKey: ["user-card", userId] });
  };

  const mutation = useMutation({
    mutationFn: () =>
      collectUserSettlement(userId, settlement.uniqueOperationId, {
        reason: reason.trim(),
        ...(shortfall && { force: true }),
      }),
    onSuccess: () => {
      toast.success(
        `Collecting ${formatUsd(settlement.amountUsd)} from ${username}'s Safe. The sweep confirms in a few seconds.`,
      );
      setOpen(false);
      setReason("");
      setConfirmedShortfall(false);
      refresh();
    },
    onError: () => {
      // The API layer already toasts the server's message. A conflict means
      // the Safe or the operation moved on, so reload to show it.
      refresh();
    },
  });

  if (settlement.unsupportedReason) {
    return (
      <span className="text-[11px] text-gray-500">
        {settlement.unsupportedReason}
      </span>
    );
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <HandCoins className="h-3.5 w-3.5" />
        Collect
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (mutation.isPending) return;
          setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect from Safe</DialogTitle>
            <DialogDescription>
              Sweeps{" "}
              <span className="font-medium text-gray-900">
                {formatUsd(settlement.amountUsd)}
              </span>{" "}
              from <span className="font-medium text-gray-900">{username}</span>
              &apos;s Safe for a card spend Wirex already paid.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-2 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
            <div className="col-span-2">
              <dt className="text-gray-500">Operation</dt>
              <dd className="break-all font-mono text-gray-900">
                {settlement.uniqueOperationId}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Safe can cover now</dt>
              <dd className="text-gray-900">
                {typeof spendableUsd === "number"
                  ? formatUsd(spendableUsd)
                  : "Could not read"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Refunds already paid</dt>
              <dd className="text-gray-900">
                {formatUsd(settlement.refundsPaidUsd)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-500">Why it is owed</dt>
              <dd className="text-gray-900">{settlement.explanation}</dd>
            </div>
          </dl>

          {shortfall && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <p className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  The Safe cannot cover this right now. The sweep will fail into
                  arrears and block the card until it is recovered.
                </span>
              </p>
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={confirmedShortfall}
                  onChange={(event) =>
                    setConfirmedShortfall(event.target.checked)
                  }
                  disabled={mutation.isPending}
                  className="h-4 w-4 rounded"
                />
                Collect anyway and block the card
              </label>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="collect-reason">Reason</Label>
            <Textarea
              id="collect-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="e.g. Mandatory clearing refused at settle; Wirex debited the Master Account"
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Recorded on the payment, the ledger and the admin audit log.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit || mutation.isPending}
              className="cursor-pointer"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Collect {formatUsd(settlement.amountUsd)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
