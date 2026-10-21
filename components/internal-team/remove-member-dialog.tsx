"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { removeInternalTeamMember } from "@/lib/api";
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

interface RemoveMemberDialogProps {
  userId: string;
  username: string;
}

/**
 * Take someone off the internal team.
 *
 * Reversible — the row moves to Removed and can be restored from there — but
 * the reason is still required: it is what the next admin reads when a tester
 * asks where their team-only features went, and it lands on the user's audit
 * trail with your name.
 */
export default function RemoveMemberDialog({
  userId,
  username,
}: RemoveMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const trimmedReason = reason.trim();

  const mutation = useMutation({
    mutationFn: async () =>
      (await removeInternalTeamMember(userId, trimmedReason)).data.data,
    onSuccess: () => {
      toast.success(`${username} removed from the internal team`);
      setReason("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["internal-team"] });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry or copy the reason.
    },
  });

  const close = () => {
    if (mutation.isPending) return;
    setReason("");
    setOpen(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <UserMinus className="h-3.5 w-3.5" />
        Remove
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from the internal team</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-gray-900">{username}</span> is
              treated like any other user again within a minute: no team-only
              features and no early rollouts. They stay on this page under
              Removed, with this reason, and can be restored from there.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="remove-internal-team-reason">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="remove-internal-team-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why they no longer need team access, e.g. left Solid, or testing finished"
              maxLength={500}
              rows={3}
              disabled={mutation.isPending}
            />
            <p className="text-xs text-gray-500">
              Saved to the audit trail with your name. Required.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={close}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !trimmedReason}
              className="cursor-pointer"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
