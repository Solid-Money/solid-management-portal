"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  useDecideReferralReview,
  useReferralReviewQueue,
  useReferralV4Access,
} from "@/hooks/use-referral-v4";
import {
  formatUtc,
  isNotAvailable,
  referralV4StepLabel,
} from "@/lib/referral-v4";
import { formatUsd } from "@/lib/utils";
import type {
  ReferralReviewDecision,
  ReferralReviewDecisionResult,
  ReferralReviewItem,
} from "@/types/referral-v4";
import { NotAvailableYet } from "@/components/referral-v4/not-available";
import UserLink from "@/components/user-link";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_REASON_LENGTH = 500;

const keyOf = (item: Pick<ReferralReviewItem, "kind" | "id">) =>
  `${item.kind}:${item.id}`;

/** What one decided item was, kept so the results outlive the refetch. */
interface DecidedRow {
  item: ReferralReviewItem;
  referrerUsername: string;
  result?: ReferralReviewDecisionResult["results"][number];
}

/** A checkbox that can show "some selected". */
function Checkbox({
  checked,
  indeterminate = false,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      ref={(element) => {
        if (element) element.indeterminate = indeterminate && !checked;
      }}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 disabled:cursor-not-allowed"
    />
  );
}

function ItemStep({ item }: { item: ReferralReviewItem }) {
  if (item.kind === "legacy") {
    return <span className="text-gray-600">Legacy soFUSE reward</span>;
  }
  return (
    <span className="text-gray-700">
      {referralV4StepLabel(item.step)}
      {item.side && <span className="text-gray-500"> · {item.side}</span>}
    </span>
  );
}

/**
 * The referral review queue: rewards held because their referrer qualified
 * more friends in a month than the review threshold allows — v4 rewards and
 * today's legacy rewards stuck under review alike.
 *
 * Grouped by referrer, because the decision is about the referrer ("is this a
 * real community or a farm?"), and items are selected individually or a
 * group at a time. Approve and Reject take one reason for the whole batch and
 * report back per item: the results stay on screen after the queue refreshes,
 * since "which ones didn't go through" is the question after pressing it.
 */
