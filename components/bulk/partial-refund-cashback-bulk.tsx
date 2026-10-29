"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import {
  getPartialRefundVoidedCashback,
  restorePartialRefundVoidedCashback,
} from "@/lib/api";
import { formatDateTime, formatUsd } from "@/lib/utils";
import {
  PartialRefundRestoreResult,
  PartialRefundRestoreSkipReason,
  PartialRefundVoidedRow,
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

/** Wirex's refund reasons, in the words support uses. */
const REFUND_REASONS: Record<string, { label: string; hint: string }> = {
  Clearing: {
    label: "Hold settled lower",
    hint: "The merchant held more than it charged — fuel, hotels, car rental — and the unused part came back.",
  },
  Refund: {
    label: "Partial refund",
    hint: "The merchant refunded part of it.",
  },
  Reversal: {
    label: "Partial reversal",
    hint: "Part of the authorisation was reversed.",
  },
};

const SKIP_REASONS: Record<PartialRefundRestoreSkipReason, string> = {
  not_refund_voided: "Already restored, or changed since the list loaded",
  refund_not_partial: "The refunds now add up to the whole purchase",
  uncollected_debit:
    "The refund settled a charge we never collected, so nothing kept was paid for",
  user_not_found: "The account no longer exists",
};

/**
 * Cashback a partial refund voided: every purchase whose cashback was cancelled
 * in full when only part of it came back, restored on the part the user kept.
 *
 * ## Why this exists
 *
 * Until Oct 29 2026 a refund that landed before a purchase's cashback paid
 * cancelled all of it, however little came back. A fuel station that holds
 * €150 and charges €52.34 returns the unused €98, and the cashback on the €52.34
 * the user actually spent went with it (robertofd31, Plenergy, Oct 27). New
 * refunds now shrink the cashback instead; this puts back the ones that were
 * cancelled before.
 *
 * ## What "restore" does
 *
 * Each picked row goes back in the escrow queue owed on what was kept, at the
 * user's cashback rate today — the rate it accrued at was cleared when it was
 * cancelled. It pays on its original payout date, or on the next hourly run if
 * that has passed, through the normal payout path with the frozen-card,
 * monthly-cap and debt checks. Nothing is sent from the dashboard, so a second
 * press cannot pay twice.
 */
export default function PartialRefundCashbackBulk({ open }: { open: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [refundReason, setRefundReason] = useState<string | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<RestoreOutcome | null>(null);

  const query = useQuery({
    queryKey: ["partial-refund-voided-cashback"],
    queryFn: async () => (await getPartialRefundVoidedCashback()).data.data,
    // Nothing is read until the section is opened.
    enabled: open,
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const reasonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const key of row.refundReasons) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (refundReason !== "all" && !row.refundReasons.includes(refundReason)) {
        return false;
      }
      if (!term) return true;

      return [
        row.username,
        row.email,
        row.merchantName,
        row.transactionId,
        row.userId,
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [rows, search, refundReason]);

  // Selection is kept by id and read back through the current list, so a row
  // that left the list on a refresh (restored elsewhere) drops out of it.
  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.id)),
    [rows, selected],
  );
  const selectedTotals = useMemo(() => totalsOf(selectedRows), [selectedRows]);

  const visibleSelectedCount = visible.filter((row) =>
    selected.has(row.id),
  ).length;
  const headerChecked =
    visible.length > 0 && visibleSelectedCount === visible.length
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
      for (const row of visible) {
        if (selectAll) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });

  const mutation = useMutation({
    mutationFn: async (ids: string[]) =>
      (await restorePartialRefundVoidedCashback(ids, reason.trim())).data.data,
    onSuccess: (data) => {
      // Counted here, against the moment the restore returned, rather than in
      // render, where the clock would make the banner shift on every re-render.
      const now = Date.now();
      setResult({
        ...data,
        dueNow: data.restored.filter(
          (row) => new Date(row.payoutAt).getTime() <= now + 60_000,
        ).length,
      });
      setIsConfirmOpen(false);
      setReason("");
      setSelected(new Set());

      if (data.restored.length > 0) {
        toast.success(
          `${data.restored.length} cashback row${
            data.restored.length === 1 ? "" : "s"
          } restored across ${data.users} user${data.users === 1 ? "" : "s"}`,
        );
      } else {
        toast.warning("Nothing restored — every row was skipped");
      }

      void queryClient.invalidateQueries({
        queryKey: ["partial-refund-voided-cashback"],
      });
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
        Loading cashback voided by partial refunds…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex items-center gap-3 text-sm text-red-600">
        Could not load cashback voided by partial refunds.
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

  return (
    <div className="space-y-4">
      {result && (
        <RestoreResult result={result} onDismiss={() => setResult(null)} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 text-sm text-gray-600">
          <p>
            <span className="font-semibold text-gray-900">
              {total} purchase{total === 1 ? "" : "s"}
            </span>{" "}
            across {summary.users} user{summary.users === 1 ? "" : "s"} ·{" "}
            {formatUsd(summary.keptUsd)} kept ·{" "}
            <span className="font-semibold text-gray-900">
              {formatUsd(summary.owedUsd)}
            </span>{" "}
            cashback before monthly caps
            {summary.unpricedRows > 0 &&
              `, plus ${summary.unpricedRows} priced when restored`}
          </p>
          <p className="text-xs text-gray-500">
            Priced at each user&apos;s cashback rate today: the rate a purchase
            accrued at was cleared when its cashback was cancelled.
          </p>
          {truncated && (
            <p className="text-xs text-amber-700">
              Showing the newest {rows.length} of {total}. Restore these and
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
          Nothing to restore. Every cancelled cashback was on a purchase that
          came back in full.
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
                aria-label="Filter cashback voided by partial refunds"
              />
            </div>
            <Button
              size="xs"
              variant={refundReason === "all" ? "default" : "outline"}
              onClick={() => setRefundReason("all")}
              className="cursor-pointer"
            >
              All ({rows.length})
            </Button>
            {[...reasonCounts].map(([key, count]) => (
              <Button
                key={key}
                size="xs"
                variant={refundReason === key ? "default" : "outline"}
                onClick={() => setRefundReason(key)}
                title={REFUND_REASONS[key]?.hint}
                className="cursor-pointer"
              >
                {REFUND_REASONS[key]?.label ?? key} ({count})
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-700">
              {selectedRows.length === 0 ? (
                "Pick rows to restore, or tick the header to pick every row shown."
              ) : (
                <>
                  <span className="font-semibold text-gray-900">
                    {selectedRows.length} selected
                  </span>{" "}
                  · {selectedTotals.users} user
                  {selectedTotals.users === 1 ? "" : "s"} ·{" "}
                  {formatUsd(selectedTotals.owedUsd)} cashback
                  {selectedTotals.unpricedRows > 0 &&
                    ` + ${selectedTotals.unpricedRows} priced when restored`}
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
                <RotateCcw className="h-3.5 w-3.5" />
                Restore selected
              </Button>
            </div>
          </div>

          {/* The page scrolls the table, not the window, so the header and
              its select-all stay in view down a long list. */}
          <div className="max-h-[60vh] overflow-auto rounded-md border border-gray-200 [&_[data-slot=table-container]]:overflow-visible">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={headerChecked}
                      onCheckedChange={toggleAllVisible}
                      disabled={visible.length === 0}
                      aria-label="Select every row shown"
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Cashback</TableHead>
                  <TableHead className="text-right">Kept</TableHead>
                  <TableHead className="text-right">Refunded</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Purchased</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-6 text-center text-gray-500"
                    >
                      No rows match the filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((row) => (
                    <VoidedRow
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
        onOpenChange={(next) =>
          next ? setIsConfirmOpen(true) : closeConfirm()
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Restore cashback on {selectedRows.length} purchase
              {selectedRows.length === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Puts each back in the payout queue, owed on the part of the
              purchase the user kept, across {selectedTotals.users} user
              {selectedTotals.users === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1.5 text-xs text-gray-600">
            <li>
              About{" "}
              <span className="font-semibold text-gray-900">
                {formatUsd(selectedTotals.owedUsd)}
              </span>{" "}
              at each user&apos;s rate today, before monthly caps.
            </li>
            <li>
              Each pays on its original payout date — 14 days after the purchase
              — or on the next hourly payout run if that has passed. A frozen
              card, a full monthly cap or an open cashback debt still apply.
            </li>
            <li>
              Nothing is sent from here, so a second press cannot pay twice.
              Each user&apos;s audit trail records it under your name.
            </li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="restore-partial-refund-cashback-reason">
              Reason
            </Label>
            <Textarea
              id="restore-partial-refund-cashback-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="e.g. Fuel hold settled lower — Monday 13354414651"
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
              Restore {selectedRows.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VoidedRow({
  row,
  checked,
  onCheckedChange,
}: {
  row: PartialRefundVoidedRow;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <TableRow data-state={checked ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label={`Select ${row.username ?? row.userId}'s ${
            row.merchantName ?? "purchase"
          }`}
        />
      </TableCell>
      <TableCell>
        <Link
          href={`/users/${row.userId}`}
          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {row.username ?? "Unknown user"}
        </Link>
        {row.email && <div className="text-xs text-gray-500">{row.email}</div>}
      </TableCell>
      <TableCell className="text-right font-medium text-gray-900 tabular-nums">
        {row.owedUsd === null ? (
          <span
            className="font-normal text-gray-500"
            title="The user's rate could not be read; it is read again when restored."
          >
            When restored
          </span>
        ) : (
          formatUsd(row.owedUsd)
        )}
        {row.percentage !== null && (
          <div className="text-xs font-normal text-gray-500">
            at {+(row.percentage * 100).toFixed(2)}%
          </div>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="text-gray-900">{formatUsd(row.keptUsd)}</div>
        <div className="text-xs text-gray-500">
          of {formatUsd(row.purchaseUsd)}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="text-gray-900">{formatUsd(row.refundedUsd)}</div>
        <div className="flex flex-wrap justify-end gap-1 pt-0.5">
          {row.refundReasons.map((key) => (
            <Badge key={key} variant="muted" title={REFUND_REASONS[key]?.hint}>
              {REFUND_REASONS[key]?.label ?? key}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="max-w-56 truncate" title={row.merchantName}>
        {row.merchantName ?? "—"}
        {row.merchantCategoryCode && (
          <div className="text-xs text-gray-500">
            MCC {row.merchantCategoryCode}
          </div>
        )}
      </TableCell>
      <TableCell className="text-gray-600">
        {formatDateTime(row.purchasedAt)}
      </TableCell>
    </TableRow>
  );
}

/** A restore's result, with how many of its rows pay on the next hourly run. */
type RestoreOutcome = PartialRefundRestoreResult & { dueNow: number };

/** What the last restore did: restored, and what was skipped and why. */
function RestoreResult({
  result,
  onDismiss,
}: {
  result: RestoreOutcome;
  onDismiss: () => void;
}) {
  const skippedByReason = new Map<
    PartialRefundRestoreSkipReason,
    PartialRefundRestoreResult["skipped"]
  >();
  for (const row of result.skipped) {
    skippedByReason.set(row.reason, [
      ...(skippedByReason.get(row.reason) ?? []),
      row,
    ]);
  }
  const restored = result.restored.length > 0;
  const { dueNow } = result;

  return (
    <div
      className={`space-y-2 rounded-md border px-4 py-3 text-sm ${
        restored
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-medium text-gray-900">
          {restored ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          {restored
            ? `${result.restored.length} of ${result.requested} row${
                result.requested === 1 ? "" : "s"
              } restored across ${result.users} user${
                result.users === 1 ? "" : "s"
              }`
            : `None of the ${result.requested} rows was restored`}
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
      {restored && (
        <p className="text-gray-600">
          {dueNow > 0 &&
            `${dueNow} pay${dueNow === 1 ? "s" : ""} on the next hourly payout run. `}
          {result.restored.length > dueNow &&
            `${result.restored.length - dueNow} pay${
              result.restored.length - dueNow === 1 ? "s" : ""
            } on ${result.restored.length - dueNow === 1 ? "its" : "their"} original payout date. `}
          Each shows as pending on the user&apos;s cashback until then.
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

function totalsOf(rows: PartialRefundVoidedRow[]) {
  return {
    users: unique(rows.map((row) => row.userId)).length,
    owedUsd: rows.reduce((sum, row) => sum + (row.owedUsd ?? 0), 0),
    unpricedRows: rows.filter((row) => row.owedUsd === null).length,
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
