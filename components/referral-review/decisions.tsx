"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { useReferralDecision } from "@/hooks/use-referral-review";
import { referralStatus } from "@/lib/referral";
import type {
  ReferralDecisionAction,
  ReferralDecisionResult,
  ReferralGoodwillTerms,
} from "@/types/referral-review";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** What each decision does, in the words the confirmation shows. */
export const DECISIONS: Record<
  ReferralDecisionAction,
  { label: string; description: string; destructive?: boolean }
> = {
  approve: {
    label: "Approve",
    description:
      "Back to Qualified, and the hold checks will pass it. The next payout sweep pays both sides after the usual spend checks. Also undoes an admin rejection.",
  },
  approve_friend_only: {
    label: "Pay friend only",
    description:
      "The friend is paid and the referrer never is — even if the referrer is blocked in void mode. A friend still working toward the bar is paid alone once they clear it.",
  },
  approve_goodwill: {
    label: "Goodwill approve",
    description:
      "For an exception that has been signed off. Pays both sides even though the friend's spend doesn't clear the bar: the payout skips the spend checks (bar, refunds, purchase after qualifying). A closed account, a suspected self-referral or a void block still stop it. Works on held, qualified, reversed and expired rewards; an expired one waits the usual payout delay from today.",
  },
  hold: {
    label: "Hold",
    description:
      "Qualified rewards stop and wait in this queue until someone approves or rejects them.",
  },
  reject: {
    label: "Reject",
    description:
      "Cancelled: neither the friend nor the referrer is paid. Approve undoes it.",
    destructive: true,
  },
};

/** The two things a goodwill approval can pay — no typed-in amounts. */
const GOODWILL_TERMS: {
  value: ReferralGoodwillTerms;
  label: string;
  description: string;
}[] = [
  {
    value: "keep",
    label: "Keep the reward's terms",
    description:
      "What it qualified on (e.g. $25 each in soFUSE). A friend who never qualified gets the terms their referral was made on.",
  },
  {
    value: "original",
    label: "Original terms",
    description: "$75 bar, $15 each in soUSD.",
  },
];

interface DecisionDialogProps {
  action: ReferralDecisionAction | null;
  /** Usernames or ids, as rewards-service accepts them. */
  users: string[];
  /** How to list them in the confirmation, when not the same as `users`. */
  labels?: string[];
  onClose: () => void;
  /** After a decision went through, so the caller can clear its selection. */
  onDecided?: (result: ReferralDecisionResult) => void;
}

/**
 * Confirm a decision on one or many rewards, with the reason that goes on
 * each friend's audit trail, then show what changed and what was left alone.
 */
export function DecisionDialog({
  action,
  users,
  labels,
  onClose,
  onDecided,
}: DecisionDialogProps) {
  const [reason, setReason] = useState("");
  const [terms, setTerms] = useState<ReferralGoodwillTerms>("keep");
  const [result, setResult] = useState<ReferralDecisionResult | null>(null);
  const decision = useReferralDecision();
  const meta = action ? DECISIONS[action] : null;
  const goodwill = action === "approve_goodwill";
  const trimmed = reason.trim();

  const close = () => {
    if (decision.isPending) return;
    setReason("");
    setTerms("keep");
    setResult(null);
    onClose();
  };

  const submit = () => {
    if (!action || !trimmed) return;
    decision.mutate(
      { action, users, reason: trimmed, ...(goodwill && { terms }) },
      {
        onSuccess: (data) => {
          setResult(data);
          onDecided?.(data);
          if (data.changed > 0) {
            toast.success(
              `${DECISIONS[action].label}: ${data.changed} reward${
                data.changed === 1 ? "" : "s"
              } changed`,
            );
          } else {
            toast.info("Nothing changed — see why below");
          }
        },
      },
    );
  };

  return (
    <Dialog open={!!action} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent className="sm:max-w-lg">
        {meta && result ? (
          <>
            <DialogHeader>
              <DialogTitle>{meta.label}: done</DialogTitle>
              <DialogDescription>
                {result.changed} changed · {result.unchanged} left as they were
              </DialogDescription>
            </DialogHeader>
            <DecisionOutcomes result={result} />
            <DialogFooter>
              <Button onClick={close} className="cursor-pointer">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : meta ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {meta.label} {users.length} reward{users.length === 1 ? "" : "s"}
              </DialogTitle>
              <DialogDescription>{meta.description}</DialogDescription>
            </DialogHeader>

            <p className="max-h-24 overflow-auto rounded-md bg-gray-50 p-2 text-xs text-gray-600">
              {(labels ?? users).join(", ")}
            </p>

            {goodwill && (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium text-gray-900">
                  Pay on
                </legend>
                {GOODWILL_TERMS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${
                      terms === option.value
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-gray-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="referral-goodwill-terms"
                      value={option.value}
                      checked={terms === option.value}
                      onChange={() => setTerms(option.value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-gray-900">
                        {option.label}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="referral-decision-reason">
                {goodwill ? "Who approved it" : "Reason"}
              </Label>
              <Textarea
                id="referral-decision-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder={
                  goodwill
                    ? "e.g. Approved by Eli on Nov 10 — Intercom link. It goes on each user's audit trail"
                    : "The ticket, the finding, or who asked — it goes on each user's audit trail"
                }
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={close}
                disabled={decision.isPending}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant={meta.destructive ? "destructive" : "default"}
                onClick={submit}
                disabled={!trimmed || decision.isPending}
                className="cursor-pointer"
              >
                {decision.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {meta.label}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Per-user outcome of a decision: what moved, and why the rest did not. */
export function DecisionOutcomes({
  result,
}: {
  result: ReferralDecisionResult;
}) {
  const sorted = [...result.outcomes].sort(
    (a, b) => Number(a.ok) - Number(b.ok),
  );
  return (
    <ul className="max-h-72 divide-y divide-gray-100 overflow-auto rounded-md border border-gray-100 text-xs">
      {sorted.map((outcome) => (
        <li
          key={`${outcome.input}-${outcome.referredUserId ?? ""}`}
          className="flex items-start gap-2 px-3 py-2"
        >
          {outcome.ok ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          )}
          <div className="min-w-0 flex-1">
            {outcome.referredUserId ? (
              <Link
                href={`/users/${outcome.referredUserId}`}
                className="font-medium text-indigo-600 hover:underline"
              >
                {outcome.username || outcome.input}
              </Link>
            ) : (
              <span className="font-medium text-gray-900">{outcome.input}</span>
            )}
            {outcome.ok && outcome.previousStatus && outcome.status ? (
              <span className="ml-2 inline-flex items-center gap-1">
                <Badge variant={referralStatus(outcome.previousStatus).variant}>
                  {referralStatus(outcome.previousStatus).label}
                </Badge>
                →
                <Badge variant={referralStatus(outcome.status).variant}>
                  {referralStatus(outcome.status).label}
                </Badge>
              </span>
            ) : (
              <p className="text-gray-500">{outcome.error}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