export default function ReferralReviewPage() {
  const access = useReferralV4Access();
  const canReview = access.data?.canReview === true;
  const queue = useReferralReviewQueue();
  const decide = useDecideReferralReview();

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [decision, setDecision] = useState<ReferralReviewDecision | null>(null);
  const [reason, setReason] = useState("");
  const [lastRun, setLastRun] = useState<{
    decision: ReferralReviewDecision;
    rows: DecidedRow[];
  } | null>(null);

  const groups = useMemo(() => queue.data?.groups ?? [], [queue.data]);

  /** Every item by key, with the referrer it sits under. */
  const index = useMemo(() => {
    const map = new Map<
      string,
      { item: ReferralReviewItem; referrerUsername: string }
    >();
    for (const group of groups) {
      for (const item of group.items) {
        map.set(keyOf(item), {
          item,
          referrerUsername: group.referrerUsername,
        });
      }
    }
    return map;
  }, [groups]);

  // Keep only selections still in the queue (a refetch drops decided items).
  const selectedKeys = [...selected].filter((key) => index.has(key));
  const selectedAmount = selectedKeys.reduce(
    (sum, key) => sum + (index.get(key)?.item.amountUsd ?? 0),
    0,
  );
  const totalItems = index.size;
  const legacyCount = [...index.values()].filter(
    (entry) => entry.item.kind === "legacy",
  ).length;

  const toggle = (keys: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });

  const closeDialog = () => {
    if (decide.isPending) return;
    setDecision(null);
    setReason("");
  };

  const submit = () => {
    const trimmed = reason.trim();
    if (!decision || !trimmed || selectedKeys.length === 0) return;

    const chosen = selectedKeys.map((key) => index.get(key)!);
    const runDecision = decision;

    decide.mutate(
      {
        items: chosen.map(({ item }) => ({ kind: item.kind, id: item.id })),
        decision: runDecision,
        reason: trimmed,
      },
      {
        onSuccess: (data) => {
          const results = new Map(
            (data?.results ?? []).map((result) => [keyOf(result), result]),
          );
          const rows: DecidedRow[] = chosen.map((entry) => ({
            ...entry,
            result: results.get(keyOf(entry.item)),
          }));
          const ok = rows.filter((row) => row.result?.ok).length;
          const failed = rows.length - ok;

          setLastRun({ decision: runDecision, rows });
          setSelected(new Set());
          setDecision(null);
          setReason("");

          const verb = runDecision === "approve" ? "approved" : "rejected";
          if (failed === 0) {
            toast.success(`${ok} reward${ok === 1 ? "" : "s"} ${verb}`);
          } else {
            toast.warning(
              `${ok} ${verb}, ${failed} not — see the results below`,
            );
          }
        },
        // The API layer toasts the server's reason; keep the dialog open.
      },
    );
  };

  const notAvailable = !!queue.error && isNotAvailable(queue.error);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ShieldCheck className="h-5 w-5 text-gray-400" />
            Referral review
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Referral rewards held because their referrer qualified more friends
            in a month than the review threshold. Approved v4 rewards continue
            their hold and are credited in the first Thursday run after they
            unlock; approved legacy rewards are paid by the next 02:00 UTC
            sweep. Rejected rewards are cancelled (legacy: reversed as
            &ldquo;rejected in review&rdquo;).
          </p>
        </div>
        {!canReview && !access.isLoading && (
          <Badge variant="warning">
            <Eye className="h-3 w-3" />
            View only
          </Badge>
        )}
      </div>

      {!canReview && !access.isLoading && !notAvailable && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {access.error && isNotAvailable(access.error)
            ? "Review access can't be checked yet — the referral v4 access endpoint isn't served by this backend."
            : "You can see the queue but not decide it. Reviewing is limited to the admins in REFERRAL_ADMIN_EMAILS."}
        </div>
      )}

      {lastRun && (
        <Card>
          <CardHeader>
            <CardTitle>
              Last decision: {lastRun.rows.length} item
              {lastRun.rows.length === 1 ? "" : "s"}{" "}
              {lastRun.decision === "approve" ? "approved" : "rejected"}
            </CardTitle>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setLastRun(null)}
              className="cursor-pointer"
            >
              Dismiss
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="success">
                {lastRun.rows.filter((row) => row.result?.ok).length} done
              </Badge>
              <Badge
                variant={
                  lastRun.rows.some((row) => !row.result?.ok)
                    ? "danger"
                    : "muted"
                }
              >
                {lastRun.rows.filter((row) => !row.result?.ok).length} not done
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-gray-500">
                    <th className="py-2 pr-4">Referrer</th>
                    <th className="py-2 pr-4">Friend</th>
                    <th className="py-2 pr-4">Reward</th>
                    <th className="py-2 pr-4">Outcome</th>
                    <th className="py-2">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lastRun.rows.map((row) => (
                    <tr key={keyOf(row.item)}>
                      <td className="py-2 pr-4 text-gray-900">
                        {row.referrerUsername}
                      </td>
                      <td className="py-2 pr-4">
                        <UserLink
                          userId={row.item.friend.id}
                          username={row.item.friend.username}
                        />
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {row.item.kind === "legacy" && (
                          <Badge variant="muted" className="mr-1">
                            Legacy
                          </Badge>
                        )}
                        <ItemStep item={row.item} />
                      </td>
                      <td className="py-2 pr-4">
                        {row.result?.ok ? (
                          <Badge variant="success">
                            <CheckCircle2 />
                            {row.result.status ?? "Done"}
                          </Badge>
                        ) : (
                          <Badge variant="danger">
                            <XCircle />
                            {row.result ? "Failed" : "No result"}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-xs text-gray-500">
                        {row.result?.error ??
                          (row.result ? "—" : "The backend didn't report this item.")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {queue.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : notAvailable ? (
        <NotAvailableYet what="The referral review queue" />
      ) : queue.error ? (
        <p className="text-sm text-red-600">
          Failed to load the review queue.
        </p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center text-sm text-gray-500">
          Nothing is waiting for review.
        </div>
      ) : (
        <>
          <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <Checkbox
              label="Select every item"
              checked={totalItems > 0 && selectedKeys.length === totalItems}
              indeterminate={selectedKeys.length > 0}
              disabled={!canReview}
              onChange={(on) => toggle([...index.keys()], on)}
            />
            <span className="text-sm text-gray-700">
              {selectedKeys.length > 0
                ? `${selectedKeys.length} selected · ${formatUsd(selectedAmount)}`
                : `${totalItems} item${totalItems === 1 ? "" : "s"} from ${
                    groups.length
                  } referrer${groups.length === 1 ? "" : "s"}${
                    legacyCount > 0 ? ` (${legacyCount} legacy)` : ""
                  }`}
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDecision("reject")}
                disabled={!canReview || selectedKeys.length === 0}
                className="cursor-pointer text-red-700"
              >
                <XCircle />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => setDecision("approve")}
                disabled={!canReview || selectedKeys.length === 0}
                className="cursor-pointer"
              >
                <CheckCircle2 />
                Approve
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {groups.map((group) => {
              const keys = group.items.map(keyOf);
              const chosen = keys.filter((key) => selected.has(key)).length;
              const total = group.items.reduce(
                (sum, item) => sum + (item.amountUsd || 0),
                0,
              );
              return (
                <Card key={group.referrerId}>
                  <CardHeader className="items-center">
                    <div className="flex flex-wrap items-center gap-3">
                      <Checkbox
                        label={`Select every item for ${group.referrerUsername}`}
                        checked={chosen === keys.length && keys.length > 0}
                        indeterminate={chosen > 0}
                        disabled={!canReview}
                        onChange={(on) => toggle(keys, on)}
                      />
                      <UserLink
                        userId={group.referrerId}
                        username={group.referrerUsername}
                        className="text-sm"
                      />
                      <Badge variant="warning">
                        {group.monthQualifiedCount} qualified this month
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500">
                      {group.items.length} item
                      {group.items.length === 1 ? "" : "s"} ·{" "}
                      {formatUsd(total)}
                    </span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="w-8 px-4 py-2" />
                            <th className="px-3 py-2 text-left font-medium">
                              Friend
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Country
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Reward
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              Amount
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Earned
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Why held
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.items.map((item) => {
                            const key = keyOf(item);
                            return (
                              <tr
                                key={key}
                                className={
                                  selected.has(key)
                                    ? "bg-indigo-50/50"
                                    : "hover:bg-gray-50"
                                }
                              >
                                <td className="px-4 py-2">
                                  <Checkbox
                                    label={`Select ${item.friend.username}`}
                                    checked={selected.has(key)}
                                    disabled={!canReview}
                                    onChange={(on) => toggle([key], on)}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <UserLink
                                    userId={item.friend.id}
                                    username={item.friend.username}
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-600">
                                  {item.friend.country ?? "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {item.kind === "legacy" ? (
                                      <Badge variant="muted">Legacy</Badge>
                                    ) : (
                                      <Badge variant="info">v4</Badge>
                                    )}
                                    <ItemStep item={item} />
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-gray-900">
                                  {formatUsd(item.amountUsd)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                                  {formatUtc(item.earnedAt)}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {item.reviewReason === "velocity_over_monthly_threshold"
                                    ? "Over the monthly threshold"
                                    : (item.reviewReason ?? "—")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Dialog
        open={decision !== null}
        onOpenChange={(next) => (next ? undefined : closeDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "approve" ? "Approve" : "Reject"}{" "}
              {selectedKeys.length} reward
              {selectedKeys.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              {decision === "approve"
                ? "Approved v4 rewards continue their hold and are credited as card credit in the first Thursday run after they unlock. Approved legacy rewards are paid by the next 02:00 UTC sweep."
                : "Rejected v4 rewards are cancelled and never credited. Rejected legacy rewards are reversed (rejected in review) for both sides."}{" "}
              {formatUsd(selectedAmount)} in total.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="review-reason">Reason</Label>
            <Textarea
              id="review-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={MAX_REASON_LENGTH}
              placeholder={
                decision === "approve"
                  ? "e.g. Real community — university club, varied spend"
                  : "e.g. Same device and funding source across friends"
              }
              disabled={decide.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Required. Applied to every selected item and recorded with your
              name. {reason.length}/{MAX_REASON_LENGTH}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={decide.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant={decision === "reject" ? "destructive" : "default"}
              onClick={submit}
              disabled={decide.isPending || !reason.trim()}
              className="cursor-pointer"
            >
              {decide.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {decision === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
