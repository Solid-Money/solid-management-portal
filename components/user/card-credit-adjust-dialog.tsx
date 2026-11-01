"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAdjustCardCredit } from "@/hooks/use-referral-v4";
import { formatUsd } from "@/lib/utils";
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

/** The most one grant can give, mirroring the backend's bound. */
export const MAX_CARD_CREDIT_GRANT_USD = 500;
const MAX_REASON_LENGTH = 500;

interface CardCreditAdjustDialogProps {
  userId: string;
  username: string;
  mode: "grant" | "remove";
  /** Credit available right now — the most that can be removed. */
  availableUsd: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Grant or remove card credit by hand.
 *
 * Checked here with the backend's own bounds — a grant is more than $0 and at
 * most $500, a removal at most what is available — so a typo is caught before
 * it is sent. The reason is required and is recorded on the ledger entry and
 * the audit trail with the admin's name, which the backend takes from the
 * Firebase token.
 */
export default function CardCreditAdjustDialog({
  userId,
  username,
  mode,
  availableUsd,
  open,
  onOpenChange,
}: CardCreditAdjustDialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const mutation = useAdjustCardCredit(userId, mode);

  const isGrant = mode === "grant";
  const max = isGrant ? MAX_CARD_CREDIT_GRANT_USD : availableUsd;
  const parsed = Number(amount);
  const trimmedReason = reason.trim();

  const amountError = (() => {
    if (amount.trim() === "") return null;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return "Enter an amount above $0.";
    }
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      return "Use a plain amount with at most two decimals.";
    }
    if (parsed > max) {
      return isGrant
        ? `A single grant is at most ${formatUsd(MAX_CARD_CREDIT_GRANT_USD, 0)}.`
        : `Only ${formatUsd(availableUsd)} is available to remove.`;
    }
    return null;
  })();

  const canSubmit =
    amount.trim() !== "" &&
    !amountError &&
    trimmedReason.length > 0 &&
    !mutation.isPending;

  const close = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) {
      setAmount("");
      setReason("");
    }
    onOpenChange(next);
  };

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate(
      { amountUsd: parsed, reason: trimmedReason },
      {
        onSuccess: () => {
          toast.success(
            isGrant
              ? `Granted ${formatUsd(parsed)} card credit to ${username}`
              : `Removed ${formatUsd(parsed)} card credit from ${username}`,
          );
          setAmount("");
          setReason("");
          onOpenChange(false);
        },
        // The API layer already toasts the server's reason; keep the dialog
        // open so the admin can correct and retry.
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isGrant ? "Grant card credit" : "Remove card credit"}
          </DialogTitle>
          <DialogDescription>
            {isGrant ? (
              <>
                Credit for{" "}
                <span className="font-medium text-gray-900">{username}</span>{" "}
                to spend with their Wirex card. It is used first on their next
                purchases, can&apos;t be withdrawn, sent or swapped, and
                doesn&apos;t expire.
              </>
            ) : (
              <>
                Take credit back from{" "}
                <span className="font-medium text-gray-900">{username}</span>.
                Only what is available can be removed —{" "}
                {formatUsd(availableUsd)} right now; credit held by a pending
                purchase can&apos;t be.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="card-credit-amount">Amount (USD)</Label>
          <Input
            id="card-credit-amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            max={max}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={isGrant ? "e.g. 10" : formatUsd(availableUsd)}
            disabled={mutation.isPending}
            aria-invalid={!!amountError}
          />
          {amountError ? (
            <p className="text-xs text-red-600">{amountError}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {isGrant
                ? `More than $0, at most ${formatUsd(MAX_CARD_CREDIT_GRANT_USD, 0)}.`
                : `More than $0, at most ${formatUsd(availableUsd)}.`}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-credit-reason">Reason</Label>
          <Textarea
            id="card-credit-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={MAX_REASON_LENGTH}
            placeholder={
              isGrant
                ? "e.g. Goodwill for the failed payment — Intercom 12345"
                : "e.g. Granted by mistake twice — see entry from Nov 3"
            }
            disabled={mutation.isPending}
          />
          <p className="text-muted-foreground text-xs">
            Required. Recorded on the ledger and the audit trail with your
            name. {reason.length}/{MAX_REASON_LENGTH}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => close(false)}
            disabled={mutation.isPending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant={isGrant ? "default" : "destructive"}
            onClick={submit}
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isGrant ? "Grant credit" : "Remove credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
