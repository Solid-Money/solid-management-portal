"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { correctCashbackTier, previewCashbackTierCorrection } from "@/lib/api";
import {
  describeCashbackRate,
  formatCashbackRate,
  formatMonthlyCap,
} from "@/lib/cashback-percentage";
import { formatDateTime, formatUsd } from "@/lib/utils";
import {
  CashbackEntry,
  CashbackTierCorrectionPlan,
  CashbackTierCorrectionResult,
} from "@/types";
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

/** The tiers a purchase can be corrected to, lowest first. */
const TIERS = ["core", "prime", "ultra"] as const;

const tierLabel = (tier: string) =>
  tier.charAt(0).toUpperCase() + tier.slice(1);

/**
 * Whether a row could be corrected at all, judged from what the table has.
 *
 * Only a coarse filter for showing the button: the backend decides, and the
 * preview says why when it refuses. Correction rows, subscription discounts and
 * rates set by hand are never tier cashback, so the button is not offered.
 */
export function isTierCorrectable(entry: CashbackEntry): boolean {
  return (
    !entry.transactionId.includes(":") &&
    entry.type !== "SubscriptionDiscount" &&
    (entry.cashbackPercentageSource === undefined ||
      entry.cashbackPercentageSource === "Tier") &&
    ["Pending", "Escrowed", "Failed", "Paid", "DeductedFromDebt"].includes(
      entry.status,
    )
  );
}

/**
 * Support's answer to "this purchase paid at the wrong tier".
 *
 * A purchase's cashback rate and cap are frozen from the tier the cardholder
 * held the minute it accrued. When that tier was briefly wrong — a FUSE lock
 * graded a fraction of a FUSE under Ultra after a soFUSE rate dip — this puts
 * the purchase on the tier it should have had. Still owed, its rate and cap
 * are moved; already paid, a top-up for the difference is escrowed and paid by
 * the next payout run. It only ever raises a purchase, and a paid purchase can
 * be topped up once.
 *
 * Mounted only while open, so each opening previews the row afresh.
 */
