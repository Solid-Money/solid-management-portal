"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import {
  bulkSessionPreview,
  describeApiError,
  securityCloseAccount,
} from "@/lib/api";
import { formatDateTime, formatUsd } from "@/lib/utils";
import type { BulkSessionPreview } from "@/types/bulk-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ConfirmationModal from "@/components/ui/confirmation-modal";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_ACCOUNTS = 500;

interface CloseOutcome {
  userId: string;
  closed: boolean;
  error?: string;
}

function parseIds(raw: string): { valid: string[]; invalid: string[] } {
  const unique = Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
  return {
    valid: unique.filter((id) => OBJECT_ID.test(id)),
    invalid: unique.filter((id) => !OBJECT_ID.test(id)),
  };
}

function shortId(id: string): string {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

/**
 * Security-close a list of accounts: unlink each Safe, remove sessions, TOTP and
 * the spend config, and close the row so it cannot sign in or be recovered. The
 * endpoint is per-account, so the list is closed one id at a time and each id
 * gets its own outcome (an account that still has a card is refused). Preview
 * (read-only) shows who each account is before anything is closed.
 */
export default function SecurityClosePanel() {
  const [raw, setRaw] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [previewedIds, setPreviewedIds] = useState<string[] | null>(null);
  const [outcomes, setOutcomes] = useState<CloseOutcome[] | null>(null);

  const parsed = useMemo(() => parseIds(raw), [raw]);

  const previewMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      (await bulkSessionPreview(ids)).data.data as BulkSessionPreview,
    onSuccess: (_data, ids) => {
      setPreviewedIds(ids);
      setOutcomes(null);
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (vars: { ids: string[]; reason: string }) => {
      const settled = await Promise.allSettled(
        vars.ids.map((id) => securityCloseAccount(id, vars.reason)),
      );
      return settled.map<CloseOutcome>((s, i) =>
        s.status === "fulfilled"
          ? { userId: vars.ids[i], closed: true }
          : { userId: vars.ids[i], closed: false, error: describeApiError(s.reason) },
      );
    },
    onMutate: () => setOutcomes(null),
    onSuccess: (results) => {
      setOutcomes(results);
      const closed = results.filter((r) => r.closed).length;
      const failed = results.length - closed;
      if (failed === 0) {
        toast.success(`Closed ${closed} account(s).`);
      } else {
        toast.warning(`Closed ${closed} · ${failed} refused — see the table.`);
      }
    },
  });

  const preview = previewMutation.data ?? null;
  const outcomeByUser = useMemo(() => {
    const map = new Map<string, CloseOutcome>();
    outcomes?.forEach((o) => map.set(o.userId, o));
    return map;
  }, [outcomes]);

  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length &&
    [...a].sort().join(",") === [...b].sort().join(",");

  const previewMatchesInput =
    !!previewedIds && sameSet(previewedIds, parsed.valid);
  const withinLimit = parsed.valid.length <= MAX_ACCOUNTS;
  const previewStale = !!preview && !previewMatchesInput;

  const canPreview =
    parsed.valid.length > 0 &&
    withinLimit &&
    !previewMutation.isPending &&
    !closeMutation.isPending &&
    !confirmOpen;
  const canClose =
    previewMatchesInput &&
    withinLimit &&
    reason.trim().length > 0 &&
    !previewMutation.isPending &&
    !closeMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div>
          <label
            htmlFor="sc-account-ids"
            className="text-sm font-medium text-gray-900"
          >
            Account IDs
          </label>
          <p className="mt-0.5 text-xs text-gray-500">
            One per line, or separated by spaces or commas. Up to {MAX_ACCOUNTS}{" "}
            at a time.
          </p>
          <Textarea
            id="sc-account-ids"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"6aa67ffa90e81b08436cff88\n6ad1ea968545aa15c14dbbd2"}
            className="mt-2 h-32 font-mono text-xs"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{parsed.valid.length} valid id(s)</span>
            {parsed.invalid.length > 0 ? (
              <Badge variant="destructive" className="font-normal">
                {parsed.invalid.length} not an account id (ignored)
              </Badge>
            ) : null}
            {parsed.valid.length > MAX_ACCOUNTS ? (
              <Badge variant="destructive" className="font-normal">
                over the {MAX_ACCOUNTS} limit
              </Badge>
            ) : null}
          </div>
        </div>

        <div>
          <label
            htmlFor="sc-reason"
            className="text-sm font-medium text-gray-900"
          >
            Reason
          </label>
          <p className="mt-0.5 text-xs text-gray-500">
            Written to every account&apos;s audit trail. Usually the incident or
            ticket.
          </p>
          <Input
            id="sc-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Oct 2026 ATO — attacker account (maxxspace/yzcalo)"
            className="mt-2"
            maxLength={500}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={!canPreview}
            onClick={() => previewMutation.mutate(parsed.valid)}
          >
            {previewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Preview
          </Button>
          <Button
            variant="destructive"
            disabled={!canClose}
            onClick={() => {
              if (!previewedIds) return;
              setConfirmIds(previewedIds);
              setConfirmOpen(true);
            }}
            title={
              !withinLimit
                ? `Too many accounts (max ${MAX_ACCOUNTS})`
                : !previewMatchesInput
                  ? "Preview the current list before closing"
                  : reason.trim().length === 0
                    ? "A reason is required"
                    : undefined
            }
          >
            {closeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Security-close accounts
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          {previewStale ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              The account list changed since this preview. Preview again before
              closing — close is disabled until the list matches.
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Preview — {preview.totals.found} of {preview.totals.requested}{" "}
              account(s) found
            </h2>
            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
              <span>{formatUsd(preview.totals.totalBalance)} total balance</span>
              {preview.totals.notFound > 0 ? (
                <>
                  <span>·</span>
                  <span className="text-red-600">
                    {preview.totals.notFound} not found
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead>State</TableHead>
                {outcomes ? <TableHead>Outcome</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row) => {
                const outcome = outcomeByUser.get(row.userId);
                return (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">
                      {row.found ? (
                        <Link
                          href={`/users/${row.userId}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline"
                          title={row.userId}
                        >
                          {row.username ?? shortId(row.userId)}
                        </Link>
                      ) : (
                        <span
                          className="font-mono text-xs text-gray-500"
                          title={row.userId}
                        >
                          {shortId(row.userId)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {row.emailHint ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.found ? formatUsd(row.cachedTotalBalance) : "—"}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {row.lastActivityAt
                        ? formatDateTime(row.lastActivityAt, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {!row.found ? (
                          <Badge variant="destructive" className="font-normal">
                            not found
                          </Badge>
                        ) : null}
                        {row.securityHold ? (
                          <Badge variant="secondary" className="font-normal">
                            already closed
                          </Badge>
                        ) : null}
                        {row.accountClosed && !row.securityHold ? (
                          <Badge variant="secondary" className="font-normal">
                            deleted
                          </Badge>
                        ) : null}
                        {row.found &&
                        !row.securityHold &&
                        !row.accountClosed ? (
                          <span className="text-xs text-gray-400">active</span>
                        ) : null}
                      </div>
                    </TableCell>
                    {outcomes ? (
                      <TableCell>
                        {outcome?.closed ? (
                          <span className="text-xs text-green-700">closed</span>
                        ) : outcome ? (
                          <span className="text-xs text-red-600">
                            {outcome.error ?? "failed"}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={outcomes ? 6 : 5}
                  className="text-xs text-gray-500"
                >
                  {outcomes
                    ? `Closed ${outcomes.filter((o) => o.closed).length} · ${outcomes.filter((o) => !o.closed).length} refused`
                    : `${preview.totals.requested} requested · closing unlinks each Safe and is final`}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={confirmOpen}
        isDestructive
        title="Security-close accounts"
        confirmText="Security-close"
        message={
          <span>
            This closes <strong>{confirmIds?.length ?? 0}</strong> account(s):
            each one&apos;s Safe is unlinked and its sessions, two-factor and card
            spending are removed. Closed accounts cannot sign in or be recovered.
            An account that still has a card is refused — cancel the card first.
            This cannot be undone.
          </span>
        }
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmIds(null);
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          if (!confirmIds) return;
          closeMutation.mutate({ ids: confirmIds, reason: reason.trim() });
          setConfirmIds(null);
        }}
      />
    </div>
  );
}
