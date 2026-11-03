"use client";

import { useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useCancelReferralV4Reward } from "@/hooks/use-referral-v4";
import { referralV4Status, referralV4StepLabel } from "@/lib/referral-v4";
import { formatUsd } from "@/lib/utils";
import type { AdminReferralV4Reward } from "@/types/referral-v4";
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

const MAX_REASON_LENGTH = 500;

/**
 * Cancel one referral v4 reward that has been earned but not credited — on
 * hold, over the bonus limit, or under review. Credited rewards are already
 * card credit; taking those back is "Remove credit" on the card credit card.
 */
export default function CancelReferralV4RewardDialog({
  reward,
  friendLabel,
}: {
  reward: AdminReferralV4Reward;
  friendLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const mutation = useCancelReferralV4Reward();
  const trimmed = reason.trim();

  const close = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) setReason("");
    setOpen(next);
  };

  const submit = () => {
    if (!trimmed) return;
    mutation.mutate(
      { rewardId: reward.id, reason: trimmed },
      {
        onSuccess: () => {
          toast.success(
            `${referralV4StepLabel(reward.step)} reward for ${friendLabel} cancelled`,
          );
          setReason("");
          setOpen(false);
        },
      },
    );
  };

  return (
    <>
      <Button
        size="xs"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer text-red-700"
      >
        <Ban />
        Cancel
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel referral reward</DialogTitle>
            <DialogDescription>
              The {referralV4StepLabel(reward.step).toLowerCase()} reward (
              {reward.side}, {formatUsd(reward.amountUsd)}) for{" "}
              <span className="font-medium text-gray-900">{friendLabel}</span>{" "}
              is {referralV4Status(reward.status).label.toLowerCase()}.
              Cancelling it means it is never credited. This can&apos;t be
              undone from here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-v4-reason">Reason</Label>
            <Textarea
              id="cancel-v4-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={MAX_REASON_LENGTH}
              placeholder="e.g. Friend shares a device with the referrer — farm account"
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Required. Recorded on the audit trail with your name.{" "}
              {reason.length}/{MAX_REASON_LENGTH}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => close(false)}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={submit}
              disabled={!trimmed || mutation.isPending}
              className="cursor-pointer"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel reward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
