"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";

import { useReferralReviewPage } from "@/hooks/use-referral-review";
import {
  BLOCK_MODES,
  referralStatus,
  reversalReasonLabel,
  reviewReasonLabel,
  spendAgainstBar,
} from "@/lib/referral";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import type {
  ReferralDecisionAction,
  ReferralReviewRow,
  ReferralReviewStatusFilter,
} from "@/types/referral-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DECISIONS, DecisionDialog } from "./decisions";

const PAGE_SIZE = 50;

const STATUS_FILTERS: {
  value: ReferralReviewStatusFilter;
  label: string;
  /** Which ledger counts make up this filter's number. */
  counts: string[];
}[] = [
  { value: "under_review", label: "Under review", counts: ["under_review"] },
  { value: "qualified", label: "Qualified, unpaid", counts: ["qualified"] },
  { value: "pending", label: "Pending", counts: ["pending"] },
  {
    value: "unpaid",
    label: "All unpaid",
    counts: ["pending", "qualified", "under_review"],
  },
  { value: "reversed", label: "Reversed", counts: ["reversed"] },
];

const REASON_FILTERS = [
  "manual_hold",
  "referrer_blocked",
  "velocity_over_monthly_threshold",
];

/** Which decisions make sense for the rewards a filter shows. */
const ACTIONS_FOR: Record<ReferralReviewStatusFilter, ReferralDecisionAction[]> =
  {
    under_review: ["approve", "approve_friend_only", "reject"],
    qualified: ["hold", "approve_friend_only", "reject", "approve"],
    pending: ["approve_friend_only", "reject"],
    unpaid: ["approve", "approve_friend_only", "hold", "reject"],
    reversed: ["approve", "approve_friend_only"],
    expired: [],
    paid: [],
  };

const shortDate = (value?: string) =>
  value
    ? formatDateTime(value, { month: "short", day: "numeric", year: "numeric" })
    : "—";

/** Split a pasted column or list of usernames into names. */
export const parseUserList = (text: string): string[] => [
  ...new Set(
    text
      .split(/[\s,;]+/)
      .map((name) => name.trim().replace(/^@/, ""))
      .filter(Boolean),
  ),
];

/**
 * The review queue: referral rewards waiting on an admin — held by a hold,
 * a referrer block or the monthly threshold — and every other unpaid reward,
 * to approve, pay to the friend only, hold or reject, one at a time or in bulk.
 */
