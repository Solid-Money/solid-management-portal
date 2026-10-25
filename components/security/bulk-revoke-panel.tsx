"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { bulkRevokeSessions, bulkSessionPreview } from "@/lib/api";
import { formatDateTime, formatUsd } from "@/lib/utils";
import type {
  BulkRevokeResult,
  BulkSessionPreview,
} from "@/types/bulk-session";
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
const MAX_ACCOUNTS = 1000;

/** Split a pasted blob on any whitespace or commas, dedupe, and sort ids by
 * shape. Accepts the kind of list that comes off an incident sheet. */
function parseIds(raw: string): {
  valid: string[];
  invalid: string[];
  total: number;
} {
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
    total: unique.length,
  };
}

function shortId(id: string): string {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export default function BulkRevokePanel() {
  const [raw, setRaw] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The id set captured when the confirm dialog opened. The revoke runs against
  // this snapshot, so a preview that resolves while the dialog is open can never
  // swap the accounts out from under the operator who opened it.
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [result, setResult] = useState<BulkRevokeResult | null>(null);
  // The exact id set shown by the latest successful preview. Revocation is bound
  // to this, not to whatever is in the textarea now, so an operator can never
  // confirm a set they did not review.
  const [previewedIds, setPreviewedIds] = useState<string[] | null>(null);

  const parsed = useMemo(() => parseIds(raw), [raw]);

  const previewMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      (await bulkSessionPreview(ids)).data.data as BulkSessionPreview,
    onSuccess: (_data, ids) => {
      setPreviewedIds(ids);
      setResult(null);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (vars: { ids: string[]; reason: string }) =>
      (await bulkRevokeSessions(vars.ids, vars.reason)).data
        .data as BulkRevokeResult,
    // Clear any prior outcome the moment a new attempt starts, so a later
    // failure can't leave a stale "revoked" table on screen.
    onMutate: () => setResult(null),
    onSuccess: (data) => {
      setResult(data);
      toast.success(
        `Revoked sessions on ${data.totals.revoked} account(s); ` +
          `${data.totals.totalInvalidated} session(s) ended.`,
      );
    },
  });

  const preview = previewMutation.data ?? null;
  const resultByUser = useMemo(() => {
    const map = new Map<string, BulkRevokeResult["results"][number]>();
    result?.results.forEach((r) => map.set(r.userId, r));
    return map;
  }, [result]);

  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length &&
    [...a].sort().join(",") === [...b].sort().join(",");

  // The textarea must still hold the exact set that was previewed, or the table
  // on screen describes different accounts than a revoke would hit.
  const previewMatchesInput =
    !!previewedIds && sameSet(previewedIds, parsed.valid);
  const withinLimit = parsed.valid.length <= MAX_ACCOUNTS;
  const previewStale = !!preview && !previewMatchesInput;

  // Preview is blocked while a revoke is running or the confirm dialog is open,
  // so new rows can't replace the ones a revoke result is about to land against,
  // and can't shift the set under an open confirmation.
  const canPreview =
    parsed.valid.length > 0 &&
    withinLimit &&
    !previewMutation.isPending &&
    !revokeMutation.isPending &&
    !confirmOpen;
  const canRevoke =
    previewMatchesInput &&
    withinLimit &&
    reason.trim().length > 0 &&
    !previewMutation.isPending &&
    !revokeMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div>
          <label
            htmlFor="account-ids"
            className="text-sm font-medium text-gray-900"
          >
            Account IDs
          </label>
          <p className="mt-0.5 text-xs text-gray-500">
            One per line, or separated by spaces or commas. Up to {MAX_ACCOUNTS}{" "}
            at a time.
          </p>
          <Textarea
            id="account-ids"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"688b65a758350ee917f73832\n68b80a7b287d8e0a27034010"}
            className="mt-2 h-40 font-mono text-xs"
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
          <label htmlFor="reason" className="text-sm font-medium text-gray-900">
            Reason
          </label>
          <p className="mt-0.5 text-xs text-gray-500">
            Written to every account&apos;s audit trail. Usually the incident or
            ticket.
          </p>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Oct 2026 forged-login ATO — revoke attacker sessions"
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
            disabled={!canRevoke}
            onClick={() => {
              // Freeze the reviewed set at the moment the dialog opens.
              if (!previewedIds) return;
              setConfirmIds(previewedIds);
              setConfirmOpen(true);
            }}
            title={
              !withinLimit
                ? `Too many accounts (max ${MAX_ACCOUNTS})`
                : !previewMatchesInput
                  ? "Preview the current list before revoking"
                  : reason.trim().length === 0
                    ? "A reason is required"
                    : undefined
            }
          >
            {revokeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Revoke sessions
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          {previewStale ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              The account list changed since this preview. Preview again before
              revoking — revoke is disabled until the list matches.
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Preview — {preview.totals.found} of {preview.totals.requested}{" "}
              account(s) found
            </h2>
            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
              <span>
                {preview.totals.totalActiveSessions} active session(s) across{" "}
                {preview.totals.withActiveSessions} account(s)
              </span>
              <span>·</span>
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
                <TableHead className="text-right">Active sessions</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead>State</TableHead>
                {result ? <TableHead>Outcome</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row) => {
                const outcome = resultByUser.get(row.userId);
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
                    <TableCell className="text-right tabular-nums">
                      {row.found ? row.activeSessions : "—"}
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
                            security hold
                          </Badge>
                        ) : null}
                        {row.accountClosed ? (
                          <Badge variant="secondary" className="font-normal">
                            closed
                          </Badge>
                        ) : null}
                        {row.found &&
                        !row.securityHold &&
                        !row.accountClosed ? (
                          <span className="text-xs text-gray-400">active</span>
                        ) : null}
                      </div>
                    </TableCell>
                    {result ? (
                      <TableCell>
                        {outcome?.revoked ? (
                          <span className="text-xs text-green-700">
                            revoked ({outcome.invalidatedCount})
                            {outcome.auditFailed ? (
                              <span className="text-amber-700">
                                {" "}
                                · audit log failed
                              </span>
                            ) : null}
                          </span>
                        ) : outcome && !outcome.found ? (
                          <span className="text-xs text-gray-400">
                            not found
                          </span>
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
                <TableCell colSpan={result ? 7 : 6} className="text-xs text-gray-500">
                  {result
                    ? `Revoked ${result.totals.revoked} · ${result.totals.totalInvalidated} session(s) ended · ${result.totals.failed} failed · ${result.totals.notFound} not found`
                    : `${preview.totals.requested} requested · ${preview.totals.totalActiveSessions} active session(s) would be ended`}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={confirmOpen}
        isDestructive
        title="Revoke sessions"
        confirmText="Revoke sessions"
        message={
          <span>
            This signs out <strong>{confirmIds?.length ?? 0}</strong>{" "}
            account(s),
            including each real owner — everyone affected must sign in again with
            their passkey. Already-issued access tokens keep working until they
            expire (within the access-token lifetime). This cannot be undone.
          </span>
        }
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmIds(null);
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          // Submit the set captured when the dialog opened, never whatever a
          // later preview or the textarea holds now.
          if (!confirmIds) return;
          revokeMutation.mutate({ ids: confirmIds, reason: reason.trim() });
          setConfirmIds(null);
        }}
      />
    </div>
  );
}
