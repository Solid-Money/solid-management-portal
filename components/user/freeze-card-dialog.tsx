"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Snowflake, Sun } from "lucide-react";
import { toast } from "sonner";

import { setUserCardFreeze } from "@/lib/api";
import { UserCardOverview } from "@/types";
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

interface FreezeCardDialogProps {
  userId: string;
  username: string;
  card: UserCardOverview;
}

/**
 * Freeze / unfreeze a user's card on their behalf.
 *
 * The reason is optional but strongly encouraged: it is written to the admin
 * audit trail and posted to Slack alongside who did it and to whom, which is
 * what makes "why is this card frozen?" answerable a week later.
 */
export default function FreezeCardDialog({
  userId,
  username,
  card,
}: FreezeCardDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const freezing = !card.frozen;

  const mutation = useMutation({
    mutationFn: () => setUserCardFreeze(userId, freezing, reason.trim()),
    onSuccess: () => {
      toast.success(
        freezing
          ? `Card frozen for ${username}`
          : `Card unfrozen for ${username}`
      );
      setOpen(false);
      setReason("");
      // The card panel, the freeze history and the balances all move together.
      void queryClient.invalidateQueries({ queryKey: ["user-card", userId] });
      void queryClient.invalidateQueries({
        queryKey: ["user-freeze-history", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-balances", userId],
      });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry or copy the reason.
    },
  });

  return (
    <>
      <Button
        variant={freezing ? "destructive" : "default"}
        size="sm"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        {freezing ? (
          <Snowflake className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
        {freezing ? "Freeze card" : "Unfreeze card"}
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
            <DialogTitle>
              {freezing ? "Freeze card" : "Unfreeze card"}
            </DialogTitle>
            <DialogDescription>
              {freezing ? (
                <>
                  This blocks every new authorization on{" "}
                  <span className="font-medium text-gray-900">{username}</span>
                  &apos;s {card.provider ?? "card"} immediately. Because support
                  is freezing it, the cardholder will not be able to unfreeze it
                  themselves in the app.
                </>
              ) : (
                <>
                  This lets{" "}
                  <span className="font-medium text-gray-900">{username}</span>{" "}
                  spend on their {card.provider ?? "card"} again.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="freeze-reason">
              Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="freeze-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder={
                freezing
                  ? "e.g. Cardholder reported the card lost on Intercom"
                  : "e.g. Cardholder confirmed the card was found"
              }
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Recorded in the audit trail and posted to Slack with your name and
              the user&apos;s.
            </p>
          </div>

          {card.freezeInitiator === "customer" && !freezing && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The cardholder froze this card themselves and can unfreeze it in
                the app. Check they asked you to do it for them.
              </span>
            </div>
          )}

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
              variant={freezing ? "destructive" : "default"}
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {freezing ? "Freeze card" : "Unfreeze card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
