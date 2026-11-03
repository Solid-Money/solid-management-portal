"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { resyncUserActivity } from "@/lib/api";
import { ActivityResyncResult } from "@/types";
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

/**
 * Support's answer to "a transfer is missing from my history".
 *
 * The app's sync reads each chain incrementally: only what is new since its
 * last run, and nothing on a chain whose balances have not moved. That keeps
 * the Alchemy bill down, but it never goes back over old transfers, so one
 * dropped by mistake (a token added to the allowlist later, say) stays
 * missing. This clears how far the sync got and reads the newest transfers on
 * every chain again. It only adds rows that are missing, so a second press
 * changes nothing.
 */
export default function ResyncActivityDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActivityResyncResult | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () =>
      (await resyncUserActivity(userId, reason.trim())).data.data,
    onSuccess: (data) => {
      if (data.errors > 0) {
        toast.error("Some chains could not be read — see the dialog");
      } else {
        toast.success("On-chain activity re-read");
      }
      setResult(data);
      setReason("");
      void queryClient.invalidateQueries({
        queryKey: ["user-activity", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry.
    },
  });

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
    setResult(null);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Re-sync on-chain activity
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          {result ? (
            <ResyncOutcome result={result} onDone={close} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Re-sync on-chain activity</DialogTitle>
                <DialogDescription>
                  Reads the newest transfers in and out of this user&apos;s
                  wallet again, on every chain, and adds any that are missing
                  from their activity.
                </DialogDescription>
              </DialogHeader>

              <ul className="space-y-1.5 text-xs text-gray-600">
                <li>
                  Use it when a transfer the user can see on the explorer is not
                  in their history. The app only reads what is new since its
                  last sync, so it will not go back for it by itself.
                </li>
                <li>
                  Rows already in the feed are left as they are, and nothing is
                  removed, so pressing it twice changes nothing.
                </li>
                <li>
                  Covers the newest 100 transfers per chain. Card, deposit and
                  bank activity come from their own records, not from here.
                </li>
              </ul>

              <div className="space-y-2">
                <Label htmlFor="resync-activity-reason">Reason</Label>
                <Textarea
                  id="resync-activity-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="e.g. Base USDC receive missing from history — ticket 13181267272"
                  disabled={mutation.isPending}
                />
                <p className="text-muted-foreground text-xs">
                  Optional. Recorded on the user&apos;s audit trail with your
                  name.
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
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="cursor-pointer"
                >
                  {mutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Re-sync
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** What the fresh read found. */
function ResyncOutcome({
  result,
  onDone,
}: {
  result: ActivityResyncResult;
  onDone: () => void;
}) {
  const failed = result.errors > 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {failed ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )}
          {failed ? "Partly re-synced" : "Activity re-synced"}
        </DialogTitle>
        <DialogDescription>
          {result.synced > 0
            ? `${result.synced} transfer${result.synced === 1 ? "" : "s"} read${
                failed
                  ? "; transfers on the chains that could not be read may still be missing."
                  : "; any that were missing are now in the activity tab."
              }`
            : failed
              ? // A chain that failed has an unknown history, not an empty one.
                "No transfers found on the chains that could be read."
              : "No transfers found on any chain."}
          {failed &&
            ` ${result.errors} chain${
              result.errors === 1 ? "" : "s"
            } could not be read — run it again in a minute.`}
        </DialogDescription>
      </DialogHeader>

      <p className="text-xs text-gray-500">
        Recorded on the user&apos;s audit trail.
      </p>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} className="cursor-pointer">
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
