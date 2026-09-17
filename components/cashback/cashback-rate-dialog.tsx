"use client";

import { useState } from "react";
import { Loader2, Percent } from "lucide-react";

import {
  fromPercentInput,
  formatCashbackRate,
  MAX_CASHBACK_PERCENT,
  toPercentInput,
} from "@/lib/cashback-percentage";
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

interface CashbackRateDialogProps {
  /**
   * Always `true` in practice: the form seeds itself on mount, so mount this
   * only while it is open rather than leaving it mounted and toggling.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One or two sentences on what this rate applies to and what it displaces. */
  description: React.ReactNode;
  /** The rate currently pinned at this level, as a fraction. */
  current?: number | null;
  /** The rate that applies when nothing is pinned here, as a fraction. */
  fallback?: number | null;
  /** What `fallback` is — "their tier", "this user's rate". */
  fallbackLabel: string;
  isSaving: boolean;
  /** `null` clears the override; a number is a fraction. */
  onSubmit: (percentage: number | null, reason?: string) => void;
}

/**
 * Set or clear a cashback rate, at whichever level the caller is editing.
 *
 * ## Percent in, fraction out
 *
 * The field is a percentage because that is what an operator thinks in and what
 * every other rate screen in this dashboard shows; the API takes a fraction.
 * The conversion is `lib/cashback-percentage`, and the field is bounded to
 * 0–100 here as well as server-side — entering `3` meaning 3% and having it
 * stored as 300% is the one mistake worth two guards.
 *
 * ## Why "clear" is its own button
 *
 * Emptying the field and saving is ambiguous: it reads equally as "no override"
 * and "I have not typed anything yet". A separate action makes removing the
 * override deliberate, which matters because clearing and setting 0% are
 * different decisions — one hands the level below back its say, the other means
 * this earns nothing.
 *
 * Mount it only while it is open. The field seeds itself from `current` on
 * mount and never re-seeds, so a dialog left mounted across edits would show
 * the previous transaction's rate.
 */
export default function CashbackRateDialog({
  open,
  onOpenChange,
  title,
  description,
  current,
  fallback,
  fallbackLabel,
  isSaving,
  onSubmit,
}: CashbackRateDialogProps) {
  // Seeded once, on mount. Callers mount this only while it is open (see the
  // note on the props), so every edit starts from what is actually set rather
  // than from whatever was typed into the last one.
  const [percent, setPercent] = useState(() => toPercentInput(current));
  const [reason, setReason] = useState("");

  const parsed = fromPercentInput(percent);
  const isBlank = percent.trim() === "";
  const isInvalid = !isBlank && parsed === undefined;

  const submit = (percentage: number | null) => {
    onSubmit(percentage, reason.trim() || undefined);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-gray-400" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cashback-rate">Cashback rate</Label>
          <div className="relative">
            <Input
              id="cashback-rate"
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_CASHBACK_PERCENT}
              step="0.01"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              placeholder={toPercentInput(fallback) || "3"}
              disabled={isSaving}
              className="pr-7"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-gray-500">
              %
            </span>
          </div>
          {isInvalid ? (
            <p className="text-xs text-red-600">
              Enter a percentage between 0 and {MAX_CASHBACK_PERCENT}. This is a
              percentage, not a fraction — type 3 for 3%.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {fallbackLabel} pays {formatCashbackRate(fallback)}. Setting 0% is
              not the same as clearing: it means this earns nothing.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cashback-rate-reason">
            Reason <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="cashback-rate-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="e.g. Goodwill after the failed payout on 12 Aug"
            disabled={isSaving}
          />
          <p className="text-muted-foreground text-xs">
            Recorded in the audit trail with your name.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={() => submit(null)}
            disabled={isSaving || current === null || current === undefined}
            className="cursor-pointer"
          >
            Clear override
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => parsed !== undefined && submit(parsed)}
              disabled={isSaving || isBlank || isInvalid}
              className="cursor-pointer"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save rate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
