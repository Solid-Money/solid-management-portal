"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { recoverUserAccount } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { RecoverAccountResult } from "@/types";
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

interface RecoverAccountDialogProps {
  userId: string;
  username: string;
  /**
   * Whether the account is closed — the trigger only shows then. Passed in
   * rather than deciding whether to mount this at all: a successful recovery
   * refetches the user, which flips this to false, and the outcome view has to
   * outlive that refetch.
   */
  closed: boolean;
  /** When the account was closed, if known. */
  closedAt?: string | null;
}

/** What the user gets back — closure never removed any of it. */
const RESTORED = [
  "Sign-in with the passkey they already have — no new passkey is needed",
  "Their wallet (Safe) and every fund in it",
  "Activity history, rewards points, tier and referrals",
  "Card KYC and card spend history",
  "Card spending, unless the Safe is also blocked for arrears",
];

/** What closure destroyed for good, so support can set expectations. */
const NOT_RESTORED = [
  "Their sessions: they sign in again on each device",
  "Authenticator-app 2FA (TOTP), if they had it: they set it up again",
  "The card link: a Rain card re-links the next time they open Card in the app",
];

/**
 * Reopen an account its owner closed with the in-app "Delete account".
 *
 * The reason is required, unlike the card freeze's: this undoes something the
 * user asked for, so "who reopened it, and on whose word?" has to be on the
 * audit trail. After it runs, the dialog shows what happened — including a
 * card-spend block it deliberately left in place — so support can tell the
 * user exactly where they stand.
 */
export default function RecoverAccountDialog({
  userId,
  username,
  closed,
  closedAt,
}: RecoverAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<RecoverAccountResult | null>(null);
  const queryClient = useQueryClient();

  const trimmedReason = reason.trim();

  const mutation = useMutation({
    mutationFn: async () =>
      (await recoverUserAccount(userId, trimmedReason)).data.data,
    onSuccess: (data) => {
      toast.success(`Account recovered for ${username}`);
      setResult(data);
      setReason("");
      // The profile, the page header and the audit trail all change with it.
      void queryClient.invalidateQueries({ queryKey: ["user", userId] });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["user-card", userId] });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry or copy the reason.
    },
  });

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
    setResult(null);
  };

  return (
    <>
      {closed && (
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className="cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          Recover account
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          {result ? (
            <RecoveryOutcome
              result={result}
              username={username}
              onDone={close}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Recover closed account</DialogTitle>
                <DialogDescription>
                  <span className="font-medium text-gray-900">{username}</span>{" "}
                  closed their account from the app
                  {closedAt ? ` on ${formatDateTime(closedAt)}` : ""}.
                  Recovering reopens it so they can sign in again.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 font-semibold text-gray-900">
                    Comes back
                  </p>
                  <ul className="space-y-1 text-gray-600">
                    {RESTORED.map((item) => (
                      <li key={item} className="flex gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1.5 font-semibold text-gray-900">
                    Does not
                  </p>
                  <ul className="space-y-1 text-gray-600">
                    {NOT_RESTORED.map((item) => (
                      <li key={item} className="flex gap-1.5">
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recover-reason">Reason</Label>
                <Textarea
                  id="recover-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="e.g. Deleted by mistake — confirmed over Intercom from the account's email. Monday ticket 13102189944"
                  disabled={mutation.isPending}
                />
                <p className="text-muted-foreground text-xs">
                  Required. Confirm the request came from the account&apos;s
                  owner first. Recorded in the audit trail and posted to Slack
                  with your name and the user&apos;s.
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
                  disabled={mutation.isPending || !trimmedReason}
                  className="cursor-pointer"
                >
                  {mutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Recover account
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** What the recovery did, in words support can pass on to the user. */
function RecoveryOutcome({
  result,
  username,
  onDone,
}: {
  result: RecoverAccountResult;
  username: string;
  onDone: () => void;
}) {
  const needsCardRelink =
    result.card && !result.card.linked && result.card.issuerCustomerOnFile;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Account recovered
        </DialogTitle>
        <DialogDescription>
          <span className="font-medium text-gray-900">{username}</span> can
          sign in again with their existing passkey, or through email recovery
          if they no longer have it.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2 text-xs">
        {result.cardSpend.remainingBlockReason ? (
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Card spending is still blocked, and was left that way on purpose:{" "}
              <span className="font-medium">
                {result.cardSpend.remainingBlockReason}
              </span>
              . That block predates the closure and has to be cleared by the
              card team once the arrears are recovered.
            </span>
          </div>
        ) : (
          result.cardSpend.blockLifted && (
            <p className="text-gray-600">
              The card-spend block placed at closure was lifted.
            </p>
          )
        )}

        {needsCardRelink && (
          <div className="flex gap-2 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-indigo-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Their card link was removed at closure; the card itself was not
              cancelled. A Rain card re-links the next time they open Card in
              the app. For any other issuer, ask engineering to re-link it.
            </span>
          </div>
        )}

        <p className="text-gray-500">
          Recorded by {result.adminUsername} ·{" "}
          {formatDateTime(result.recoveredAt)}
          {result.closedAt
            ? ` · had been closed since ${formatDateTime(result.closedAt)}`
            : ""}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} className="cursor-pointer">
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
