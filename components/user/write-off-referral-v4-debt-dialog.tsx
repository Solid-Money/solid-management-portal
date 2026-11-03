"use client";

import { useState } from "react";
import { Eraser, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useWriteOffReferralV4Debt } from "@/hooks/use-referral-v4";
import { formatUtcDay, referralV4StepLabel } from "@/lib/referral-v4";
import { formatUsd } from "@/lib/utils";
import type { AdminReferralV4Debt } from "@/types/referral-v4";
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

const MAX_NOTE_LENGTH = 500;

/**
 * Write off one open referral debt by hand: what is left of it stops being
 * recovered from the user's future bonuses and spend share. Nothing is taken
 * from or given to the user; the debt just closes. The note is optional.
 */
export default function WriteOffReferralV4DebtDialog({
  debt,
}: {
  debt: AdminReferralV4Debt;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const mutation = useWriteOffReferralV4Debt();
  const side = debt.side ?? "—";
  const friend = debt.friend?.username || "unknown";

  const close = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) setNote("");
    setOpen(next);
  };

  const submit = () => {
    const trimmed = note.trim();
    mutation.mutate(
      { debtId: debt.id, note: trimmed || undefined },
      {
        onSuccess: () => {
          toast.success(`Debt of ${formatUsd(debt.remainingUsd)} written off`);
          setNote("");
          setOpen(false);
        },
        // The API layer toasts the server's reason; keep the dialog open.
      },
    );
  };

  return (
    <>
      <Button
        size="xs"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer text-red-700"
      >
        <Eraser />
        Write off
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write off referral debt</DialogTitle>
            <DialogDescription>
              {formatUsd(debt.remainingUsd)} of {formatUsd(debt.amountUsd)} is
              still owed for a reversed{" "}
              {referralV4StepLabel(debt.step).toLowerCase()} bonus ({side} side,
              friend{" "}
              <span className="font-medium text-gray-900">{friend}</span>).
              Writing it off stops recovering it from this user&apos;s future
              bonuses and spend share now, instead of on{" "}
              {formatUtcDay(debt.writeOffAt)}. This can&apos;t be undone from
              here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="write-off-debt-note">Note (optional)</Label>
            <Textarea
              id="write-off-debt-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MAX_NOTE_LENGTH}
              placeholder="e.g. Refund was a merchant error, purchase re-made"
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Recorded on the audit trail with your name. {note.length}/
              {MAX_NOTE_LENGTH}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => close(false)}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={submit}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Write off debt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
