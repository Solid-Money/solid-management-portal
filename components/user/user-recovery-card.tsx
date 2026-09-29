"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  getRecoveryEligibility,
  sendRecoveryCode,
  setAccountEmail,
} from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { RecoveryEligibility } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface UserRecoveryCardProps {
  userId: string;
  username: string;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/**
 * Whether this user can get back into their account, and the two things support
 * can do about it when they cannot.
 *
 * Separate from the "Recover account" button on the profile header, which
 * reopens an account its owner *closed* — that account can sign in the moment
 * it reopens. This card is for the account that was never closed and still
 * cannot be reached: the passkey is gone from the device, and self-serve
 * recovery either is not reachable or has nowhere to send a code.
 */
export default function UserRecoveryCard({
  userId,
  username,
}: UserRecoveryCardProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user-recovery-eligibility", userId],
    queryFn: async () => (await getRecoveryEligibility(userId)).data.data,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["user-recovery-eligibility", userId],
    });
    void queryClient.invalidateQueries({ queryKey: ["user", userId] });
    void queryClient.invalidateQueries({ queryKey: ["user-audit-log", userId] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Account access
        </CardTitle>
        {data && (
          <Badge variant={data.canSelfRecover ? "success" : "warning"}>
            {data.canSelfRecover ? "Can self-recover" : "Needs support"}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking…
          </p>
        )}

        {data && (
          <>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Email on file"
                value={
                  data.hasEmail ? (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {data.emailHint}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <XCircle className="h-3.5 w-3.5" />
                      None
                    </span>
                  )
                }
                hint="Where a recovery code would go"
              />
              <Stat
                label="Passkeys (Turnkey)"
                value={
                  data.turnkeyCredentialCount === null
                    ? "Unknown"
                    : data.turnkeyCredentialCount
                }
                hint={
                  data.turnkeyCredentialCount === null
                    ? "Turnkey could not be reached"
                    : `${data.storedCredentialCount} remembered on the account row`
                }
              />
              <Stat
                label="Last seen"
                value={
                  data.lastActivityAt
                    ? formatDateTime(data.lastActivityAt)
                    : "Never"
                }
                hint={data.platforms?.join(", ") || undefined}
              />
            </dl>

            {data.blockers.length > 0 && (
              <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {data.blockers.map((blocker) => (
                  <li key={blocker} className="flex gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {blocker}
                  </li>
                ))}
              </ul>
            )}

            {data.canSelfRecover && (
              <p className="text-xs text-gray-500">
                Point them at the Recover your account link on the sign-in
                screen. They can enter either their email or{" "}
                <span className="font-medium text-gray-900">{username}</span>.
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              <SendCodeDialog
                userId={userId}
                username={username}
                eligibility={data}
                onDone={refresh}
              />
              <SetEmailDialog
                userId={userId}
                username={username}
                eligibility={data}
                onDone={refresh}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Mail the account's own address a recovery code.
 *
 * Safe by construction: the code goes to the inbox on file and never comes
 * back here, so this starts a recovery for its owner rather than handing access
 * to whoever asked. The reason is still required — it is support reaching into
 * someone's account, and the trail has to say who and why.
 */
function SendCodeDialog({
  userId,
  username,
  eligibility,
  onDone,
}: {
  userId: string;
  username: string;
  eligibility: RecoveryEligibility;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();

  const mutation = useMutation({
    mutationFn: async () =>
      (await sendRecoveryCode(userId, trimmedReason)).data.data,
    onSuccess: (result) => {
      toast.success(`Recovery code sent to ${result.emailHint}`);
      setReason("");
      setOpen(false);
      onDone();
    },
  });

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="cursor-pointer"
        disabled={!eligibility.hasEmail}
        title={
          eligibility.hasEmail
            ? undefined
            : "No email on file — set one first"
        }
        onClick={() => setOpen(true)}
      >
        <Mail className="h-4 w-4" />
        Send recovery code
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a recovery code</DialogTitle>
            <DialogDescription>
              Mails{" "}
              <span className="font-medium text-gray-900">
                {eligibility.emailHint}
              </span>{" "}
              the same six-digit code the recovery screen sends. It goes to{" "}
              <span className="font-medium text-gray-900">{username}</span> and
              nowhere else — you will not see it, so read it back to them only
              from their own inbox.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="send-code-reason">Reason</Label>
            <Textarea
              id="send-code-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="e.g. Lost their phone, can't reach the recovery screen. Intercom 215476131794861"
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Required. Recorded in the audit trail and posted to Slack with
              your name.
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
              Send code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Set or correct the address this account recovers through.
 *
 * The sharpest thing on this page. Whoever holds the address can start a
 * recovery, and a recovery adds a passkey that can move the wallet — so the
 * confirmation is deliberately heavier than everything around it: the username
 * has to be typed back, the reason is required, and both addresses go into the
 * audit trail unmasked.
 */
function SetEmailDialog({
  userId,
  username,
  eligibility,
  onDone,
}: {
  userId: string;
  username: string;
  eligibility: RecoveryEligibility;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedReason = reason.trim();
  const confirmed = confirmation.trim() === username;
  const ready = !!trimmedEmail && !!trimmedReason && confirmed;

  const mutation = useMutation({
    mutationFn: async () =>
      (await setAccountEmail(userId, trimmedEmail, trimmedReason)).data.data,
    onSuccess: (result) => {
      toast.success(`Recovery email set to ${result.emailHint}`);
      reset();
      setOpen(false);
      onDone();
    },
  });

  const reset = () => {
    setEmail("");
    setReason("");
    setConfirmation("");
  };

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <AlertTriangle className="h-4 w-4" />
        {eligibility.hasEmail ? "Change recovery email" : "Set recovery email"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {eligibility.hasEmail ? "Change" : "Set"} the recovery email
            </DialogTitle>
            <DialogDescription>
              Currently{" "}
              <span className="font-medium text-gray-900">
                {eligibility.emailHint ?? "no address on file"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Whoever holds this address can start a recovery, and a recovery
              adds a passkey that can move this wallet. Only set it once you
              have confirmed the request came from the account&apos;s owner by
              some other means.
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recovery-email">New recovery email</Label>
            <Input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@example.com"
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Refused if another account already holds it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="set-email-reason">
              Reason, and how you verified the owner
            </Label>
            <Textarea
              id="set-email-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="e.g. No email on the account. Owner verified over a video call against their ID. Intercom 215476131555421"
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="set-email-confirm">
              Type <span className="font-mono">{username}</span> to confirm
            </Label>
            <Input
              id="set-email-confirm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={username}
              disabled={mutation.isPending}
            />
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
              disabled={mutation.isPending || !ready}
              className="cursor-pointer"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {eligibility.hasEmail ? "Change email" : "Set email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
