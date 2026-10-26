"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

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

export interface ReasonDialogRequest {
  title: string;
  description: React.ReactNode;
  confirmText: string;
  destructive?: boolean;
  /** Asks for a new monthly limit too, which must be below this one. */
  limitBelowUsd?: number;
}

/**
 * Confirms an AI API admin action and asks why.
 *
 * The reason is required: it goes on the user's audit trail with your name,
 * and it is what the next admin reads when the user asks why their agents
 * stopped.
 */
export default function ReasonDialog({
  request,
  pending,
  onConfirm,
  onCancel,
}: {
  request: ReasonDialogRequest | null;
  pending: boolean;
  onConfirm: (input: { reason: string; monthlyLimitUsd?: number }) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => (!open && !pending ? onCancel() : undefined)}
    >
      <DialogContent>
        {/* Keyed on the title so each action starts with an empty form, while a
            failed save keeps the reason the admin typed. */}
        {request ? (
          <ReasonForm
            key={request.title}
            request={request}
            pending={pending}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({
  request,
  pending,
  onConfirm,
  onCancel,
}: {
  request: ReasonDialogRequest;
  pending: boolean;
  onConfirm: (input: { reason: string; monthlyLimitUsd?: number }) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [limit, setLimit] = useState("");

  const trimmed = reason.trim();
  const asksLimit = request.limitBelowUsd !== undefined;
  const parsedLimit = Number(limit);
  const limitValid =
    !asksLimit ||
    (Number.isInteger(parsedLimit) &&
      parsedLimit >= 1 &&
      parsedLimit < (request.limitBelowUsd ?? 0));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{request.title}</DialogTitle>
        <DialogDescription>{request.description}</DialogDescription>
      </DialogHeader>

      {asksLimit ? (
        <div className="grid gap-2">
          <Label htmlFor="ai-api-limit">New monthly limit (USD)</Label>
          <Input
            id="ai-api-limit"
            inputMode="numeric"
            value={limit}
            onChange={(event) =>
              setLimit(event.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder={`1 to ${(request.limitBelowUsd ?? 1) - 1}`}
            disabled={pending}
          />
          {limit && !limitValid ? (
            <p className="text-xs text-red-600">
              A whole number below the current ${request.limitBelowUsd}. Only
              the user can raise a limit.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="ai-api-reason">
          Reason <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="ai-api-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="What happened, e.g. the user asked us to, or the key looked compromised"
          maxLength={500}
          rows={3}
          disabled={pending}
        />
        <p className="text-xs text-gray-500">
          Saved to the user&apos;s audit trail with your name. Required.
        </p>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={pending}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          variant={request.destructive ? "destructive" : "default"}
          onClick={() =>
            onConfirm({
              reason: trimmed,
              monthlyLimitUsd: asksLimit ? parsedLimit : undefined,
            })
          }
          disabled={pending || !trimmed || !limitValid || (asksLimit && !limit)}
          className="cursor-pointer"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {request.confirmText}
        </Button>
      </DialogFooter>
    </>
  );
}
