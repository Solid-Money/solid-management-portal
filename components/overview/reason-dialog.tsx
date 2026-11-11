"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Dismissing or resolving an item always says why; the reason goes to the
 * audit log. Also asks for a known service's name (`label`, `placeholder`,
 * `minLength`, `maxLength`, one line).
 */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
  label = "Reason",
  placeholder = "What you found, so the next person knows",
  minLength = 3,
  maxLength = 500,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  label?: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= minLength;

  // Cleared when the dialog closes, not on confirm: a failed action leaves it
  // open with the reason still there to retry.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setReason("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label
          className="text-[13px] font-medium text-gray-700"
          htmlFor="attention-reason"
        >
          {label}
        </label>
        <textarea
          id="attention-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={maxLength}
          rows={maxLength <= 100 ? 1 : 3}
          placeholder={placeholder}
          className="w-full rounded-md border border-[#e6e8ee] px-3 py-2 text-[13px] outline-none focus:border-[#3b3bd6]"
        />
        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              setReason("");
              onCancel();
            }}
            className="rounded-md border border-[#e6e8ee] px-3 py-1.5 text-[13px] text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || pending}
            onClick={() => onConfirm(reason.trim())}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
