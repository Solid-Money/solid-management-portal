"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, XCircle } from "lucide-react";

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
import { formatChangeValue } from "@/lib/nudges";
import type { NudgeFieldChange } from "@/types/nudges";

interface NudgeReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  changes: NudgeFieldChange[];
  /** Shown, but do not block the save. */
  warnings?: string[];
  /** Block the save until fixed. */
  errors?: string[];
  reasonMin: number;
  reasonMax: number;
  saving: boolean;
  confirmLabel: string;
  destructive?: boolean;
  /**
   * Shown above the reason, e.g. "someone saved first" with a way to re-apply
   * the edit. While set, confirming is blocked: the save would be refused.
   */
  notice?: ReactNode;
  onConfirm: (reason: string) => void;
}

/**
 * The last look before a nudge or rule change reaches real users: every field
 * that changes, from → to, what to watch out for, and the reason that goes in
 * the history and the audit log.
 */
export function NudgeReviewDialog({
  open,
  onOpenChange,
  title,
  description,
  changes,
  warnings = [],
  errors = [],
  reasonMin,
  reasonMax,
  saving,
  confirmLabel,
  destructive = false,
  notice,
  onConfirm,
}: NudgeReviewDialogProps) {
  const [reason, setReason] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  // A fresh reason each time the dialog opens (adjusted during render, so
  // the old reason never flashes in).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReason("");
  }

  const trimmed = reason.trim();
  const reasonOk = trimmed.length >= reasonMin && trimmed.length <= reasonMax;
  const canConfirm = reasonOk && errors.length === 0 && !saving && !notice;

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {changes.length > 0 ? (
          <div className="max-h-72 overflow-y-auto rounded-md border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Field</th>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 font-medium">To</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.field} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">
                      {change.field}
                    </td>
                    <td className="px-3 py-2 break-words text-gray-500 line-through decoration-gray-300">
                      {formatChangeValue(change.from)}
                    </td>
                    <td className="px-3 py-2 break-words font-medium text-gray-900">
                      {formatChangeValue(change.to)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {errors.length > 0 ? (
          <ul className="space-y-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {errors.map((error) => (
              <li key={error} className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </li>
            ))}
          </ul>
        ) : null}

        {warnings.length > 0 ? (
          <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {warning}
              </li>
            ))}
          </ul>
        ) : null}

        {notice ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {notice}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="nudge-review-reason">Reason</Label>
          <Textarea
            id="nudge-review-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={reasonMax}
            rows={2}
            placeholder="Why, in a sentence. Kept in the history and the audit log."
          />
          <p className="text-xs text-gray-500">
            {trimmed.length < reasonMin
              ? `At least ${reasonMin} characters.`
              : `${trimmed.length}/${reasonMax}`}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => onConfirm(trimmed)}
            disabled={!canConfirm}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
