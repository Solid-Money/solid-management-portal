"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  bulkResendFailedCashback,
  getFailedCashbackResendRuns,
  previewFailedCashbackResend,
} from "@/lib/api";
import {
  BULK_RESEND_OUTCOME_ORDER,
  FAILED_CASHBACK_CAUSES,
  MAX_BULK_RESEND_USERS,
  bulkResendOutcomeLabel,
  bulkResendOutcomeVariant,
  bulkResendRunStatusLabel,
  bulkResendRunStatusVariant,
  estimateBasisLabel,
  failedCashbackCauseLabel,
  failedCashbackCauseVariant,
  formatSoUsd,
  parseUserList,
  roundUpToCents,
} from "@/lib/failed-cashback";
import { formatDateTime, formatUsd } from "@/lib/utils";
import {
  BulkResendPreview,
  BulkResendResult,
  BulkResendRunSummary,
  FailedCashbackCause,
  FailedCashbackSelection,
} from "@/types";
import BulkResendRunReportDialog from "@/components/cashback/bulk-resend-run-report";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** `YYYY-MM-DD`, `days` before today in UTC — the date inputs' format. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** The rows a fresh preview starts with ticked. */
function defaultSelection(preview: BulkResendPreview): Set<string> {
  // Already past the highest monthly cap: re-sent now, every row would be
  // Canceled — terminal, the money lost. Left in the failed state, the same
  // rows can be re-sent next month, so they start unticked.
  const pastCap = new Set(
    preview.users
      .filter((user) => user.capRisk === "canceled")
      .map((user) => user.userId),
  );

  return new Set(
    preview.rows
      .filter((row) => !row.blockedReason && !pastCap.has(row.userId))
      .map((row) => row.cashbackId),
  );
}

/**
 * The portal's bulk "Re-send failed cashback".
 *
 * ## Why this page exists
 *
 * When the payout wallet ran dry on Sep 30 2026 it left 331 PermanentlyFailed
 * rows across 141 cardholders, and the only fix was opening each user and
 * pressing "Re-send failed" one at a time while customers waited on Intercom.
 *
 * ## How it keeps a bulk action safe
 *
 * - **Preview, then send exactly that.** The operator filters, sees every row,
 *   can untick any of them, and the send carries the ids — never the filter —
 *   so nothing matched after the preview is swept in unseen.
 * - **The payout wallet has to cover it.** The preview reads the wallet live
 *   and compares it with this selection plus whatever is already waiting in the
 *   retry queue; the backend checks again at send time and refuses the whole
 *   run if it falls short. Re-arming into an empty wallet is how these rows
 *   were made.
 * - **Idempotent.** Rows already paid or already queued are skipped, never
 *   re-armed, so a second press cannot pay twice.
 * - **On the record.** Every run is stored with who ran it and why, and each
 *   affected cardholder's audit trail links back to it.
 */
