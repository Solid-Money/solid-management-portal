"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { applyTrialCashbackTerms, getTrialCashbackTerms } from "@/lib/api";
import {
  formatCashbackRate,
  formatMonthlyCap,
} from "@/lib/cashback-percentage";
import { formatDateTime, formatUsd } from "@/lib/utils";
import {
  ApplyTrialCashbackTermsResult,
  TrialCashbackCorrectionPlan,
  TrialCorrectionAction,
  TrialCorrectionRow,
  TrialCorrectionSkipReason,
} from "@/types";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const ACTIONS: Record<
  TrialCorrectionAction,
  { label: string; hint: string; variant: BadgeVariant }
> = {
  rearm: {
    label: "Re-queue",
    hint: "Canceled by the Core cap, or gave up. Goes back in the payout queue on the trial's terms.",
    variant: "info",
  },
  top_up: {
    label: "Top up",
    hint: "Paid short. A new row pays the difference.",
    variant: "success",
  },
  update_terms: {
    label: "Update terms",
    hint: "Not paid yet. Pays on its own date at the trial's terms.",
    variant: "muted",
  },
};

const SKIP_REASONS: Record<TrialCorrectionSkipReason, string> = {
  already_topped_up: "already topped up",
  refunded: "refunded",
  canceled_other: "canceled for another reason",
  ineligible: "not eligible for cashback",
  claimed_correction: "a correction is mid-send",
};

const dayAndTime: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** "3% · $50/mo cap", or the live tier's cap when none is frozen on the row. */
function terms(side: { percentage?: number; monthlyCapUsd?: number }): string {
  return [
    side.percentage !== undefined
      ? formatCashbackRate(side.percentage)
      : "tier rate",
    formatMonthlyCap(side.monthlyCapUsd) ?? "live tier cap",
  ].join(" · ");
}

/**
 * Support's fix for "my trial didn't pay the trial's cashback".
 *
 * A trial's rate and cap are frozen onto each purchase when its cashback row
 * is written, so two kinds of trial purchase miss them: rows written before
 * caps were frozen (Oct 19 2026), which fall back to the cap of the tier held
 * on payout day, and purchases the card issuer posted inside the trial but
 * reported after it ended. This finds every purchase made during the user's
 * trials and offers to put the trial's terms back on it, never lowering
 * anything. Nothing is sent from here: the hourly escrow run pays re-queued
 * rows and top-ups through the normal payout path, monthly cap included.
 */
