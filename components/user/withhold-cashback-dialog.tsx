"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { withholdUserCashback } from "@/lib/api";
import { WithholdCashbackResult } from "@/types";
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
 * Withhold every unpaid cashback row of one user — for accounts found abusing
 * rewards (the Oct 2026 merry.pink account farm).
 *
 * Every Escrowed, Pending or Failed row becomes Ineligible, so neither the
 * escrow nor the retry job pays it. Rows already paid are left alone. The row
 * only reads "Withheld after an account review"; the reason entered here goes
 * on the audit trail, not in front of the cardholder.
 */
export default function WithholdCashbackDialog({
  userId,
  unpaidCount,
}: {
  userId: string;
  unpaidCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<WithholdCashbackResult | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () =>
      (await withholdUserCashback(userId, reason.trim())).data.data,
    onSuccess: (data) => {
      if (data.withheld.length > 0) {
        toast.success(
          `${data.withheld.length} cashback row${
            data.withheld.length === 1 ? "" : "s"
          } withheld`,
        );
      } else {
        toast.info("No unpaid cashback left to withhold");
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
        className="cursor-pointer text-red-700 hover:text-red-800"
      >
        <Ban className="h-3.5 w-3.5" />
        Withhold unpaid
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          {result ? (
            <WithholdOutcome result={result} onDone={close} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Withhold unpaid cashback</DialogTitle>
                <DialogDescription>
                  Cancels this user&apos;s {unpaidCount} unpaid cashback row
                  {unpaidCount === 1 ? "" : "s"} — escrowed, pending or failed —
                  so none of them is paid.
                </DialogDescription>
              </DialogHeader>

              <ul className="space-y-1.5 text-xs text-gray-600">
                <li>
                  For accounts abusing rewards: account farms, self-referrals,
                  spend made only to collect cashback.
                </li>
                <li>
                  Rows already paid stay paid. Cashback this user earns later is
                  not affected — freeze the card to stop that.
                </li>
                <li>
                  The user sees &ldquo;Withheld after an account review&rdquo;
                  on each row. There is no undo from here.
                </li>
              </ul>

              <div className="space-y-2">
                <Label htmlFor="withhold-cashback-reason">Reason</Label>
                <Textarea
                  id="withhold-cashback-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="e.g. merry.pink account farm — Monday ticket 13218630924"
                  disabled={mutation.isPending}
                />
                <p className="text-muted-foreground text-xs">
                  Required. Recorded on the user&apos;s audit trail with your
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
                  variant="destructive"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || !reason.trim()}
                  className="cursor-pointer"
                >
                  {mutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Withhold
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Which rows were withheld. */
function WithholdOutcome({
  result,
  onDone,
}: {
  result: WithholdCashbackResult;
  onDone: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          {result.withheld.length > 0
            ? `${result.withheld.length} row${
                result.withheld.length === 1 ? "" : "s"
              } withheld`
            : "Nothing to withhold"}
        </DialogTitle>
        <DialogDescription>
          {result.withheld.length > 0
            ? "These rows are now Ineligible and will not be paid."
            : "This user has no unpaid cashback left."}
        </DialogDescription>
      </DialogHeader>

      {result.withheld.length > 0 && (
        <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
          {result.withheld.map((row) => (
            <li
              key={row.id}
              className="flex justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <span className="text-gray-900">{row.merchantName || "—"}</span>
              <span className="whitespace-nowrap text-gray-600">
                {Number(row.fiatAmount || 0).toFixed(2)} {row.fiatCurrency} ·{" "}
                was {row.previousStatus}
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
