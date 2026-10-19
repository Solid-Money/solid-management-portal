"use client";

import { useState } from "react";
import { HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMonth } from "@/components/analytics/card/card-shared";
import { useRecordCardPayout } from "@/hooks/use-card-analytics";
import { formatUsd } from "@/lib/utils";
import { RAIL_LABELS, type CardRevenueMonth } from "@/types/card-analytics";

/**
 * Record the payout an issuer sent for one billing month.
 *
 * Neither issuer exposes its payout through an API, so the amount that landed
 * is entered by hand from the bank or treasury statement. For Wirex this is the
 * only real FX revenue figure there will ever be, and it is booked to the
 * revenue ledger; for Rain it is reconciled against the month's report.
 * Recording a month again replaces its entry.
 */
export function RecordPayoutDialog({ month }: { month: CardRevenueMonth }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const mutation = useRecordCardPayout();

  const parsed = Number(amount);
  // The API rejects more than six decimal places, so stop it here with a reason
  // rather than at the server with a generic failure.
  const tooPrecise = /\.\d{7,}$/.test(amount.trim());
  const valid =
    amount.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed >= 0 &&
    !tooPrecise &&
    !!receivedAt;

  const reset = () => {
    setAmount("");
    setReference("");
    setNote("");
  };

  const submit = () => {
    if (!valid) return;
    mutation.mutate(
      {
        provider: month.provider,
        billingMonth: month.billingMonth,
        amountUsd: parsed,
        receivedAt: new Date(`${receivedAt}T12:00:00Z`).toISOString(),
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            `Recorded ${formatUsd(parsed)} from ${RAIL_LABELS[month.provider]} for ${formatMonth(
              month.billingMonth
            )}.`
          );
          setOpen(false);
          reset();
        },
        onError: () => toast.error("Could not record the payout."),
      }
    );
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setAmount(month.payout ? String(month.payout.amountUsd) : "");
          setOpen(true);
        }}
        className="cursor-pointer"
      >
        <HandCoins className="h-3.5 w-3.5" />
        {month.payout ? "Edit payout" : "Record payout"}
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
              {RAIL_LABELS[month.provider]} payout — {formatMonth(month.billingMonth)}
            </DialogTitle>
            <DialogDescription>
              Expected{" "}
              <span className="font-medium text-gray-900">
                {formatUsd(month.expectedPayoutUsd)}
              </span>{" "}
              ({month.expectedBasis === "reported" ? "from Rain's report" : "estimated"}).
              {month.provider === "wirex"
                ? " Wirex publishes no report, so this amount is booked as the month's FX revenue."
                : " Checked against the reported FX fees for the month."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payout-amount">Amount received (USD)</Label>
              <Input
                id="payout-amount"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={mutation.isPending}
                aria-invalid={tooPrecise}
              />
              {tooPrecise ? (
                <p className="text-xs text-red-600">Use at most 6 decimal places.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-date">Received on</Label>
              <Input
                id="payout-date"
                type="date"
                value={receivedAt}
                onChange={(event) => setReceivedAt(event.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payout-reference">Reference</Label>
            <Input
              id="payout-reference"
              value={reference}
              maxLength={200}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Bank reference or transaction hash"
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payout-note">Note</Label>
            <Textarea
              id="payout-note"
              value={note}
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Anything that explains a variance"
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Saved with your name. Recording this month again replaces it.
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
              onClick={submit}
              disabled={!valid || mutation.isPending}
              className="cursor-pointer"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RecordPayoutDialog;
