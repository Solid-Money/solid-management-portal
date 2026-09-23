"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { reinstateUserAccount } from "@/lib/api";
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

interface ReinstateAccountDialogProps {
  userId: string;
  username: string;
}

/**
 * Reopen an account the user closed from the app.
 *
 * The reason is required, unlike a card freeze's: reinstating overrides
 * something the account's owner asked for, so the audit trail has to say on
 * whose word — usually the support ticket where they confirmed it was a
 * mistake.
 */
export default function ReinstateAccountDialog({
  userId,
  username,
}: ReinstateAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const trimmedReason = reason.trim();

  const mutation = useMutation({
    mutationFn: () => reinstateUserAccount(userId, trimmedReason),
    onSuccess: (response) => {
      const { cardSpendingRestored } = response.data.data;
      toast.success(
        cardSpendingRestored
          ? `${username} can sign in again, and their card can spend again`
          : `${username} can sign in again`
      );
      setOpen(false);
      setReason("");
      // The header badge and this banner both read the user record.
      void queryClient.invalidateQueries({ queryKey: ["user", userId] });
      void queryClient.invalidateQueries({ queryKey: ["user-card", userId] });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry or copy the reason.
    },
  });

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <RotateCcw className="h-4 w-4" />
        Reinstate account
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
            <DialogTitle>Reinstate account</DialogTitle>
            <DialogDescription>
              This lets{" "}
              <span className="font-medium text-gray-900">{username}</span> sign
              in again with the passkey or email they already have. It gives
              nobody else access — they still have to sign in as themselves —
              but it does undo something they asked for, so only do it when the
              account&apos;s owner has asked you to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm text-gray-600">
            <p>Closing deleted a few things this does not bring back:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Their card link — they open the Card tab to re-link it. A Rain
                card re-syncs the card they already hold; nothing is reissued.
              </li>
              <li>Two-factor authentication — they set it up again.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reinstate-reason">Reason</Label>
            <Textarea
              id="reinstate-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="e.g. Closed by mistake — owner confirmed on Intercom"
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Required. Recorded in the audit trail with your name and the
              user&apos;s.
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
              disabled={mutation.isPending || !trimmedReason}
              className="cursor-pointer"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Reinstate account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
