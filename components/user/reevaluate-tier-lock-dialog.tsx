"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { reevaluateTierLock } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import {
  TierLockReevaluationResult,
  TierLockTrancheValueSource,
} from "@/types";
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

const formatFuse = (amount: number) =>
  `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} FUSE`;

/** Where a tranche's lock-time value came from, in support's words. */
const SOURCE_LABEL: Record<TierLockTrancheValueSource, string> = {
  recorded: "already recorded",
  activity: "from the lock activity",
  live: "today's value (no record found)",
};

/**
 * Support's answer to "I locked 50,000 FUSE and I'm still Core".
 *
 * A lock is graded on what each tranche was worth when it was locked, but only
 * once that value is recorded — and locks from before it was recorded are
 * still graded on the live soFUSE rate, which can dip below what the user
 * paid. This re-reads the lock from the chain, records the missing values and
 * shows the tier before and after. It can only hold a tier up, never take one
 * away, and pressing it twice changes nothing the second time.
 */
export default function ReevaluateTierLockDialog({
  userId,
}: {
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<TierLockReevaluationResult | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () =>
      (await reevaluateTierLock(userId, reason.trim())).data.data,
    onSuccess: (data) => {
      if (data.lockTierAfter !== data.lockTierBefore) {
        toast.success(`Lock now grants ${data.lockTierAfter}`);
      } else {
        toast.info(`Lock still grants ${data.lockTierAfter}`);
      }
      setResult(data);
      setReason("");
      void queryClient.invalidateQueries({
        queryKey: ["user-tier-membership", userId],
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
        Re-evaluate lock
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          {result ? (
            <ReevaluationOutcome result={result} onDone={close} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Re-evaluate locked FUSE</DialogTitle>
                <DialogDescription>
                  Re-reads this user&apos;s lock from the chain and records what
                  each locked tranche was worth when it was locked, so their
                  tier is graded on what they paid rather than on today&apos;s
                  soFUSE rate.
                </DialogDescription>
              </DialogHeader>

              <ul className="space-y-1.5 text-xs text-gray-600">
                <li>
                  Use it when someone locked the price of a tier but is shown a
                  tier lower — usually a lock of exactly 50,000 FUSE on a day
                  the soFUSE rate dipped.
                </li>
                <li>
                  It can only hold a tier up to what was paid for. Nothing is
                  sent on chain and no FUSE moves.
                </li>
                <li>Safe to repeat: a second run changes nothing.</li>
              </ul>

              <div className="space-y-2">
                <Label htmlFor="reevaluate-lock-reason">Reason</Label>
                <Textarea
                  id="reevaluate-lock-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="e.g. Locked 50,000 FUSE, shown Core — Monday ticket 13162452422"
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
                  Re-evaluate
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The tier before and after, and every tranche with where its value came from. */
function ReevaluationOutcome({
  result,
  onDone,
}: {
  result: TierLockReevaluationResult;
  onDone: () => void;
}) {
  const changed = result.lockTierAfter !== result.lockTierBefore;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          {changed
            ? `Lock now grants ${result.lockTierAfter}`
            : `Lock still grants ${result.lockTierAfter}`}
        </DialogTitle>
        <DialogDescription>
          {changed ? `It granted ${result.lockTierBefore} before. ` : ""}
          The user is on {result.currentTier} by every route. The app shows the
          new tier the next time it loads.
        </DialogDescription>
      </DialogHeader>

      {result.tranches.length > 0 ? (
        <ul className="space-y-2">
          {result.tranches.map((tranche) => (
            <li key={tranche.shares}>
              <dl className="grid grid-cols-2 gap-3 rounded-md border border-gray-100 bg-gray-50 p-3 text-xs">
                <div>
                  <dt className="text-gray-500">Worth when locked</dt>
                  <dd className="font-medium text-gray-900">
                    {formatFuse(tranche.fuseAtLock)}
                  </dd>
                  <dd className="text-gray-500">
                    {SOURCE_LABEL[tranche.source]}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Worth today</dt>
                  <dd className="font-medium text-gray-900">
                    {formatFuse(tranche.liveFuse)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Locked</dt>
                  <dd className="font-medium text-gray-900">
                    {tranche.lockedAt ? formatDateTime(tranche.lockedAt) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Unlocks</dt>
                  <dd className="font-medium text-gray-900">
                    {tranche.unlocksAt
                      ? formatDateTime(tranche.unlocksAt)
                      : "—"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">
          Nothing is locked on chain for this user.
        </p>
      )}

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