export function ReviewQueue() {
  const [status, setStatus] =
    useState<ReferralReviewStatusFilter>("under_review");
  const [reason, setReason] = useState("");
  const [referrerInput, setReferrerInput] = useState("");
  const [referrer, setReferrer] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [pending, setPending] = useState<{
    action: ReferralDecisionAction;
    users: string[];
    labels: string[];
  } | null>(null);
  const [pasted, setPasted] = useState("");

  const query = useReferralReviewPage({
    status,
    reason: status === "under_review" ? reason : undefined,
    referrer,
    page,
    limit: PAGE_SIZE,
  });
  const data = query.data;
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const selectable = rows.filter((row) => !row.payoutInFlight);
  const allSelected =
    selectable.length > 0 &&
    selectable.every((row) => selected.has(row.referredUserId));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  /** A filter changed: back to the first page, with nothing selected. */
  const resetPaging = () => {
    setPage(1);
    setSelected(new Map());
  };

  const toggle = (row: ReferralReviewRow) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(row.referredUserId)) next.delete(row.referredUserId);
      else next.set(row.referredUserId, row.username || row.referredUserId);
      return next;
    });

  const toggleAll = () =>
    setSelected((current) => {
      const next = new Map(current);
      if (allSelected) {
        selectable.forEach((row) => next.delete(row.referredUserId));
      } else {
        selectable.forEach((row) =>
          next.set(row.referredUserId, row.username || row.referredUserId),
        );
      }
      return next;
    });

  const pastedUsers = parseUserList(pasted);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const count = filter.counts.reduce(
            (sum, key) =>
              sum + (data?.counts[key as keyof typeof data.counts] ?? 0),
            0,
          );
          return (
            <button
              key={filter.value}
              onClick={() => {
                setStatus(filter.value);
                resetPaging();
              }}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                status === filter.value
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {filter.label}
              {data ? ` · ${formatNumber(count, 0, 0)}` : ""}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        {status === "under_review" && (
          <label className="space-y-1 text-xs text-gray-600">
            <span className="block">Held because</span>
            <select
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                resetPaging();
              }}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
            >
              <option value="">Any reason</option>
              {REASON_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {reviewReasonLabel(value)}
                </option>
              ))}
            </select>
          </label>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setReferrer(referrerInput.trim());
            resetPaging();
          }}
        >
          <label className="space-y-1 text-xs text-gray-600">
            <span className="block">Referrer</span>
            <Input
              value={referrerInput}
              onChange={(event) => setReferrerInput(event.target.value)}
              placeholder="username or id"
              className="h-9 w-56"
            />
          </label>
          <Button type="submit" variant="outline" className="cursor-pointer">
            <Search className="h-4 w-4" />
            Filter
          </Button>
          {referrer && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setReferrer("");
                setReferrerInput("");
                resetPaging();
              }}
              className="cursor-pointer"
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-sm">
          <span className="px-2 font-medium text-indigo-900">
            {selected.size} selected
          </span>
          {ACTIONS_FOR[status].map((action) => (
            <Button
              key={action}
              size="sm"
              variant={DECISIONS[action].destructive ? "destructive" : "outline"}
              onClick={() =>
                setPending({
                  action,
                  users: [...selected.keys()],
                  labels: [...selected.values()],
                })
              }
              className="cursor-pointer"
            >
              {DECISIONS[action].label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Map())}
            className="cursor-pointer"
          >
            Clear selection
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select every reward on this page"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectable.length === 0}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium">Friend</th>
              <th className="px-3 py-2 text-left font-medium">Referrer</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">
                Spend against bar
              </th>
              <th className="px-3 py-2 text-left font-medium">
                Referrer + friend
              </th>
              <th className="px-3 py-2 text-left font-medium">Qualified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {query.isLoading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-gray-500">
                  Nothing here.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <ReviewRow
                  key={row.referredUserId}
                  row={row}
                  checked={selected.has(row.referredUserId)}
                  onToggle={() => toggle(row)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Also past the first page: deciding every row on the last page
          shrinks the total, and the pager is the only way back. */}
      {data && (data.total > data.limit || page > 1) && (
        <div className="flex items-center justify-end gap-2 text-xs text-gray-600">
          <span>
            Page {data.page} of {pages} · {formatNumber(data.total, 0, 0)}{" "}
            rewards
          </span>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="cursor-pointer"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="cursor-pointer"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Decide by username
        </h3>
        <p className="text-xs text-gray-500">
          Paste the referred friends — one per line, or separated by commas —
          and choose what happens to their rewards. Each is decided on its own:
          a name with no reward, or a reward already paid, is reported and
          skipped.
        </p>
        <Textarea
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder={"bratche12416\ndani.32\nddddila2003"}
          rows={4}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">
            {pastedUsers.length} user{pastedUsers.length === 1 ? "" : "s"}
          </span>
          {(
            [
              "hold",
              "approve",
              "approve_friend_only",
              "reject",
            ] as ReferralDecisionAction[]
          ).map((action) => (
            <Button
              key={action}
              size="sm"
              variant={DECISIONS[action].destructive ? "destructive" : "outline"}
              disabled={pastedUsers.length === 0 || pastedUsers.length > 500}
              onClick={() =>
                setPending({
                  action,
                  users: pastedUsers,
                  labels: pastedUsers,
                })
              }
              className="cursor-pointer"
            >
              {DECISIONS[action].label}
            </Button>
          ))}
          {pastedUsers.length > 500 && (
            <span className="text-xs text-red-600">At most 500 at a time</span>
          )}
        </div>
      </div>

      <DecisionDialog
        action={pending?.action ?? null}
        users={pending?.users ?? []}
        labels={pending?.labels}
        onClose={() => setPending(null)}
        onDecided={() => setSelected(new Map())}
      />
    </div>
  );
}

function ReviewRow({
  row,
  checked,
  onToggle,
}: {
  row: ReferralReviewRow;
  checked: boolean;
  onToggle: () => void;
}) {
  const status = referralStatus(row.status);
  const block = row.referrerBlockMode ? BLOCK_MODES[row.referrerBlockMode] : null;

  return (
    <tr className={`align-top ${checked ? "bg-indigo-50/50" : ""}`}>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          aria-label={`Select ${row.username || row.referredUserId}`}
          checked={checked}
          onChange={onToggle}
          disabled={row.payoutInFlight}
          title={row.payoutInFlight ? "Its payout is already in flight" : ""}
        />
      </td>
      <td className="px-3 py-2">
        <Link
          href={`/users/${row.referredUserId}`}
          className="font-medium text-indigo-600 hover:underline"
        >
          {row.username || row.referredUserId}
        </Link>
        <p className="text-[11px] text-gray-500">
          joined {shortDate(row.signupAt)}
        </p>
      </td>
      <td className="px-3 py-2">
        <Link
          href={`/users/${row.referrerId}`}
          className="text-indigo-600 hover:underline"
        >
          {row.referrerUsername || row.referrerId}
        </Link>
        {block && (
          <div>
            <Badge variant={block.variant}>Blocked: {block.label}</Badge>
          </div>
        )}
      </td>
      <td className="space-y-0.5 px-3 py-2">
        <Badge variant={status.variant}>{status.label}</Badge>
        {row.status === "under_review" && row.reviewReasons.length > 0 && (
          <p className="text-[11px] text-gray-600">
            {row.reviewReasons.map(reviewReasonLabel).join(", ")}
          </p>
        )}
        {row.heldBy && row.status === "under_review" && (
          <p className="text-[11px] text-gray-500">
            by {row.heldBy} · {shortDate(row.heldAt)}
          </p>
        )}
        {row.status === "reversed" && (
          <p className="text-[11px] text-gray-600">
            {reversalReasonLabel(row.reversalReason)}
            {row.reversedBy ? ` · by ${row.reversedBy}` : ""}
          </p>
        )}
        {row.reviewApprovedBy && row.status !== "reversed" && (
          <p className="text-[11px] text-emerald-700">
            Approved by {row.reviewApprovedBy}
          </p>
        )}
        {row.payoutInFlight && (
          <p className="text-[11px] text-amber-700">Payout in flight</p>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-gray-700">
        {spendAgainstBar(
          row.spendUsd,
          row.spendTargetUsd,
          row.merchantCount,
          row.merchantTarget,
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-gray-700">
        {row.referrerLegWithheld ? (
          <span className="text-amber-700">withheld</span>
        ) : (
          formatUsd(row.referrerRewardUsd, 0)
        )}{" "}
        + {formatUsd(row.newUserRewardUsd, 0)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-gray-500">
        {shortDate(row.qualifiedAt)}
        {row.payoutDueAt && (
          <p className="text-[11px]">due {shortDate(row.payoutDueAt)}</p>
        )}
      </td>
    </tr>
  );
}