export default function TrialCashbackTermsDialog({
  userId,
}: {
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  // Everything is selected until the admin unticks it.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ApplyTrialCashbackTermsResult | null>(
    null,
  );
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error } = useQuery<{
    data: TrialCashbackCorrectionPlan;
  }>({
    queryKey: ["user-trial-cashback-terms", userId],
    queryFn: async () => (await getTrialCashbackTerms(userId)).data,
    enabled: open,
    // A preview is only good for the moment it was read.
    staleTime: 0,
  });

  const plan = data?.data;
  const rows = useMemo(() => plan?.rows ?? [], [plan]);
  const selectedRows = rows.filter((row) => !deselected.has(row.cashbackId));
  const selectedUsd = selectedRows.reduce(
    (sum, row) => sum + row.additionalUsd,
    0,
  );
  const blocked = Boolean(plan?.blockedReason);
  const headerChecked =
    selectedRows.length === rows.length
      ? true
      : selectedRows.length === 0
        ? false
        : "indeterminate";

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await applyTrialCashbackTerms(
          userId,
          selectedRows.map((row) => row.cashbackId),
          reason.trim(),
        )
      ).data.data,
    onSuccess: (outcome) => {
      if (outcome.blockedReason) {
        toast.error("Nothing applied — see why in the dialog");
      } else if (outcome.applied.length > 0) {
        toast.success(
          `Trial terms applied to ${outcome.applied.length} row${
            outcome.applied.length === 1 ? "" : "s"
          }`,
        );
      } else {
        toast.info("Nothing applied — every row changed since the preview");
      }
      setResult(outcome);
      setReason("");
      for (const key of [
        "user-cashback",
        "user-audit-log",
        "user-trial-cashback-terms",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key, userId] });
      }
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry.
    },
  });

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
    setResult(null);
    setDeselected(new Set());
  };

  const toggleRow = (id: string, checked: boolean) =>
    setDeselected((previous) => {
      const next = new Set(previous);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (checked: boolean) =>
    setDeselected(
      checked ? new Set() : new Set(rows.map((row) => row.cashbackId)),
    );

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <Gift className="h-3.5 w-3.5" />
        Trial terms
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent className="sm:max-w-4xl">
          {result ? (
            <ApplyOutcome result={result} onDone={close} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Apply trial cashback terms</DialogTitle>
                <DialogDescription>
                  Purchases made during this user&apos;s tier trial earn the
                  trial tier&apos;s rate and monthly cap. These did not.
                </DialogDescription>
              </DialogHeader>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                </div>
              ) : error || !plan ? (
                <p className="text-sm text-red-600">
                  Failed to load the trial&apos;s purchases.
                </p>
              ) : (
                <div className="space-y-4">
                  {plan.trials.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      This user has never started a tier trial.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs text-gray-600">
                      {plan.trials.map((trial) => (
                        <li key={trial.trialId}>
                          <span className="font-medium text-gray-900 capitalize">
                            {trial.tier}
                          </span>{" "}
                          · {formatCashbackRate(trial.percentage)} ·{" "}
                          {formatMonthlyCap(trial.monthlyCapUsd)} ·{" "}
                          {formatDateTime(trial.activatedAt, dayAndTime)} →{" "}
                          {formatDateTime(trial.endedAt, dayAndTime)}
                        </li>
                      ))}
                    </ul>
                  )}

                  {blocked && (
                    <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {plan.blockedReason}
                    </p>
                  )}

                  {rows.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Nothing to correct
                      {plan.alreadyCorrect > 0
                        ? ` — all ${plan.alreadyCorrect} trial purchase${
                            plan.alreadyCorrect === 1 ? "" : "s"
                          } already carry the trial's terms.`
                        : "."}
                    </p>
                  ) : (
                    <div className="max-h-[45vh] overflow-auto rounded-md border border-gray-200 [&_[data-slot=table-container]]:overflow-visible">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)]">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-10">
                              <Checkbox
                                checked={headerChecked}
                                onCheckedChange={(value) =>
                                  toggleAll(value === true)
                                }
                                disabled={blocked}
                                aria-label="Select every row"
                              />
                            </TableHead>
                            <TableHead>Purchased</TableHead>
                            <TableHead>Merchant</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead>Now</TableHead>
                            <TableHead>Correction</TableHead>
                            <TableHead className="text-right">Adds</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <CorrectionRow
                              key={row.cashbackId}
                              row={row}
                              checked={!deselected.has(row.cashbackId)}
                              disabled={blocked}
                              onCheckedChange={(checked) =>
                                toggleRow(row.cashbackId, checked)
                              }
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {(plan.alreadyCorrect > 0 || plan.skipped.length > 0) &&
                    rows.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {plan.alreadyCorrect > 0 &&
                          `${plan.alreadyCorrect} other trial purchase${
                            plan.alreadyCorrect === 1 ? "" : "s"
                          } already carry the trial's terms. `}
                        {plan.skipped.length > 0 &&
                          `Left alone: ${plan.skipped
                            .map(
                              (row) =>
                                `${row.merchantName ?? "purchase"} (${
                                  SKIP_REASONS[row.reason] ?? row.reason
                                })`,
                            )
                            .join(", ")}.`}
                      </p>
                    )}

                  {rows.length > 0 && (
                    <>
                      <ul className="space-y-1.5 text-xs text-gray-600">
                        <li>
                          Nothing is sent from here. Re-queued rows and top-ups
                          pay on the next hourly payout run, through the normal
                          payout path.
                        </li>
                        <li>
                          The monthly cap still applies, now the trial&apos;s
                          rather than Core&apos;s, so the month can pay less
                          than the total shown. Purchases after the trial keep
                          Core&apos;s cap.
                        </li>
                        <li>
                          Safe to repeat: a row already corrected is not offered
                          again.
                        </li>
                      </ul>

                      <div className="space-y-2">
                        <Label htmlFor="trial-terms-reason">Reason</Label>
                        <Textarea
                          id="trial-terms-reason"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          maxLength={500}
                          placeholder="e.g. Prime trial purchases capped at Core — Monday ticket 13354414651"
                          disabled={mutation.isPending || blocked}
                        />
                        <p className="text-muted-foreground text-xs">
                          Optional. Recorded on the user&apos;s audit trail with
                          your name.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              <DialogFooter className="items-center sm:justify-between">
                <span className="text-sm text-gray-600">
                  {selectedRows.length > 0 &&
                    `Up to ${formatUsd(selectedUsd)} more, before the cap`}
                </span>
                <div className="flex gap-2">
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
                    disabled={
                      mutation.isPending ||
                      isFetching ||
                      blocked ||
                      selectedRows.length === 0
                    }
                    className="cursor-pointer"
                  >
                    {mutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Apply to {selectedRows.length} row
                    {selectedRows.length === 1 ? "" : "s"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CorrectionRow({
  row,
  checked,
  disabled,
  onCheckedChange,
}: {
  row: TrialCorrectionRow;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const action = ACTIONS[row.action];
  const spend = Number(row.fiatAmount);

  return (
    <TableRow data-state={checked ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          disabled={disabled}
          aria-label={`Select ${row.merchantName ?? "purchase"} of ${
            row.fiatAmount
          }`}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-gray-600">
        {formatDateTime(row.purchasedAt, dayAndTime)}
      </TableCell>
      <TableCell className="max-w-48 truncate" title={row.merchantName}>
        {row.merchantName ?? "—"}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap tabular-nums">
        {Number.isFinite(spend) ? spend.toFixed(2) : row.fiatAmount}{" "}
        {row.fiatCurrency.toUpperCase()}
      </TableCell>
      <TableCell>
        <Badge variant="muted">{row.status}</Badge>
        {row.paidUsd !== undefined && (
          <div className="mt-0.5 text-xs text-gray-500">
            paid {formatUsd(row.paidUsd)} of {formatUsd(row.owedUsd)}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={action.variant} title={action.hint}>
          {action.label}
        </Badge>
        <div className="mt-0.5 text-xs whitespace-nowrap text-gray-500">
          {terms(row.from)} → {terms(row.to)}
        </div>
      </TableCell>
      <TableCell className="text-right font-medium whitespace-nowrap text-gray-900 tabular-nums">
        {row.additionalUsd > 0 ? formatUsd(row.additionalUsd) : "—"}
      </TableCell>
    </TableRow>
  );
}

/** What was applied, what was skipped, and when it pays. */
function ApplyOutcome({
  result,
  onDone,
}: {
  result: ApplyTrialCashbackTermsResult;
  onDone: () => void;
}) {
  const blocked = Boolean(result.blockedReason);
  const nothingApplied = blocked || result.applied.length === 0;
  const queued = result.applied.filter((row) => row.action !== "update_terms");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {nothingApplied ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )}
          {nothingApplied
            ? "Nothing applied"
            : `Trial terms applied to ${result.applied.length} row${
                result.applied.length === 1 ? "" : "s"
              }`}
        </DialogTitle>
        <DialogDescription>
          {blocked
            ? result.blockedReason
            : result.applied.length === 0
              ? "Every selected row was paid, re-queued or corrected since the preview. Open the dialog again to see what is left."
              : queued.length > 0
                ? `Up to ${formatUsd(result.additionalUsd)} more pays on the next hourly payout run${
                    result.expectedBy
                      ? `, by ${formatDateTime(result.expectedBy)}`
                      : ""
                  }, as far as the trial's monthly cap allows.`
                : "The rows pay on their own payout dates at the trial's terms."}
        </DialogDescription>
      </DialogHeader>

      {result.applied.length > 0 && (
        <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
          {result.applied.map((row) => (
            <li
              key={row.cashbackId}
              className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <span className="text-gray-900">
                {row.merchantName || "—"}{" "}
                <span className="text-gray-500">
                  {Number(row.fiatAmount || 0).toFixed(2)}{" "}
                  {row.fiatCurrency.toUpperCase()}
                </span>
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Badge variant={ACTIONS[row.action].variant}>
                  {ACTIONS[row.action].label}
                </Badge>
                {row.additionalUsd > 0 && formatUsd(row.additionalUsd)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result.skipped.length > 0 && (
        <p className="text-xs text-amber-700">
          {result.skipped.length} row{result.skipped.length === 1 ? "" : "s"}{" "}
          skipped: paid, re-queued or corrected since the preview.
        </p>
      )}

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
