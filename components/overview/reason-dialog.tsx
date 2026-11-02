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

/** Dismissing or resolving an item always says why; the reason goes to the audit log. */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3;

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
          Reason
        </label>
        <textarea
          id="attention-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="What you found, so the next person knows"
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
            onClick={() => {
              onConfirm(reason.trim());
              setReason("");
            }}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
