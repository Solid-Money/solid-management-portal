"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { toast } from "sonner";

import { batchIssueTierTrials } from "@/lib/api";
import {
  tierTrialBatchOutcomeLabel,
  tierTrialBatchOutcomeVariant,
} from "@/lib/tier-trial";
import {
  BatchIssueTierTrialRequest,
  BatchIssueTierTrialResult,
  TierTrialBatchOutcome,
} from "@/types";
import TierTrialDialog from "@/components/user/tier-trial-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * The order the totals are read in: what went out first, then what did not.
 *
 * Every outcome is shown even at zero. "0 failed" is worth seeing — it is the
 * answer to the question the operator actually has after pressing send.
 */
const OUTCOME_ORDER: TierTrialBatchOutcome[] = [
  "gifted",
  "extended",
  "replaced",
  "skipped",
  "not_found",
  "duplicate",
  "failed",
];

/**
 * Gift the same tier trial to a list of users at once. Moved here from its own
 * Config → Tier Trials page; `/tier-trials` redirects to this section.
 *
 * ## Why this exists
 *
 * A trial gifted from a user's profile is one user at a time, which is right
 * when support is answering that user. A campaign — every user who hit the
 * card issue in September, the hundred names marketing came back with — is the
 * same gift four hundred times, and doing that by hand is where a
 * mistyped duration or a forgotten reason gets in.
 *
 * ## What it does not do
 *
 * It is not a job queue. The batch runs inside the request and reports when it
 * is done, capped at a size that keeps that honest. What it does guarantee is
 * that no single username can cost the rest their gift: a name nobody holds, a
 * user who already has a trial, a failure on one row — each comes back as its
 * own line in the results, and the others go out regardless.
 *
 * The result table is deliberately kept on screen after the run rather than
 * collapsing into a toast: "who didn't get it, and why" is the whole question,
 * and the answer is the list.
 */
export default function TierTrialsBulk() {
  const [isGiftOpen, setIsGiftOpen] = useState(false);
  const [result, setResult] = useState<BatchIssueTierTrialResult | null>(null);

  const batch = useMutation({
    mutationFn: async (request: BatchIssueTierTrialRequest) =>
      (await batchIssueTierTrials(request)).data.data,
    onSuccess: (data) => {
      const issued =
        data.summary.gifted + data.summary.extended + data.summary.replaced;

      setResult(data);
      setIsGiftOpen(false);

      if (issued === 0) {
        toast.warning(
          "No trials were issued — every line was skipped, unknown or failed."
        );
        return;
      }

      toast.success(
        `${issued} of ${data.rows.length} users now have a trial waiting for them`
      );
    },
    onError: () => {
      // The API layer already shows the server's message. A refusal here is
      // one that applies to the whole batch — a duration outside the bounds,
      // an empty list — so keep the dialog open to be corrected.
    },
  });

  const failedRows =
    result?.rows.filter((row) => row.outcome === "failed") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-2 text-sm text-gray-600">
          <p>
            Same gift as the one on a user&apos;s profile — points and FUSE
            balances are untouched, and each trial starts counting down only
            when its user activates it in the app.
          </p>
          {!result && (
            <>
              <p>
                Paste usernames one per line — up to 500 in a batch. Each user
                is gifted once even if their name appears twice, and a username
                nobody holds is reported back rather than stopping the run.
              </p>
              <p>
                Users who already hold a trial are left alone unless you say
                otherwise: a batch is issued without looking at any one of
                them, so extending or replacing is a decision made once for the
                whole list.
              </p>
              <p>
                Every gift is recorded in the admin audit trail under your
                name, tagged with this batch, so &ldquo;why is this account on
                Prime?&rdquo; still has an answer months from now.
              </p>
            </>
          )}
        </div>
        <Button
          id="gift-trials"
          data-search-open
          onClick={() => setIsGiftOpen(true)}
          disabled={batch.isPending}
          className="cursor-pointer"
        >
          <Gift className="h-4 w-4" />
          Gift trials
        </Button>
      </div>

      {result && (
        <div className="space-y-4 rounded-md border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-gray-900">
              {result.rows.length} username
              {result.rows.length === 1 ? "" : "s"} processed
            </p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-gray-500">
                {result.batchId}
              </span>
              <CopyButton value={result.batchId} label="Batch id" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {OUTCOME_ORDER.map((outcome) => (
              <Badge
                key={outcome}
                variant={
                  result.summary[outcome] > 0
                    ? tierTrialBatchOutcomeVariant(outcome)
                    : "muted"
                }
              >
                {result.summary[outcome]}{" "}
                {tierTrialBatchOutcomeLabel(outcome).toLowerCase()}
              </Badge>
            ))}
          </div>

          {failedRows.length > 0 && (
            <p className="text-sm text-red-600">
              {failedRows.length} line
              {failedRows.length === 1 ? "" : "s"} failed. Those users have no
              trial from this batch — fix the reason below and send just those
              names again.
            </p>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row, index) => (
                <TableRow key={`${row.username}-${index}`}>
                  <TableCell className="font-mono text-xs text-gray-900">
                    {row.username}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tierTrialBatchOutcomeVariant(row.outcome)}>
                      {tierTrialBatchOutcomeLabel(row.outcome)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal text-gray-500">
                    {row.message ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Mounted only while open so the form always starts from a clean list. */}
      {isGiftOpen && (
        <TierTrialDialog
          mode="batch"
          open
          onOpenChange={setIsGiftOpen}
          isSaving={batch.isPending}
          onSubmit={(request) => batch.mutate(request)}
        />
      )}
    </div>
  );
}
