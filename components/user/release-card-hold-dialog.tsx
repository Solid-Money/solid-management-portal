"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Unlock } from "lucide-react";
import { toast } from "sonner";

import { releaseUserCardHold } from "@/lib/api";
import { formatUsd } from "@/lib/utils";
import { CardHoldEntry } from "@/types/cash-holds";
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

/** Kinds that are a reservation, not money owed. Anything else needs confirming. */
const PLAIN_KINDS = new Set(["HOLD", "REJECTED"]);

const OWED_WARNINGS: Record<string, string> = {
  DEBIT:
    "Wirex has settled this payment and we have not swept it from the Safe yet. Releasing it lets the cardholder spend money we are about to collect.",
  SWEEP_PENDING:
    "A sweep for this payment is in progress on-chain. Releasing it lets the cardholder spend money that is being collected.",
  ARREARS:
    "This is arrears, a spend we could not collect. Release it only once the debt is recovered or written off.",
};

interface ReleaseCardHoldDialogProps {
  userId: string;
  username: string;
  entry: CardHoldEntry;
}

/**
 * Release one entry from the cardholder's hold store.
 *
 * The usual case is a stale hold: a reservation for a payment Wirex already
 * rejected, which nothing will ever clear and which keeps declining the card
 * for money the user has. The release is checked against the exact entry
 * shown here, so if it moved on in the meantime (a hold whose clearing just
 * arrived) the backend refuses and the list reloads instead of releasing the
 * wrong thing.
 */
export default function ReleaseCardHoldDialog({
  userId,
  username,
  entry,
}: ReleaseCardHoldDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmedOwed, setConfirmedOwed] = useState(false);
  const queryClient = useQueryClient();

  const owed = !PLAIN_KINDS.has(entry.kind);
  const canSubmit = reason.trim().length > 0 && (!owed || confirmedOwed);

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["user-card-holds", userId],
    });
    void queryClient.invalidateQueries({ queryKey: ["user-card", userId] });
  };

  const mutation = useMutation({
    mutationFn: () =>
      releaseUserCardHold(userId, entry.uniqueOperationId, {
        chainId: entry.chainId,
        expectedValue: entry.raw,
        reason: reason.trim(),
        ...(owed && { force: true }),
      }),
    onSuccess: () => {
      toast.success(
        `Released ${formatUsd(entry.amountUsd)} back to ${username}'s card`,
      );
      setOpen(false);
      setReason("");
      setConfirmedOwed(false);
      refresh();
    },
    onError: () => {
      // The API layer already toasts the server's message. A 404 or 409 means
      // the entry moved on, so reload the list to show what it is now.
      refresh();
    },
  });

  return (
    <>
      <Button
        size="sm"
        variant={entry.stale ? "default" : "outline"}
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <Unlock className="h-3.5 w-3.5" />
        Release
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
            <DialogTitle>Release {entry.kind.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Gives{" "}
              <span className="font-medium text-gray-900">
                {formatUsd(entry.amountUsd)}
              </span>{" "}
              back to{" "}
              <span className="font-medium text-gray-900">{username}</span>
              &apos;s card spending power from the next tap.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-2 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
            <div className="col-span-2">
              <dt className="text-gray-500">Operation</dt>
              <dd className="break-all font-mono text-gray-900">
                {entry.uniqueOperationId}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Payment status</dt>
              <dd className="text-gray-900">
                {entry.operation?.status ?? "No record"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Instance</dt>
              <dd className="text-gray-900">{entry.instance}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-500">Why it is here</dt>
              <dd className="text-gray-900">{entry.explanation}</dd>
            </div>
          </dl>

          {owed && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <p className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {OWED_WARNINGS[entry.kind] ??
                    `This is a ${entry.kind} entry, not a plain hold.`}
                </span>
              </p>
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={confirmedOwed}
                  onChange={(event) => setConfirmedOwed(event.target.checked)}
                  disabled={mutation.isPending}
                  className="h-4 w-4 rounded"
                />
                I understand the cardholder can spend this again
              </label>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="release-hold-reason">Reason</Label>
            <Textarea
              id="release-hold-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="e.g. Wirex rejected this payment; the hold was placed after the rejection"
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Recorded on the ledger and in the admin audit log.
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
              Release {formatUsd(entry.amountUsd)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
