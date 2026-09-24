"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { unblockCardSpend } from "@/lib/api";
import { CardSpendBlock } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UnblockCardSpendDialogProps {
  userId: string;
  username: string;
  block: CardSpendBlock & { safeAddress: string };
}

/**
 * Lift the card-spend block a failed sweep set.
 *
 * The block is what turns an uncollected spend into a bounded loss: with it
 * on, every new tap is declined before the chain is even read. So the dialog
 * asks support to confirm the arrears are dealt with, and says plainly what
 * unblocking does not do: it leaves the arrears hold pinned.
 */
export default function UnblockCardSpendDialog({
  userId,
  username,
  block,
}: UnblockCardSpendDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => unblockCardSpend(block.safeAddress),
    onSuccess: () => {
      toast.success(`Card spending unblocked for ${username}`);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["user-card", userId] });
      void queryClient.invalidateQueries({
        queryKey: ["user-balances", userId],
      });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry.
    },
  });

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <ShieldCheck className="h-4 w-4" />
        Unblock spending
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
            <DialogTitle>Unblock card spending</DialogTitle>
            <DialogDescription>
              This lets{" "}
              <span className="font-medium text-gray-900">{username}</span>
              &apos;s card authorize again from the next tap.
            </DialogDescription>
          </DialogHeader>

          {block.reason && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
              <p className="font-medium text-gray-500">Blocked because</p>
              <p className="mt-1 break-words font-mono text-gray-900">
                {block.reason}
              </p>
            </div>
          )}

          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Only unblock once the arrears are recovered or written off.
              Unblocking does not clear the arrears hold: it stays pinned and
              keeps counting against their spending power, shown as On hold.
            </span>
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
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Unblock spending
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