export default function FailedCashbackResend() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openRunId = params.get("run");

  const [causes, setCauses] = useState<Set<FailedCashbackCause>>(
    () =>
      new Set(
        FAILED_CASHBACK_CAUSES.filter((cause) => cause.defaultOn).map(
          (cause) => cause.value,
        ),
      ),
  );
  const [from, setFrom] = useState(() => daysAgo(30));
  const [to, setTo] = useState("");
  const [dateField, setDateField] = useState<"updatedAt" | "createdAt">(
    "updatedAt",
  );
  const [usersText, setUsersText] = useState("");

  const [preview, setPreview] = useState<BulkResendPreview | null>(null);
  const [previewedSelection, setPreviewedSelection] =
    useState<FailedCashbackSelection | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<BulkResendResult | null>(null);

  const users = useMemo(() => parseUserList(usersText), [usersText]);

  const setOpenRun = (runId: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (runId) next.set("run", runId);
    else next.delete("run");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const buildSelection = (): FailedCashbackSelection => ({
    causes: [...causes],
    dateField,
    // The date inputs are read as UTC days, inclusive at both ends.
    ...(from && { from: `${from}T00:00:00.000Z` }),
    ...(to && { to: `${to}T23:59:59.999Z` }),
    ...(users.length > 0 && { users }),
  });

  const previewMutation = useMutation({
    mutationFn: async (selection: FailedCashbackSelection) =>
      (await previewFailedCashbackResend(selection)).data,
    onSuccess: (data, selection) => {
      setPreview(data);
      setPreviewedSelection(selection);
      setSelectedIds(defaultSelection(data));
      setResult(null);
    },
    onError: () => {
      // The API layer already shows the server's reason.
    },
  });

  const runsQuery = useQuery({
    queryKey: ["failed-cashback-runs"],
    queryFn: async () => (await getFailedCashbackResendRuns()).data,
  });

  const sendMutation = useMutation({
    mutationFn: async () =>
      (
        await bulkResendFailedCashback({
          cashbackIds: [...selectedIds],
          reason: reason.trim(),
          selection: previewedSelection ?? undefined,
        })
      ).data,
    onSuccess: (data) => {
      setConfirmOpen(false);
      setResult(data);
      setPreview(null);
      setReason("");
      void queryClient.invalidateQueries({
        queryKey: ["failed-cashback-runs"],
      });

      if (data.status === "blocked") {
        toast.error("Nothing re-sent — the payout wallet cannot cover it");
      } else if (data.summary.queued > 0) {
        toast.success(
          `${data.summary.queued} row${data.summary.queued === 1 ? "" : "s"} for ${data.queuedUsers} cardholder${data.queuedUsers === 1 ? "" : "s"} queued for payout`,
        );
      } else {
        toast.info("Nothing was re-sent — see why below");
      }
    },
    onError: () => {
      // Keep the dialog open so the admin can retry; the API layer has
      // already shown the server's reason.
    },
  });

  const toggleCause = (cause: FailedCashbackCause, on: boolean) => {
    setCauses((current) => {
      const next = new Set(current);
      if (on) next.add(cause);
      else next.delete(cause);
      return next;
    });
  };

  const tooManyUsers = users.length > MAX_BULK_RESEND_USERS;
  const canPreview =
    causes.size > 0 && !tooManyUsers && !previewMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            Which rows
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Why they failed</Label>
            <div className="space-y-2">
              {FAILED_CASHBACK_CAUSES.map((cause) => (
                <label
                  key={cause.value}
                  className="flex cursor-pointer items-start gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={causes.has(cause.value)}
                    onChange={(event) =>
                      toggleCause(cause.value, event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  <span>
                    <span className="font-medium text-gray-900">
                      {cause.label}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {cause.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="failed-cashback-date-field">Date is when</Label>
              <select
                id="failed-cashback-date-field"
                value={dateField}
                onChange={(event) =>
                  setDateField(event.target.value as "updatedAt" | "createdAt")
                }
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="updatedAt">the row last failed</option>
                <option value="createdAt">the purchase was made</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="failed-cashback-from">From (UTC)</Label>
              <Input
                id="failed-cashback-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="failed-cashback-to">To (UTC, inclusive)</Label>
              <Input
                id="failed-cashback-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>
          <p className="-mt-3 text-xs text-gray-500">
            Starts at the last 30 days. Clear both dates to include older rows —
            there are rows from the gas outage earlier this year that may no
            longer be owed, so look at those before sending them.
          </p>

          <div className="space-y-2">
            <Label htmlFor="failed-cashback-users">
              Only these users (optional)
            </Label>
            <Textarea
              id="failed-cashback-users"
              value={usersText}
              onChange={(event) => setUsersText(event.target.value)}
              placeholder={
                "User ids or usernames, one per line or comma-separated"
              }
              rows={3}
            />
            <p
              className={`text-xs ${tooManyUsers ? "text-red-600" : "text-gray-500"}`}
            >
              {users.length > 0
                ? `${users.length} user${users.length === 1 ? "" : "s"}`
                : "Every cardholder"}
              {tooManyUsers && ` — at most ${MAX_BULK_RESEND_USERS} at once`}
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => previewMutation.mutate(buildSelection())}
              disabled={!canPreview}
              className="cursor-pointer"
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <PreviewPanel
          preview={preview}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          reason={reason}
          onReasonChange={setReason}
          onRefresh={() =>
            previewedSelection && previewMutation.mutate(previewedSelection)
          }
          refreshing={previewMutation.isPending}
          onSend={() => setConfirmOpen(true)}
        />
      )}

      {result && (
        <ResultPanel
          result={result}
          onOpenReport={() => setOpenRun(result.runId)}
        />
      )}

      <RunsCard
        runs={runsQuery.data ?? []}
        isLoading={runsQuery.isLoading}
        isError={runsQuery.isError}
        onOpen={(runId) => setOpenRun(runId)}
      />

      {preview && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={(open) =>
            !sendMutation.isPending && setConfirmOpen(open)
          }
          preview={preview}
          selectedIds={selectedIds}
          reason={reason}
          sending={sendMutation.isPending}
          onConfirm={() => sendMutation.mutate()}
        />
      )}

      {openRunId && (
        <BulkResendRunReportDialog
          runId={openRunId}
          onClose={() => setOpenRun(null)}
        />
      )}
    </div>
  );
}

/** What is ticked, summed the way the backend will price it. */
function useSelectionTotals(
  preview: BulkResendPreview,
  selectedIds: Set<string>,
) {
  return useMemo(() => {
    const rows = preview.rows.filter((row) => selectedIds.has(row.cashbackId));
    const usd = rows.reduce((total, row) => total + row.estimatedUsd, 0);
    const rate = preview.totals.soUsdRate;
    const soUsd = rate ? usd / rate : undefined;
    const required =
      soUsd !== undefined
        ? soUsd + preview.wallet.alreadyQueuedSoUsd
        : undefined;
    const balance = preview.wallet.soUsdBalance;

    return {
      rows: rows.length,
      users: new Set(rows.map((row) => row.userId)).size,
      usd,
      soUsd,
      required,
      covers:
        required !== undefined && balance !== undefined
          ? balance >= required
          : false,
      shortfall:
        required !== undefined && balance !== undefined
          ? Math.max(0, required - balance)
          : undefined,
    };
  }, [preview, selectedIds]);
}

function PreviewPanel({
  preview,
  selectedIds,
  onSelectedIdsChange,
  reason,
  onReasonChange,
  onRefresh,
  refreshing,
  onSend,
}: {
  preview: BulkResendPreview;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onSend: () => void;
}) {
  const selection = useSelectionTotals(preview, selectedIds);
  const { wallet, totals, capRisk } = preview;

  const userById = useMemo(
    () => new Map(preview.users.map((user) => [user.userId, user])),
    [preview.users],
  );
  const sendable = preview.rows.filter((row) => !row.blockedReason);

  const toggle = (cashbackId: string, on: boolean) => {
    const next = new Set(selectedIds);
    if (on) next.add(cashbackId);
    else next.delete(cashbackId);
    onSelectedIdsChange(next);
  };

  const blockers = [
    wallet.error && `Could not read the payout wallet: ${wallet.error}`,
    !wallet.error &&
      selection.rows > 0 &&
      !selection.covers &&
      `The payout wallet holds ${formatSoUsd(wallet.soUsdBalance)} but these rows plus the ${wallet.alreadyQueuedRows} already queued need up to ${formatSoUsd(selection.required)}. Top it up by at least ${formatSoUsd(selection.shortfall !== undefined ? roundUpToCents(selection.shortfall) : undefined)} first.`,
  ].filter(Boolean) as string[];

  const canSend = selection.rows > 0 && blockers.length === 0;
  // The retry job takes 100 rows every 30 minutes, queued rows included.
  const drainHours =
    Math.ceil((wallet.alreadyQueuedRows + selection.rows) / 100) / 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {totals.rows} permanently failed row{totals.rows === 1 ? "" : "s"}{" "}
          across {totals.users} cardholder{totals.users === 1 ? "" : "s"}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={refreshing}
          className="cursor-pointer"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Selected"
            value={`${selection.rows} row${selection.rows === 1 ? "" : "s"}`}
            detail={`${selection.users} cardholder${selection.users === 1 ? "" : "s"} · ${totals.blockedRows} blocked`}
          />
          <Stat
            label={totals.estimateIsUpperBound ? "Pays up to" : "Pays about"}
            value={formatUsd(selection.usd)}
            detail={
              selection.soUsd !== undefined
                ? `${formatSoUsd(selection.soUsd)} at ${totals.soUsdRate?.toFixed(4)} USD`
                : "soUSD rate unavailable"
            }
          />
          <Stat
            label="Payout wallet"
            value={formatSoUsd(wallet.soUsdBalance)}
            detail={
              wallet.nativeBalance !== undefined
                ? `${wallet.nativeBalance.toFixed(2)} FUSE for gas`
                : "Balance unavailable"
            }
            tone={wallet.error ? "danger" : undefined}
          />
          <Stat
            label="Needs, with the queue"
            value={formatSoUsd(selection.required)}
            detail={`${formatSoUsd(wallet.alreadyQueuedSoUsd)} for ${wallet.alreadyQueuedRows} row${wallet.alreadyQueuedRows === 1 ? "" : "s"} already queued`}
            tone={
              selection.rows === 0
                ? undefined
                : selection.covers
                  ? "success"
                  : "danger"
            }
          />
        </div>

        {blockers.map((message) => (
          <Notice key={message} tone="danger">
            {message}
          </Notice>
        ))}
        {wallet.warnings.map((message) => (
          <Notice key={message} tone="warning">
            {message}
          </Notice>
        ))}
        {capRisk.canceledUsers > 0 && (
          <Notice tone="warning">
            {capRisk.canceledUsers} cardholder
            {capRisk.canceledUsers === 1 ? " has" : "s have"} already been paid
            past the highest monthly cap
            {capRisk.highestMonthlyCap !== undefined &&
              ` (${formatUsd(capRisk.highestMonthlyCap, 0)})`}{" "}
            this month. Their rows would be Canceled for good, so they start
            unticked — re-send them next month instead.
          </Notice>
        )}
        {capRisk.possibleUsers > 0 && (
          <Notice tone="warning">
            {capRisk.possibleUsers} cardholder
            {capRisk.possibleUsers === 1 ? "" : "s"} may hit the monthly cap
            {capRisk.lowestMonthlyCap !== undefined &&
              ` (${formatUsd(capRisk.lowestMonthlyCap, 0)} on the lowest tier)`}
            . Their rows are checked against this month&apos;s payouts, not the
            month of the purchase, and can be reduced or Canceled.
          </Notice>
        )}
        {totals.estimateIsUpperBound && (
          <Notice tone="info">
            Some older rows have no rate stored on them, so they are priced at
            the highest tier rate. They will pay their cardholder&apos;s own
            tier rate, which is the same or less.
          </Notice>
        )}
        {preview.truncated && (
          <Notice tone="info">
            More rows match than one run carries. These are the oldest 1,000 —
            send them, then preview again for the rest.
          </Notice>
        )}
        {preview.unresolvedUsers.length > 0 && (
          <Notice tone="warning">
            No user found for: {preview.unresolvedUsers.join(", ")}
          </Notice>
        )}

        <div className="flex flex-wrap gap-2">
          {preview.byCause
            .filter((entry) => entry.rows > 0)
            .map((entry) => (
              <Badge
                key={entry.cause}
                variant={failedCashbackCauseVariant(entry.cause)}
              >
                {failedCashbackCauseLabel(entry.cause)}: {entry.rows} row
                {entry.rows === 1 ? "" : "s"}, {entry.users} user
                {entry.users === 1 ? "" : "s"}
              </Badge>
            ))}
        </div>

        {preview.rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onSelectedIdsChange(
                    new Set(sendable.map((row) => row.cashbackId)),
                  )
                }
                className="cursor-pointer"
              >
                Tick every sendable row
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectedIdsChange(new Set())}
                className="cursor-pointer"
              >
                Untick all
              </Button>
            </div>
            <div className="max-h-[28rem] overflow-auto rounded-md border border-gray-100">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs font-semibold uppercase text-gray-500">
                    <th className="w-8 px-3 py-2" />
                    <th className="py-2 pr-4">Cardholder</th>
                    <th className="py-2 pr-4">Purchase</th>
                    <th className="py-2 pr-4 text-right">Pays</th>
                    <th className="py-2 pr-4">Why it failed</th>
                    <th className="py-2 pr-4">Failed</th>
                    <th className="py-2 pr-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.rows.map((row) => {
                    const user = userById.get(row.userId);
                    return (
                      <tr
                        key={row.cashbackId}
                        className={
                          row.blockedReason ? "bg-gray-50 text-gray-400" : ""
                        }
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Re-send ${row.transactionId}`}
                            checked={selectedIds.has(row.cashbackId)}
                            disabled={Boolean(row.blockedReason)}
                            onChange={(event) =>
                              toggle(row.cashbackId, event.target.checked)
                            }
                            className="h-4 w-4 rounded"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <Link
                            href={`/users/${row.userId}`}
                            className="font-medium text-indigo-600 hover:underline"
                          >
                            {row.username ?? `${row.userId.slice(0, 8)}…`}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="text-gray-900">
                            {row.merchantName ?? "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {Number(row.fiatAmount || 0).toFixed(2)}{" "}
                            {row.fiatCurrency.toUpperCase()}
                            {row.createdAt &&
                              ` · ${formatDateTime(row.createdAt)}`}
                          </div>
                        </td>
                        <td
                          className="py-2 pr-4 text-right whitespace-nowrap"
                          title={estimateBasisLabel(row.estimateBasis)}
                        >
                          {formatUsd(row.estimatedUsd)}
                          {row.estimateBasis === "max_tier_rate" && " *"}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={failedCashbackCauseVariant(row.cause)}
                            title={row.lastError}
                          >
                            {failedCashbackCauseLabel(row.cause)}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap text-xs text-gray-500">
                          {row.failedAt ? formatDateTime(row.failedAt) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {row.blockedReason ? (
                            <span className="text-amber-700">
                              {row.blockedReason}
                            </span>
                          ) : user?.capRisk === "canceled" ? (
                            <Badge variant="danger">
                              Past the cap — would be Canceled
                            </Badge>
                          ) : user?.capRisk === "possible" ? (
                            <Badge variant="warning">May hit the cap</Badge>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totals.estimateIsUpperBound && (
              <p className="text-xs text-gray-500">
                * Upper bound — see above.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="failed-cashback-reason">Reason</Label>
          <Textarea
            id="failed-cashback-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            maxLength={500}
            placeholder="e.g. Payout wallet ran dry Sep 30 — Monday 13226399703"
          />
          <p className="text-xs text-gray-500">
            Optional. Saved with the run and on every affected user&apos;s audit
            trail, with your name.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Pays through the retry job, 100 rows every 30 minutes — about{" "}
            {drainHours} hour{drainHours === 1 ? "" : "s"} for everything
            queued. The wallet is checked again when you send.
          </p>
          <Button
            onClick={onSend}
            disabled={!canSend}
            className="cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Re-send {selection.rows} row{selection.rows === 1 ? "" : "s"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  preview,
  selectedIds,
  reason,
  sending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: BulkResendPreview;
  selectedIds: Set<string>;
  reason: string;
  sending: boolean;
  onConfirm: () => void;
}) {
  const selection = useSelectionTotals(preview, selectedIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Re-send {selection.rows} row{selection.rows === 1 ? "" : "s"} for{" "}
            {selection.users} cardholder{selection.users === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription>
            They go back in the retry queue and pay{" "}
            {preview.totals.estimateIsUpperBound ? "up to" : "about"}{" "}
            {formatUsd(selection.usd)} ({formatSoUsd(selection.soUsd)}) through
            the normal payout path.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 text-xs text-gray-600">
          <li>
            The payout wallet is read again first. If it no longer covers these
            rows and the {preview.wallet.alreadyQueuedRows} already queued,
            nothing is sent.
          </li>
          <li>
            Rows that were paid or re-sent since the preview are skipped, not
            sent again.
          </li>
          <li>
            A frozen card, a full monthly cap or an open cashback debt still
            apply when each row pays.
          </li>
          <li>
            {reason.trim()
              ? `Recorded under your name with the reason “${reason.trim()}”.`
              : "Recorded under your name. No reason given."}
          </li>
        </ul>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={sending}
            className="cursor-pointer"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Re-send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultPanel({
  result,
  onOpenReport,
}: {
  result: BulkResendResult;
  onOpenReport: () => void;
}) {
  const blocked = result.status === "blocked";
  const notQueued = result.rows.filter((row) => row.outcome !== "queued");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {blocked || result.summary.queued === 0 ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}
          {blocked
            ? "Nothing re-sent"
            : `${result.summary.queued} row${result.summary.queued === 1 ? "" : "s"} queued for ${result.queuedUsers} cardholder${result.queuedUsers === 1 ? "" : "s"}`}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenReport}
          className="cursor-pointer"
        >
          Track this run
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {blocked && result.blockedReason && (
          <Notice tone="danger">{result.blockedReason}</Notice>
        )}
        {!blocked && result.summary.queued > 0 && (
          <p className="text-sm text-gray-600">
            The first rows pay on the next retry run
            {result.expectedBy
              ? `, by ${formatDateTime(result.expectedBy)}`
              : ""}
            ; everything queued should be through in about{" "}
            {result.drain.estimatedHours} hour
            {result.drain.estimatedHours === 1 ? "" : "s"}. Track the run to see
            each row land as Paid — or why it did not.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {BULK_RESEND_OUTCOME_ORDER.map((outcome) => (
            <Badge
              key={outcome}
              variant={
                result.summary[outcome] > 0
                  ? bulkResendOutcomeVariant(outcome)
                  : "muted"
              }
            >
              {result.summary[outcome]}{" "}
              {bulkResendOutcomeLabel(outcome).toLowerCase()}
            </Badge>
          ))}
        </div>
        {notQueued.length > 0 && (
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-4">Cardholder</th>
                  <th className="py-2 pr-4">Purchase</th>
                  <th className="py-2 pr-4">Outcome</th>
                  <th className="py-2">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {notQueued.map((row) => (
                  <tr key={row.cashbackId}>
                    <td className="py-2 pr-4">
                      {row.userId ? (
                        <Link
                          href={`/users/${row.userId}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {row.username ?? `${row.userId.slice(0, 8)}…`}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">
                          {row.cashbackId}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {row.merchantName ?? "—"}
                      {row.fiatAmount &&
                        ` · ${Number(row.fiatAmount).toFixed(2)} ${row.fiatCurrency?.toUpperCase() ?? ""}`}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={bulkResendOutcomeVariant(row.outcome)}>
                        {bulkResendOutcomeLabel(row.outcome)}
                      </Badge>
                    </td>
                    <td className="py-2 text-gray-500">{row.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RunsCard({
  runs,
  isLoading,
  isError,
  onOpen,
}: {
  runs: BulkResendRunSummary[];
  isLoading: boolean;
  isError: boolean;
  onOpen: (runId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-gray-400" />
          Past re-sends
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          </div>
        ) : isError ? (
          <p className="text-xs text-red-600">
            The past re-sends could not be loaded.
          </p>
        ) : runs.length === 0 ? (
          <p className="text-xs text-gray-500">No bulk re-sends yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">By</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Queued</th>
                  <th className="py-2 pr-4 text-right">soUSD</th>
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="py-2 pr-4 whitespace-nowrap text-gray-700">
                      {formatDateTime(run.createdAt)}
                    </td>
                    <td className="py-2 pr-4" title={run.adminEmail}>
                      {run.adminUsername}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={bulkResendRunStatusVariant(run.status)}>
                        {bulkResendRunStatusLabel(run.status)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {run.queuedRows}/{run.requestedRows} · {run.queuedUsers}{" "}
                      user{run.queuedUsers === 1 ? "" : "s"}
                    </td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {run.estimatedSoUsd.toFixed(2)}
                    </td>
                    <td
                      className="max-w-xs truncate py-2 pr-4 text-gray-500"
                      title={run.reason}
                    >
                      {run.reason ?? run.blockedReason ?? "—"}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpen(run.id)}
                        className="cursor-pointer"
                      >
                        Report
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "danger"
        ? "border-red-200 bg-red-50"
        : "border-gray-100 bg-gray-50";

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        {label === "Payout wallet" && <Wallet className="h-3 w-3" />}
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold text-gray-900">{value}</div>
      {detail && <div className="text-xs text-gray-500">{detail}</div>}
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "danger" | "warning" | "info";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-indigo-100 bg-indigo-50 text-indigo-900";

  return (
    <div
      className={`flex gap-2 rounded-md border px-3 py-2 text-sm ${toneClass}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
