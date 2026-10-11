"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { redactSupportMessage } from "@/lib/support-api";
import type { SupportAgentMessage } from "@/types/support";

/**
 * Redaction is permanent: the text (and its translations) or the files are
 * deleted, a tombstone stays, and the audit log keeps the reason only.
 *
 * Keyed by its target, so each message starts with empty fields.
 */
export default function RedactDialog({
  target,
  conversationId,
  onClose,
}: {
  target: { message: SupportAgentMessage; mode: "message" | "text" } | null;
  conversationId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [words, setWords] = useState("");
  const [reason, setReason] = useState("");

  const redact = useMutation({
    mutationFn: () =>
      redactSupportMessage(target!.message.id, {
        mode: target!.mode,
        ...(target!.mode === "text" ? { text: words } : {}),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success(target?.mode === "text" ? "Words masked" : "Message redacted");
      void queryClient.invalidateQueries({ queryKey: ["support", "conversation", conversationId] });
      onClose();
    },
  });

  const isText = target?.mode === "text";
  const ready = reason.trim().length >= 3 && (!isText || words.trim().length >= 3);

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isText ? "Mask words in this message" : "Redact this message"}</DialogTitle>
          <DialogDescription>
            {isText
              ? "Every occurrence of these exact words is replaced with [redacted], in the original and its translations, for the customer too."
              : "The text, its translations and any files are deleted for good. The customer sees that a message was removed."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {isText && (
            <div className="space-y-1.5">
              <Label htmlFor="redact-words">Words to mask (exactly as written)</Label>
              <Input id="redact-words" value={words} onChange={(event) => setWords(event.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="redact-reason">Reason (kept in the audit log)</Label>
            <Input
              id="redact-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. ID document shared in chat"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!ready || redact.isPending} onClick={() => redact.mutate()}>
            {isText ? "Mask" : "Redact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
