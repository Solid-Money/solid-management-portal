"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { reevaluateReferralReward } from "@/lib/api";
import {
  referralStatus,
  reversalReasonLabel,
  spendBreakdown,
} from "@/lib/referral";
import { formatDateTime, formatUsd } from "@/lib/utils";
import { AdminReferralRewardRow, ReferralReevaluationResult } from "@/types";
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

interface ReevaluateReferralDialogProps {
  /** The reward to re-evaluate — keyed on the referred friend. */
  reward: AdminReferralRewardRow;
  /** How to name the friend in the dialog. */
  friendLabel: string;
  /** The user whose page this is, so their panels refresh afterwards. */
  pageUserId: string;
}

/**
 * Put a reversed or expired referral reward back through the current rules —
 * the "retry" support asked for.
 *
 * Not an override: a reward whose qualifying spend really was refunded stays
 * reversed, and the dialog says what it was measured against. A reinstated
 * reward is never paid from here; it goes back to Qualified and the next
 * payout sweep pays both sides, after the same checks as every other reward.
 */
export default function ReevaluateReferralDialog({
  reward,
  friendLabel,
  pageUserId,
}: ReevaluateReferralDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ReferralReevaluationResult | null>(
    null
  );
  const queryClient = useQueryClient();

  const trimmedReason = reason.trim();
  const isExpired = reward.status === "expired";

  const mutation = useMutation({
    mutationFn: async () =>
      (await reevaluateReferralReward(reward.referredUserId, trimmedReason))
        .data.data,
    onSuccess: (data) => {
      const reinstated =
        data.outcome === "reinstated" || data.outcome === "qualified";
      if (reinstated) {
        toast.success(`Referral reward for ${friendLabel} reinstated`);
      } else {
        toast.info(`The rules still leave ${friendLabel}'s reward as it was`);
      }
      setResult(data);
      setReason("");
      // Both sides of the reward can be on screen: the friend's own row, and
      // the referrer's list. The attempt lands on the friend's audit trail.
      void queryClient.invalidateQueries({
        queryKey: ["user-referrals", pageUserId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", reward.referredUserId],
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
    setResult(null);
  };

  return (
    <>
      {/* Only the trigger depends on the reward still being re-evaluable: a
          reinstatement refetches the row, which flips it, and the outcome view
          has to outlive that refetch. */}
      {reward.canReevaluate && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          className="cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Re-evaluate
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          {result ? (
            <ReevaluationOutcome
              result={result}
              friendLabel={friendLabel}
              onDone={close}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Re-evaluate referral reward</DialogTitle>
                <DialogDescription>
                  The reward for{" "}
                  <span className="font-medium text-gray-900">
                    {friendLabel}
                  </span>{" "}
                  is{" "}
                  <span className="font-medium text-gray-900">
                    {referralStatus(reward.status).label.toLowerCase()}
                  </span>
                  {reward.status === "reversed" &&
                    ` (${reversalReasonLabel(reward.reversalReason).toLowerCase()})`}
                  . This re-reads the friend&apos;s card spend and applies
                  today&apos;s rules to it.
                </DialogDescription>
              </DialogHeader>

              <ul className="space-y-1.5 text-xs text-gray-600">
                {isExpired ? (
                  <>
                    <li>
                      Spend is counted from purchases made inside the
                      friend&apos;s window, including ones that settled after
                      it closed.
                    </li>
                    <li>
                      If they cleared {formatUsd(reward.spendTargetUsd, 0)}{" "}
                      across {reward.merchantTarget} merchants, the reward
                      qualifies today and pays after the usual delay.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      Spend is measured net of refunds against the bar the
                      reward qualified on:{" "}
                      {formatUsd(reward.spendTargetUsd, 0)} across{" "}
                      {reward.merchantTarget} merchants.
                    </li>
                    <li>
                      If it still clears it, the reward goes back to Qualified
                      and the next payout sweep (02:00 UTC) pays both sides.
                      Nothing is sent from here.
                    </li>
                  </>
                )}
                <li>
                  If the rules still say no, nothing changes and you&apos;ll
                  see the figures they were applied to.
                </li>
              </ul>

              <div className="space-y-2">
                <Label htmlFor="reevaluate-reason">Reason</Label>
                <Textarea
                  id="reevaluate-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="e.g. Reward reversed over a small refund — Monday ticket 13058314765"
                  disabled={mutation.isPending}
                />
                <p className="text-muted-foreground text-xs">
                  Required. Recorded on the friend&apos;s audit trail with your
                  name.
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
                  Re-evaluate
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** What the re-evaluation decided, in words support can pass on. */
function ReevaluationOutcome({
  result,
  friendLabel,
  onDone,
}: {
  result: ReferralReevaluationResult;
  friendLabel: string;
  onDone: () => void;
}) {
  const reinstated =
    result.outcome === "reinstated" || result.outcome === "qualified";

  const headline = (() => {
    switch (result.outcome) {
      case "reinstated":
        return result.status === "paid"
          ? "Reinstated — back to paid"
          : "Reinstated — back to qualified";
      case "qualified":
        return "Qualified";
      case "still_reversed":
        return "Still reversed";
      case "still_expired":
        return "Still expired";
    }
  })();

  const explanation = (() => {
    switch (result.outcome) {
      case "reinstated":
        return result.status === "paid"
          ? "Both sides had already been paid before the reward was clawed back, so it is simply marked paid again. Nothing more is sent."
          : `Both sides are paid by the payout sweep${
              result.payoutEtaAt
                ? ` at ${formatDateTime(result.payoutEtaAt)}`
                : ""
            }, after the usual checks.`;
      case "qualified":
        return `${friendLabel} did clear the bar inside their window. Both sides get the "you earned it" push at the next sweep, and the payout follows the usual delay${
          result.payoutEtaAt ? ` (${formatDateTime(result.payoutEtaAt)})` : ""
        }.`;
      case "still_reversed":
        return reversalReasonLabel(result.reversalReason);
      case "still_expired":
        return "Their spend inside the window, net of refunds, did not clear the bar.";
    }
  })();

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {reinstated ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <XCircle className="h-5 w-5 text-gray-400" />
          )}
          {headline}
        </DialogTitle>
        <DialogDescription>{explanation}</DialogDescription>
      </DialogHeader>

      <dl className="grid grid-cols-2 gap-3 rounded-md border border-gray-100 bg-gray-50 p-3 text-xs">
        <div>
          <dt className="text-gray-500">Spend</dt>
          <dd className="font-medium text-gray-900">
            {spendBreakdown(result.spend)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Measured against</dt>
          <dd className="font-medium text-gray-900">
            {formatUsd(result.spendTargetUsd, 0)} across{" "}
            {result.merchantTarget} merchants in {result.qualifyWindowDays}{" "}
            days
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Merchants</dt>
          <dd className="font-medium text-gray-900">
            {result.spend.merchantCount} of {result.merchantTarget}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Status</dt>
          <dd className="font-medium text-gray-900">
            {referralStatus(result.previousStatus).label} →{" "}
            {referralStatus(result.status).label}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-gray-500">
        Recorded on {friendLabel}&apos;s audit trail
        {result.reinstatedBy ? ` by ${result.reinstatedBy}` : ""}.
      </p>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} className="cursor-pointer">
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
