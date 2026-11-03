"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  Loader2,
  LockOpen,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  getUserCard,
  setUserCardFreeze,
  suspendUserAccount,
  unsuspendUserAccount,
} from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { AccountSuspension, UserCardOverview } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

interface SuspendAccountDialogProps {
  userId: string;
  username: string;
  /**
   * The current suspension, or null when there is none. Decides which action
   * the trigger offers. Passed in rather than deciding whether to mount this at
   * all, so the dialog survives the refetch its own success causes.
   */
  suspension: AccountSuspension | null;
}

/** What a suspension stops. */
const BLOCKED = [
  "Every request from the app, on every device, within about 15 seconds",
  "Signing in, refreshing a session and email recovery",
  "Support chat and live updates",
  "Their current sessions — they are ended, and stay ended after a lift",
];

/** What a suspension leaves alone, so lifting it is a clean undo. */
const KEPT = [
  "Their passkeys — they sign back in with them once it is lifted",
  "The wallet (Safe) and every fund in it",
  "Activity, rewards, tier and referrals",
  "The card — freeze it separately (below) to stop spending",
];

const MAX_REASON = 500;

/**
 * Suspend an account, or lift its suspension — the reversible block.
 *
 * The reason is required both ways: suspending locks someone out of their
 * account and lifting lets them back in, so "who, and on whose word?" has to
 * be on the audit trail. Card spending is a separate control (the card panel's
 * freeze); this offers to freeze it in the same step, since a block that still
 * lets the card spend is rarely what an operator means.
 */
export default function SuspendAccountDialog({
  userId,
  username,
  suspension,
}: SuspendAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [freezeCard, setFreezeCard] = useState(true);
  const queryClient = useQueryClient();

  const suspending = !suspension;
  const trimmedReason = reason.trim();

  // The same query the page runs for its card panel, so this is usually a cache hit.
  const { data: card } = useQuery<{ data: UserCardOverview }>({
    queryKey: ["user-card", userId],
    queryFn: async () => (await getUserCard(userId)).data,
    enabled: open && suspending,
  });
  const canFreezeCard = Boolean(card?.data?.hasCard && !card.data.frozen);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["user", userId] });
    void queryClient.invalidateQueries({ queryKey: ["user-audit-log", userId] });
    void queryClient.invalidateQueries({ queryKey: ["user-card", userId] });
    void queryClient.invalidateQueries({
      queryKey: ["user-recovery-eligibility", userId],
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!suspending) {
        await unsuspendUserAccount(userId, trimmedReason);
        return { cardFrozen: false, cardFreezeFailed: false };
      }

      await suspendUserAccount(userId, trimmedReason);
      if (!(freezeCard && canFreezeCard)) {
        return { cardFrozen: false, cardFreezeFailed: false };
      }
      // After the suspension, never instead of it: a card that could not be
      // frozen must not undo or hide a suspension that went through.
      try {
        await setUserCardFreeze(
          userId,
          true,
          `Account suspended: ${trimmedReason}`.slice(0, MAX_REASON),
        );
        return { cardFrozen: true, cardFreezeFailed: false };
      } catch {
        return { cardFrozen: false, cardFreezeFailed: true };
      }
    },
    onSuccess: ({ cardFrozen, cardFreezeFailed }) => {
      if (suspending) {
        toast.success(
          cardFrozen
            ? `${username} suspended and their card frozen`
            : `${username} suspended`,
        );
        if (cardFreezeFailed) {
          toast.warning(
            "The account is suspended, but the card could not be frozen. Freeze it from the Card panel.",
          );
        }
      } else {
        toast.success(`Suspension lifted for ${username}`);
      }
      setReason("");
      setOpen(false);
      refresh();
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry or copy the reason.
      refresh();
    },
  });

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
  };

  return (
    <>
      {suspending ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          className="cursor-pointer border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
        >
          <Ban className="h-4 w-4" />
          Suspend account
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          className="cursor-pointer"
        >
          <LockOpen className="h-4 w-4" />
          Lift suspension
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {suspending ? "Suspend account" : "Lift suspension"}
            </DialogTitle>
            <DialogDescription>
              {suspending ? (
                <>
                  <span className="font-medium text-gray-900">{username}</span>{" "}
                  will be locked out of Solid until the suspension is lifted.
                  Nothing in the account is deleted.
                </>
              ) : (
                <>
                  <span className="font-medium text-gray-900">{username}</span>{" "}
                  will be able to sign in again with the passkey they already
                  have.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {suspending ? (
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <p className="mb-1.5 font-semibold text-gray-900">Stops</p>
                <ul className="space-y-1 text-gray-600">
                  {BLOCKED.map((item) => (
                    <li key={item} className="flex gap-1.5">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 font-semibold text-gray-900">Keeps</p>
                <ul className="space-y-1 text-gray-600">
                  {KEPT.map((item) => (
                    <li key={item} className="flex gap-1.5">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-muted-foreground sm:col-span-2">
                The wallet is self-custodial: a passkey they already hold can
                still sign transactions outside the Solid app. Suspension blocks
                Solid, not the chain.
              </p>
            </div>
          ) : (
            suspension && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p>
                    Suspended by {suspension.adminEmail} on{" "}
                    {formatDateTime(suspension.at)}:{" "}
                    <span className="font-medium">{suspension.reason}</span>
                  </p>
                  <p>
                    Lifting does not unfreeze their card. If it was frozen with
                    the suspension, unfreeze it from the Card panel.
                  </p>
                </div>
              </div>
            )
          )}

          <div className="space-y-2">
            <Label htmlFor="suspension-reason">Reason</Label>
            <Textarea
              id="suspension-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={MAX_REASON}
              placeholder={
                suspending
                  ? "e.g. Prompt-injection probing of Solid AI targeting another user's OTP — monday 13426726620"
                  : "e.g. Reviewed with security; owner verified over Intercom from the account's email"
              }
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Required. Recorded in the audit trail and posted to Slack with
              your name and the user&apos;s.
            </p>
          </div>

          {suspending && canFreezeCard && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="suspension-freeze-card"
                checked={freezeCard}
                onCheckedChange={(value) => setFreezeCard(value === true)}
                disabled={mutation.isPending}
              />
              <Label
                htmlFor="suspension-freeze-card"
                className="text-sm font-normal leading-snug"
              >
                Also freeze their {card?.data?.provider ?? ""} card, so it
                cannot be spent while the account is suspended
              </Label>
            </div>
          )}

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
              variant={suspending ? "destructive" : "default"}
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !trimmedReason}
              className="cursor-pointer"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {suspending ? "Suspend account" : "Lift suspension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
