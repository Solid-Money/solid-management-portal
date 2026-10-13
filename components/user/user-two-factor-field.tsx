"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { getTwoFactorStatus, resetTwoFactor } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { TwoFactorStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
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

interface UserTwoFactorFieldProps {
  userId: string;
  username: string;
}

/** "set up Oct 11, 2026 · last used Oct 11, 2026", or as much of it as is known. */
function enrollmentDetail(status: TwoFactorStatus): string {
  return [
    status.enrolledAt ? `set up ${formatDateTime(status.enrolledAt)}` : null,
    status.lastUsedAt
      ? `last used ${formatDateTime(status.lastUsedAt)}`
      : "never used",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Authenticator-app 2FA on the profile: whether it is on, and the reset for an
 * owner who lost the device it lived on.
 *
 * The app has no way to turn 2FA off, and turning it off would need a code
 * anyway — so without this, a lost authenticator blocks every send for good
 * and the only fix was a hand edit in the database with no record of it.
 */
export default function UserTwoFactorField({
  userId,
  username,
}: UserTwoFactorFieldProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["user-two-factor", userId],
    queryFn: async () => (await getTwoFactorStatus(userId)).data.data,
  });

  if (isLoading) {
    return (
      <span className="flex items-center gap-1.5 text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking…
      </span>
    );
  }

  if (isError || !data) {
    return (
      <span className="text-xs text-red-600">
        Two-factor status could not be loaded.
      </span>
    );
  }

  if (!data.enrolled) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">Off</Badge>
        <span className="text-gray-600">No authenticator app set up.</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {data.verified ? (
          <Badge variant="success">On</Badge>
        ) : (
          <Badge variant="warning">Setup not finished</Badge>
        )}
        {data.locked && (
          <Badge variant="danger">
            Locked
            {data.lockedUntil
              ? ` until ${formatDateTime(data.lockedUntil, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : ""}
          </Badge>
        )}
        <span className="text-gray-600">{enrollmentDetail(data)}</span>
        <span className="ml-auto">
          <ResetTwoFactorDialog
            userId={userId}
            username={username}
            status={data}
          />
        </span>
      </div>
      {data.verified ? (
        <p className="text-xs text-gray-500">
          Every send asks for a code from their authenticator app.
          {data.failedAttempts > 0 &&
            ` ${data.failedAttempts} wrong code${
              data.failedAttempts === 1 ? "" : "s"
            } since the last good one.`}
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          Started but never confirmed with a code, so sends do not ask for one
          yet.
        </p>
      )}
    </div>
  );
}

/**
 * Remove the authenticator, on the owner's word.
 *
 * Deliberately as heavy as changing the recovery email: this takes a
 * protection off the account, so the username has to be typed back and the
 * reason — how the owner was verified — is required, recorded in the audit
 * trail and posted to Slack with the admin's name.
 */
function ResetTwoFactorDialog({
  userId,
  username,
  status,
}: {
  userId: string;
  username: string;
  status: TwoFactorStatus;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const queryClient = useQueryClient();

  const trimmedReason = reason.trim();
  const confirmed = confirmation.trim() === username;
  const ready = !!trimmedReason && confirmed;

  const mutation = useMutation({
    mutationFn: async () =>
      (await resetTwoFactor(userId, trimmedReason)).data.data,
    onSuccess: () => {
      toast.success(`2FA reset for ${username}`);
      setReason("");
      setConfirmation("");
      setOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["user-two-factor", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry or copy the reason.
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
        onClick={() => setOpen(true)}
      >
        <ShieldOff className="h-4 w-4" />
        Reset 2FA
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset two-factor authentication</DialogTitle>
            <DialogDescription>
              Removes the authenticator app from{" "}
              <span className="font-medium text-gray-900">{username}</span> (
              {enrollmentDetail(status)}). Their sends stop asking for a code,
              and they can set 2FA up again from Settings → Security →
              Authenticator app.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This takes a protection off the wallet: after it, the passkey
              alone can send. Only reset once you have confirmed the request
              came from the account&apos;s owner — not just someone holding
              their phone or their session — and check the devices that used the
              account recently first.
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-2fa-reason">
              Reason, and how you verified the owner
            </Label>
            <Textarea
              id="reset-2fa-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="e.g. Lost the phone with their authenticator. Confirmed over Intercom from the account's email. Intercom <conversation id>"
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Required. Recorded in the audit trail and posted to Slack with
              your name.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-2fa-confirm">
              Type <span className="font-mono">{username}</span> to confirm
            </Label>
            <Input
              id="reset-2fa-confirm"
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
              Reset 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