export default function CorrectCashbackTierDialog({
  userId,
  entry,
  onClose,
}: {
  userId: string;
  entry: CashbackEntry;
  onClose: () => void;
}) {
  // Undefined until support picks one: the backend then answers for the tier
  // the cardholder holds now, which is the usual correction.
  const [tier, setTier] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<CashbackTierCorrectionResult | null>(
    null,
  );
  const queryClient = useQueryClient();

  const preview = useQuery({
    queryKey: [
      "cashback-tier-correction",
      userId,
      entry.transactionId,
      tier ?? "current",
    ],
    queryFn: async () =>
      (await previewCashbackTierCorrection(userId, entry.transactionId, tier))
        .data.data,
    enabled: !result,
    staleTime: 0,
    retry: false,
  });
  const plan = preview.data;
  const selectedTier = tier ?? plan?.tier;

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await correctCashbackTier(
          userId,
          entry.transactionId,
          selectedTier as string,
          reason.trim(),
        )
      ).data.data,
    onSuccess: (data) => {
      toast.success(
        data.action === "top_up" && data.topUpUsd !== null
          ? `${formatUsd(data.topUpUsd)} top-up escrowed at ${tierLabel(data.tier)}`
          : `Cashback re-priced to ${tierLabel(data.tier)}`,
      );
      setResult(data);
      void queryClient.invalidateQueries({
        queryKey: ["user-cashback", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry.
    },
  });

  const close = () => {
    if (mutation.isPending) return;
    onClose();
  };

  const previewLoading = preview.isPending || preview.isFetching;
  const canPress =
    !mutation.isPending &&
    !previewLoading &&
    plan !== undefined &&
    plan.action !== "none" &&
    selectedTier !== undefined &&
    reason.trim().length > 0;

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent>
        {result ? (
          <CorrectionOutcome result={result} onDone={close} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Correct cashback tier</DialogTitle>
              <DialogDescription>
                {entry.merchantName || "This purchase"} ·{" "}
                {Number(entry.fiatAmount || 0).toFixed(2)} {entry.fiatCurrency}{" "}
                · {formatDateTime(entry.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <ul className="space-y-1.5 text-xs text-gray-600">
              <li>
                For a purchase made while the cardholder&apos;s tier was briefly
                wrong — for example a FUSE lock graded just under a threshold
                after a soFUSE rate dip.
              </li>
              <li>
                Only ever raises a purchase. Still owed, it is re-priced; already
                paid, the difference is escrowed and paid on the next payout
                run.
              </li>
            </ul>

            <div className="space-y-2">
              <Label>Tier it should have accrued at</Label>
              <div className="flex gap-2">
                {TIERS.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={selectedTier === option ? "default" : "outline"}
                    onClick={() => setTier(option)}
                    disabled={mutation.isPending}
                    className="cursor-pointer"
                  >
                    {tierLabel(option)}
                    {plan?.currentTier === option ? " (now)" : ""}
                  </Button>
                ))}
              </div>
            </div>

            <PlanSummary plan={plan} isLoading={previewLoading} />

            <div className="space-y-2">
              <Label htmlFor="correct-cashback-tier-reason">Reason</Label>
              <Textarea
                id="correct-cashback-tier-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder="e.g. Lock graded 0.43 FUSE under Ultra after a rate dip — Monday 13379399457"
                disabled={mutation.isPending}
              />
              <p className="text-muted-foreground text-xs">
                Required. Recorded on the user&apos;s audit trail with your
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
                disabled={!canPress}
                className="cursor-pointer"
              >
                {mutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {plan?.action === "top_up" && plan.topUpUsd !== null
                  ? `Escrow ${formatUsd(plan.topUpUsd)} top-up`
                  : "Re-price"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The row's terms, the tier's, and what pressing would do — or why not. */
function PlanSummary({
  plan,
  isLoading,
}: {
  plan: CashbackTierCorrectionPlan | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Reading the purchase&apos;s cashback…
      </p>
    );
  }

  // A failed read has already been toasted with the server's message.
  if (!plan) return null;

  const terms = (rate: string, cap: string | undefined) =>
    [rate, cap].filter(Boolean).join(" · ");

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-3 rounded-md border border-gray-100 bg-gray-50 p-3 text-xs">
        <div>
          <dt className="text-gray-500">Now ({plan.status})</dt>
          <dd className="font-medium text-gray-900">
            {terms(
              describeCashbackRate(
                plan.percentage,
                plan.percentageSource ?? undefined,
              ),
              formatMonthlyCap(plan.monthlyCapUsd),
            )}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">{tierLabel(plan.tier)} pays</dt>
          <dd className="font-medium text-gray-900">
            {terms(
              formatCashbackRate(plan.tierPercentage),
              formatMonthlyCap(plan.tierMonthlyCapUsd),
            )}
          </dd>
          <dd className="text-gray-500">
            {formatUsd(plan.owedUsd)} on this purchase, before the cap
          </dd>
        </div>
      </dl>

      {plan.action === "none" ? (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{plan.reason}</p>
        </div>
      ) : plan.action === "reprice" ? (
        <p className="rounded-md border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
          Still owed: its rate moves to{" "}
          {formatCashbackRate(plan.tierPercentage)}
          {plan.monthlyCapUsd === null ||
          plan.tierMonthlyCapUsd > plan.monthlyCapUsd
            ? ` and its cap to ${formatMonthlyCap(plan.tierMonthlyCapUsd)}`
            : ""}
          , and it pays through its normal escrow.
        </p>
      ) : (
        <p className="rounded-md border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
          Already paid {formatUsd(plan.paidUsd ?? 0)}. A top-up of{" "}
          <strong>{formatUsd(plan.topUpUsd ?? 0)}</strong> is escrowed as{" "}
          <code className="break-all">{plan.topUpTransactionId}</code> and paid
          on the next payout run, against this purchase&apos;s monthly cap.
        </p>
      )}
    </div>
  );
}

function CorrectionOutcome({
  result,
  onDone,
}: {
  result: CashbackTierCorrectionResult;
  onDone: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          {result.action === "top_up"
            ? "Top-up escrowed"
            : "Cashback re-priced"}
        </DialogTitle>
        <DialogDescription>
          {result.action === "top_up" && result.topUpUsd !== null
            ? `${formatUsd(result.topUpUsd)} at ${tierLabel(result.tier)}, paid on the next payout run as ${result.correctedTransactionId}.`
            : `Now earns ${formatCashbackRate(result.tierPercentage)} at ${tierLabel(result.tier)}, paid through its normal escrow.`}
        </DialogDescription>
      </DialogHeader>

      <p className="text-xs text-gray-500">
        Recorded on the user&apos;s audit trail.
      </p>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} className="cursor-pointer">
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
