"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { reevaluateFailedCashback } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { ReevaluateFailedCashbackResult } from "@/types";
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
 * Support's answer to "my cashback never arrived" when the row says
 * PermanentlyFailed.
 *
 * A row gives up after five payout attempts, and most of the ones that do gave
 * up because the cashback payout wallet ran dry, not because anything was wrong
 * with the purchase. This puts every PermanentlyFailed row for the user back in
 * the retry queue; the retry cron pays them through the normal payout path —
 * frozen-card, monthly-cap and debt checks included — within 30 minutes.
 * Nothing is sent from here, so pressing it twice cannot pay twice.
 */
export default function ReevaluateFailedCashbackDialog({
  userId,
  permanentlyFailedCount,
}: {
  userId: string;
  permanentlyFailedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ReevaluateFailedCashbackResult | null>(
    null,
  );
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () =>
      (await reevaluateFailedCashback(userId, reason.trim())).data.data,
    onSuccess: (data) => {
      if (data.blockedReason) {
        toast.error("Nothing re-sent — see why in the dialog");
      } else if (data.rearmed.length > 0) {
        toast.success(
          `${data.rearmed.length} cashback row${
            data.rearmed.length === 1 ? "" : "s"
          } queued for payout`,
        );
      } else {
        toast.info("No permanently failed cashback to re-send");
      }
      setResult(data);
      setReason("");
      void queryClient.invalidateQueries({
        queryKey: ["user-cashback", userId],
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
        Re-send failed
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
                <DialogTitle>Re-send failed cashback</DialogTitle>
                <DialogDescription>
                  Puts this user&apos;s {permanentlyFailedCount} permanently
                  failed cashback row
                  {permanentlyFailedCount === 1 ? "" : "s"} back in the payout
                  queue with a fresh set of retries.
                </DialogDescription>
              </DialogHeader>

              <ul className="space-y-1.5 text-xs text-gray-600">
                <li>
                  Use it when the payout gave up because of our side — the error
                  reads &ldquo;Failed to transfer soUSD&rdquo; or
                  &ldquo;insufficient funds&rdquo;. Check the payout wallet is
                  funded first.
                </li>
                <li>
                  The retry job pays each row within 30 minutes at the rate it
                  was earned at. A frozen card, a full monthly cap or an open
                  cashback debt still apply.
                </li>
                <li>
                  Nothing is sent from here, so a second press cannot pay twice.
                </li>
              </ul>

              <div className="space-y-2">
                <Label htmlFor="reevaluate-cashback-reason">Reason</Label>
                <Textarea
                  id="reevaluate-cashback-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="e.g. Payout wallet ran dry Sep 30 — Monday ticket 13181267272"
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
                  Re-send
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Which rows went back in the queue, or why none did. */
function ReevaluationOutcome({
  result,
  onDone,
}: {
  result: ReevaluateFailedCashbackResult;
  onDone: () => void;
}) {
  const blocked = Boolean(result.blockedReason);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {blocked ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )}
          {blocked
            ? "Nothing re-sent"
            : result.rearmed.length > 0
              ? `${result.rearmed.length} row${
                  result.rearmed.length === 1 ? "" : "s"
                } queued for payout`
              : "Nothing to re-send"}
        </DialogTitle>
        <DialogDescription>
          {blocked
            ? result.blockedReason
            : result.rearmed.length > 0
              ? `They pay on the next retry run${
                  result.expectedBy
                    ? `, by ${formatDateTime(result.expectedBy)}`
                    : ""
                }. Each row shows Failed until then, then Paid.`
              : "This user has no permanently failed cashback."}
        </DialogDescription>
      </DialogHeader>

      {result.rearmed.length > 0 && (
        <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
          {result.rearmed.map((row) => (
            <li
              key={row.id}
              className="flex justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <span className="text-gray-900">{row.merchantName || "—"}</span>
              <span className="whitespace-nowrap text-gray-600">
                {Number(row.fiatAmount || 0).toFixed(2)} {row.fiatCurrency}
              </span>
            </li>
          ))}
        </ul>
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
