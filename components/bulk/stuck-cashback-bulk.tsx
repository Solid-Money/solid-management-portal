"use client";

import { useMemo, useState, type ComponentProps } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { bulkReevaluateFailedCashback, getStuckCashback } from "@/lib/api";
import { formatDateTime, formatUsd } from "@/lib/utils";
import {
  BulkReevaluateFailedCashbackResult,
  BulkReevaluateSkipReason,
  StuckCashbackCause,
  StuckCashbackRow,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
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

/** Why a row gave up, in the words support uses, most common first. */
const CAUSES: Record<
  StuckCashbackCause,
  { label: string; hint: string; variant: BadgeVariant }
> = {
  rpc_unavailable: {
    label: "Fuse RPC refused",
    hint: "The payout wallet's balance could not be read (RPC 403), so nothing was sent.",
    variant: "warning",
  },
  wallet_underfunded: {
    label: "Payout wallet empty",
    hint: "The payout wallet could not cover the soUSD or the gas.",
    variant: "warning",
  },
  transfer_reverted: {
    label: "Transfer reverted",
    hint: "The soUSD transfer reverted — almost always the payout wallet running dry.",
    variant: "warning",
  },
  no_payout_address: {
    label: "No payout address",
    hint: "The user had no Safe when it tried to pay.",
    variant: "danger",
  },
  other: { label: "Other", hint: "", variant: "muted" },
};

const CAUSE_ORDER: StuckCashbackCause[] = [
  "rpc_unavailable",
  "transfer_reverted",
  "wallet_underfunded",
  "no_payout_address",
  "other",
];

const SKIP_REASONS: Record<BulkReevaluateSkipReason, string> = {
  not_permanently_failed: "Already re-sent or paid since the list loaded",
  no_payout_address: "User has no payout address (Safe) yet",
  user_not_found: "The account no longer exists",
};

/** The retry job's pace; see `CashbackRetryCron`. */
const RETRY_BATCH_SIZE = 100;
const RETRY_INTERVAL_MINUTES = 30;

/**
 * Stuck cashback: every PermanentlyFailed row across all users, re-sent in one
 * go.
 *
 * ## Why this exists
 *
 * A payout gives up after five attempts, and the ones that give up in numbers
 * do so for a reason that is ours, not the row's — the Fuse RPC refusing every
 * balance read on Oct 20–21, the payout wallet running dry in September. The
 * per-user "Re-send failed" button answers one cardholder; this answers the
 * incident, without opening 233 profiles.
 *
 * ## What "re-send" does
 *
 * Exactly what the per-user button does: each picked row goes back in the
 * payout queue with a fresh retry budget, and the retry job pays it at the rate
 * it was earned at, with the frozen-card, monthly-cap and debt checks applied
 * as they always are. Nothing is sent from the dashboard, so a second press
 * cannot pay twice.
 *
 * Rows whose user has no Safe cannot be picked — they would fail the same way
 * five more times and land right back here.
 */
export default function StuckCashbackBulk({ open }: { open: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cause, setCause] = useState<StuckCashbackCause | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] =
    useState<BulkReevaluateFailedCashbackResult | null>(null);

  const query = useQuery({
    queryKey: ["stuck-cashback"],
    queryFn: async () => (await getStuckCashback()).data.data,
    // Nothing is read until the section is opened.
    enabled: open,
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const causeCounts = useMemo(() => {
    const counts = new Map<StuckCashbackCause, number>();
    for (const row of rows) {
      counts.set(row.cause, (counts.get(row.cause) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (cause !== "all" && row.cause !== cause) return false;
      if (!term) return true;

      return [
        row.username,
        row.email,
        row.merchantName,
        row.transactionId,
        row.userId,
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [rows, search, cause]);

  // Selection is kept by id and read back through the current list, so a row
  // that left the list on a refresh (re-sent elsewhere, paid) drops out of it.
  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.id)),
    [rows, selected],
  );
  const selectedTotals = useMemo(() => totalsOf(selectedRows), [selectedRows]);

  const visibleSelectable = visible.filter((row) => row.hasPayoutAddress);
  const visibleSelectedCount = visibleSelectable.filter((row) =>
    selected.has(row.id),
  ).length;
  const headerChecked =
    visibleSelectable.length > 0 &&
    visibleSelectedCount === visibleSelectable.length
      ? true
      : visibleSelectedCount > 0
        ? "indeterminate"
        : false;
  const hiddenSelectedCount = selectedRows.length - visibleSelectedCount;

  const toggleRow = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      const selectAll = headerChecked !== true;
      for (const row of visibleSelectable) {
        if (selectAll) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });

  const mutation = useMutation({
    mutationFn: async (ids: string[]) =>
      (await bulkReevaluateFailedCashback(ids, reason.trim())).data.data,
    onSuccess: (data) => {
      setResult(data);
      setIsConfirmOpen(false);
      setReason("");
      setSelected(new Set());

      if (data.rearmed.length > 0) {
        toast.success(
          `${data.rearmed.length} cashback row${
            data.rearmed.length === 1 ? "" : "s"
          } queued for payout across ${data.users} user${
            data.users === 1 ? "" : "s"
          }`,
        );
      } else {
        toast.warning("Nothing re-sent — every row was skipped");
      }

      void queryClient.invalidateQueries({ queryKey: ["stuck-cashback"] });
    },
    onError: () => {
      // The API layer already shows the server's message; keep the dialog
      // open so the admin can retry.
    },
  });

  const closeConfirm = () => {
    if (mutation.isPending) return;
    setIsConfirmOpen(false);
  };

  if (!open && !query.data) return null;

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading stuck cashback…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex items-center gap-3 text-sm text-red-600">
        Could not load stuck cashback.
        <Button
          size="sm"
          variant="outline"
          onClick={() => void query.refetch()}
          className="cursor-pointer"
        >
          Try again
        </Button>
      </div>
    );
  }

  const { summary, total, truncated, generatedAt } = query.data;
  const minutes =
    Math.max(1, Math.ceil(selectedRows.length / RETRY_BATCH_SIZE)) *
    RETRY_INTERVAL_MINUTES;

  return (
    <div className="space-y-4">
      {result && (
        <BulkResult result={result} onDismiss={() => setResult(null)} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 text-sm text-gray-600">
          <p>
            <span className="font-semibold text-gray-900">
              {total} row{total === 1 ? "" : "s"}
            </span>{" "}
            across {summary.users} user{summary.users === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold text-gray-900">
              {formatUsd(summary.owedUsd)}
            </span>{" "}
            owed before monthly caps
            {summary.unpricedRows > 0 &&
              `, plus ${summary.unpricedRows} older row${
                summary.unpricedRows === 1 ? "" : "s"
              } priced at payout`}
          </p>
          {summary.noPayoutAddressRows > 0 && (
            <p className="text-xs text-gray-500">
              {summary.noPayoutAddressRows} row
              {summary.noPayoutAddressRows === 1 ? " belongs" : "s belong"} to
              users with no Safe yet and cannot be re-sent until they finish
              setting up.
            </p>
          )}
          {truncated && (
            <p className="text-xs text-amber-700">
              Showing the newest {rows.length} of {total}. Re-send these and
              refresh for the rest.
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="cursor-pointer"
          title={`Loaded ${formatDateTime(generatedAt)}`}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          No stuck cashback. Every failed payout is either paid or still
          retrying on its own.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Username, email, merchant or tx id"
                className="pl-8"
                aria-label="Filter stuck cashback"
              />
            </div>
            <Button
              size="xs"
              variant={cause === "all" ? "default" : "outline"}
              onClick={() => setCause("all")}
              className="cursor-pointer"
            >
              All ({rows.length})
            </Button>
            {CAUSE_ORDER.filter((key) => causeCounts.has(key)).map((key) => (
              <Button
                key={key}
                size="xs"
                variant={cause === key ? "default" : "outline"}
                onClick={() => setCause(key)}
                title={CAUSES[key].hint || undefined}
                className="cursor-pointer"
              >
                {CAUSES[key].label} ({causeCounts.get(key)})
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-700">
              {selectedRows.length === 0 ? (
                "Pick rows to re-send, or tick the header to pick every row shown."
              ) : (
                <>
                  <span className="font-semibold text-gray-900">
                    {selectedRows.length} selected
                  </span>{" "}
                  · {selectedTotals.users} user
                  {selectedTotals.users === 1 ? "" : "s"} ·{" "}
                  {formatUsd(selectedTotals.owedUsd)} owed
                  {selectedTotals.unpricedRows > 0 &&
                    ` + ${selectedTotals.unpricedRows} priced at payout`}
                  {hiddenSelectedCount > 0 &&
                    ` · ${hiddenSelectedCount} hidden by the filter`}
                </>
              )}
            </span>
            <div className="flex items-center gap-2">
              {selectedRows.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set())}
                  className="cursor-pointer"
                >
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setIsConfirmOpen(true)}
                disabled={selectedRows.length === 0 || mutation.isPending}
                className="cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                Re-send selected
              </Button>
            </div>
          </div>

          {/* The page scrolls the table, not the window, so the header and
              its select-all stay in view down a list of hundreds. */}
          <div className="max-h-[60vh] overflow-auto rounded-md border border-gray-200 [&_[data-slot=table-container]]:overflow-visible">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={headerChecked}
                      onCheckedChange={toggleAllVisible}
                      disabled={visibleSelectable.length === 0}
                      aria-label="Select every row shown"
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Why it stopped</TableHead>
                  <TableHead>Purchased</TableHead>
                  <TableHead>Gave up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-6 text-center text-gray-500"
                    >
                      No rows match the filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((row) => (
                    <StuckRow
                      key={row.id}
                      row={row}
                      checked={selected.has(row.id)}
                      onCheckedChange={(checked) => toggleRow(row.id, checked)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog
        open={isConfirmOpen}
        onOpenChange={(next) => (next ? setIsConfirmOpen(true) : closeConfirm())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Re-send {selectedRows.length} stuck cashback row
              {selectedRows.length === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Puts them back in the payout queue with a fresh set of retries,
              across {selectedTotals.users} user
              {selectedTotals.users === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1.5 text-xs text-gray-600">
            <li>
              Check the Cashback Payout wallet is funded first (Treasury →
              Wallets): these rows owe about{" "}
              <span className="font-semibold text-gray-900">
                {formatUsd(selectedTotals.owedUsd)}
              </span>{" "}
              before monthly caps
              {selectedTotals.unpricedRows > 0 &&
                `, plus ${selectedTotals.unpricedRows} older row${
                  selectedTotals.unpricedRows === 1 ? "" : "s"
                } priced at the user's rate on the day`}
              .
            </li>
            <li>
              The retry job pays {RETRY_BATCH_SIZE} rows every{" "}
              {RETRY_INTERVAL_MINUTES} minutes at the rate each was earned at,
              so this takes up to about {minutes} minutes. A frozen card, a
              full monthly cap or an open cashback debt still apply.
            </li>
            <li>
              Nothing is sent from here, so a second press cannot pay twice.
              Each user&apos;s audit trail records it under your name.
            </li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="bulk-reevaluate-cashback-reason">Reason</Label>
            <Textarea
              id="bulk-reevaluate-cashback-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="e.g. Fuse RPC 403 on Oct 20–21 — Monday 13354675798"
              disabled={mutation.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Optional. Recorded on every affected user&apos;s audit trail.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeConfirm}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate(selectedRows.map((row) => row.id))}
              disabled={mutation.isPending || selectedRows.length === 0}
              className="cursor-pointer"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Re-send {selectedRows.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StuckRow({
  row,
  checked,
  onCheckedChange,
}: {
  row: StuckCashbackRow;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const cause = CAUSES[row.cause] ?? CAUSES.other;
  const spend = Number(row.fiatAmount);

  return (
    <TableRow data-state={checked ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          disabled={!row.hasPayoutAddress}
          aria-label={`Select ${row.username ?? row.userId}'s ${
            row.merchantName ?? "purchase"
          }`}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Link
            href={`/users/${row.userId}`}
            className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            {row.username ?? "Unknown user"}
          </Link>
          {!row.hasPayoutAddress && <Badge variant="danger">No Safe</Badge>}
        </div>
        {row.email && <div className="text-xs text-gray-500">{row.email}</div>}
      </TableCell>
      <TableCell className="text-right font-medium text-gray-900 tabular-nums">
        {row.owedUsd === null ? (
          <span
            className="font-normal text-gray-500"
            title="Older row with no rate stored on it: the payout prices it at the user's rate on the day."
          >
            At payout
          </span>
        ) : (
          formatUsd(row.owedUsd)
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="text-gray-900">
          {Number.isFinite(spend) ? spend.toFixed(2) : row.fiatAmount}{" "}
          {row.fiatCurrency.toUpperCase()}
        </div>
        {row.cashbackPercentage !== undefined && (
          <div className="text-xs text-gray-500">
            at {+(row.cashbackPercentage * 100).toFixed(2)}%
          </div>
        )}
      </TableCell>
      <TableCell className="max-w-56 truncate" title={row.merchantName}>
        {row.merchantName ?? "—"}
        {row.type === "SubscriptionDiscount" && (
          <div className="text-xs text-gray-500">Subscription discount</div>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={cause.variant} title={row.lastError ?? cause.hint}>
          {cause.label}
        </Badge>
      </TableCell>
      <TableCell className="text-gray-600">
        {formatDateTime(row.purchasedAt)}
      </TableCell>
      <TableCell className="text-gray-600">
        {formatDateTime(row.failedAt)}
      </TableCell>
    </TableRow>
  );
}

/** What the last re-send did: queued, and what was skipped and why. */
function BulkResult({
  result,
  onDismiss,
}: {
  result: BulkReevaluateFailedCashbackResult;
  onDismiss: () => void;
}) {
  const skippedByReason = new Map<
    BulkReevaluateSkipReason,
    BulkReevaluateFailedCashbackResult["skipped"]
  >();
  for (const row of result.skipped) {
    skippedByReason.set(row.reason, [
      ...(skippedByReason.get(row.reason) ?? []),
      row,
    ]);
  }
  const queued = result.rearmed.length > 0;

  return (
    <div
      className={`space-y-2 rounded-md border px-4 py-3 text-sm ${
        queued
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-medium text-gray-900">
          {queued ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          {queued
            ? `${result.rearmed.length} of ${result.requested} row${
                result.requested === 1 ? "" : "s"
              } queued for payout across ${result.users} user${
                result.users === 1 ? "" : "s"
              }`
            : `None of the ${result.requested} rows was re-sent`}
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-500">
            {result.batchId}
          </span>
          <CopyButton value={result.batchId} label="Batch id" />
          <Button
            size="xs"
            variant="ghost"
            onClick={onDismiss}
            className="cursor-pointer"
          >
            Dismiss
          </Button>
        </div>
      </div>
      {queued && (
        <p className="text-gray-600">
          They pay on the next retry runs
          {result.expectedBy
            ? `, all by ${formatDateTime(result.expectedBy)}`
            : ""}
          . Each shows Failed on the user&apos;s cashback until then, then Paid.
        </p>
      )}
      {[...skippedByReason].map(([reason, rows]) => (
        <p key={reason} className="text-gray-600">
          <span className="font-medium text-gray-900">
            {rows.length} skipped
          </span>{" "}
          — {SKIP_REASONS[reason]}
          {rows.some((row) => row.username) &&
            `: ${unique(
              rows.map((row) => row.username).filter(Boolean) as string[],
            ).join(", ")}`}
        </p>
      ))}
    </div>
  );
}

function totalsOf(rows: StuckCashbackRow[]) {
  return {
    users: unique(rows.map((row) => row.userId)).length,
    owedUsd: rows.reduce((sum, row) => sum + (row.owedUsd ?? 0), 0),
    unpricedRows: rows.filter((row) => row.owedUsd === null).length,
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
