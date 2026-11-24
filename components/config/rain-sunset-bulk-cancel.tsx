"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Ban,
  Download,
  Loader2,
  ScanSearch,
  ShieldAlert,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import ConfirmationModal from "@/components/ui/confirmation-modal";
import { useDebounce } from "@/hooks/use-debounce";
import {
  fetchAllBulkCancelItems,
  useConfirmRainSunsetBulkCancel,
  usePreviewRainSunsetBulkCancel,
  useRainSunsetBulkCancel,
  useRainSunsetBulkCancelItems,
  useStopRainSunsetBulkCancel,
} from "@/hooks/use-rain-sunset-bulk-cancel";
import {
  balanceOnCardsToClose,
  bucketLabel,
  cardsKeptOpen,
  cardsToClose,
  confirmPhrase,
  isRunActive,
  isRunWorking,
  itemResultLabel,
  itemsToCsv,
  MODE_LABEL,
  phraseMatches,
  RUN_STATUS_LABEL,
  runProgress,
} from "@/lib/rain-sunset-bulk-cancel";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import type {
  RainSunsetBulkCancelItem,
  RainSunsetBulkCancelItemFilter,
  RainSunsetBulkCancelMode,
  RainSunsetBulkCancelRun,
} from "@/types";

const count = (value: number) => formatNumber(value, 0, 0);
const PAGE_SIZE = 50;

/**
 * Config → General → Rain sunset → "Close Rain cards".
 *
 * Closes the Rain cards of users who never moved to Wirex, in two steps:
 *
 * 1. **Preview** snapshots every Rain card still held and reads what each
 *    holder can still withdraw. Nothing changes; the list shows who is
 *    affected and what they hold.
 * 2. **Confirm** closes them at Rain — every previewed card, or only those
 *    holding $1 or less, so users with real money keep a working card to
 *    withdraw from. Low-balance mode re-reads each balance just before closing
 *    it. Closing is permanent; the admin types the count to confirm.
 *
 * A run can be stopped at any time; what it already closed stays closed.
 */
export function RainSunsetBulkCancelSection() {
  const { data, isLoading, error } = useRainSunsetBulkCancel();
  const preview = usePreviewRainSunsetBulkCancel();
  const stop = useStopRainSunsetBulkCancel();
  const [confirmingStop, setConfirmingStop] = useState(false);

  const run = data?.run ?? null;
  const active = run ? isRunActive(run.status) : false;
  const busy = preview.isPending || stop.isPending;

  const startPreview = () =>
    preview.mutate(undefined, {
      onSuccess: () => toast.success("Preview started. Reading balances…"),
      onError: (err) => toast.error(describeError(err, "Could not start the preview.")),
    });

  const stopRun = () => {
    if (!run) return;
    stop.mutate(run.id, {
      onSuccess: (stopped) =>
        toast.success(
          stopped.status === "stopped"
            ? "Stopped. Cards already closed stay closed."
            : "Preview discarded.",
        ),
      onError: (err) => toast.error(describeError(err, "Could not stop the run.")),
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              Close Rain cards
            </span>
            {run ? <RunStatusBadge run={run} /> : null}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">
            Close the Rain cards still held by users who never moved to Wirex.
            Preview first: it lists every affected user and what their card
            still holds, and changes nothing. Then confirm closing every card,
            or only the ones holding $1 or less so users with money left keep
            a working card to withdraw from. Closing a card is permanent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {run && (isRunWorking(run.status) || run.status === "ready") ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run.status === "cancelling" ? setConfirmingStop(true) : stopRun()
              }
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Square className="h-3.5 w-3.5" aria-hidden />
              {run.status === "cancelling" ? "Stop" : "Discard preview"}
            </button>
          ) : null}
          {!active ? (
            <button
              type="button"
              disabled={busy || isLoading}
              onClick={startPreview}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {preview.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <ScanSearch className="h-3.5 w-3.5" aria-hidden />
              )}
              {run ? "Preview again" : "Preview"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="border-t border-gray-100 p-4 text-xs text-red-700">
          {describeError(error, "Could not load the bulk cancel.")}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex h-24 items-center justify-center border-t border-gray-100">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden />
        </div>
      ) : null}

      {run ? (
        <div className="space-y-4 border-t border-gray-100 p-4">
          <RunSummary run={run} />
          {run.status === "ready" ? <ConfirmPanel run={run} /> : null}
          {run.status !== "discarded" ? <AffectedUsers run={run} /> : null}
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={confirmingStop}
        title="Stop closing Rain cards?"
        confirmText="Stop"
        onCancel={() => setConfirmingStop(false)}
        onConfirm={() => {
          setConfirmingStop(false);
          stopRun();
        }}
        message={
          <p className="text-sm">
            The cards being closed right now finish; no more are closed after
            them. Cards already closed stay closed. Preview again to pick up
            the ones left.
          </p>
        }
      />
    </div>
  );
}

function RunStatusBadge({ run }: { run: RainSunsetBulkCancelRun }) {
  const tone =
    run.status === "cancelling"
      ? "bg-red-50 text-red-700"
      : run.status === "completed"
        ? "bg-emerald-50 text-emerald-700"
        : run.status === "ready" || run.status === "previewing"
          ? "bg-indigo-50 text-indigo-700"
          : "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>
      {RUN_STATUS_LABEL[run.status]}
      {isRunWorking(run.status) ? ` · ${runProgress(run)}%` : ""}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
      {hint ? <div className="text-xs text-gray-400">{hint}</div> : null}
    </div>
  );
}

function RunSummary({ run }: { run: RainSunsetBulkCancelRun }) {
  const { preview, execution } = run;
  const limit = formatUsd(run.maxBalanceUsd);
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Previewed by <strong>{run.createdBy}</strong>{" "}
        {formatDateTime(run.createdAt)}
        {run.confirmedBy ? (
          <>
            {" "}
            · confirmed by <strong>{run.confirmedBy}</strong>{" "}
            {run.confirmedAt ? formatDateTime(run.confirmedAt) : ""} (
            {run.mode ? MODE_LABEL[run.mode].toLowerCase() : ""})
          </>
        ) : null}
        {run.stoppedBy ? (
          <>
            {" "}
            · {run.status === "discarded" ? "discarded" : "stopped"} by{" "}
            <strong>{run.stoppedBy}</strong>
          </>
        ) : null}
        {run.finishedAt && run.status === "completed" ? (
          <> · finished {formatDateTime(run.finishedAt)}</>
        ) : null}
      </p>

      {isRunWorking(run.status) ? <ProgressBar run={run} /> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Rain cards"
          value={count(preview.cards)}
          hint={`${count(preview.users)} users`}
        />
        <Stat
          label={`Holding ${limit} or less`}
          value={count(preview.low.cards)}
          hint={`${formatUsd(preview.low.balanceUsd)} in total`}
        />
        <Stat
          label={`Holding more than ${limit}`}
          value={count(preview.high.cards)}
          hint={`${formatUsd(preview.high.balanceUsd)} in total`}
        />
        <Stat
          label="Balance unreadable"
          value={count(preview.unknown.cards)}
          hint={
            run.status === "previewing"
              ? `${count(preview.cards - preview.read)} still to read`
              : "Kept open in low-balance mode"
          }
        />
      </div>
      <p className="text-xs text-gray-500">
        {count(preview.migrationStarted)} of these users started a move to
        Wirex; {count(preview.accountDeleted)} closed their Solid account. The
        balance is what the holder can still withdraw: collateral that settled
        card spend still owes Rain is not theirs.
      </p>

      {execution ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat
            label="Closed"
            value={count(execution.cancelled + execution.alreadyCancelled)}
            hint={`of ${count(execution.selected)} selected`}
          />
          <Stat
            label="Kept: over the limit"
            value={count(execution.skippedBalance)}
            hint="Topped up since the preview"
          />
          <Stat
            label="Kept: unreadable"
            value={count(execution.skippedUnreadable)}
          />
          <Stat
            label="Kept: no longer held"
            value={count(execution.skippedNotHeld)}
            hint="Moved to Wirex or closed"
          />
          <Stat
            label="Failed"
            value={count(execution.failed)}
            hint={
              execution.notProcessed > 0 && run.status !== "cancelling"
                ? `${count(execution.notProcessed)} not reached`
                : undefined
            }
          />
        </div>
      ) : null}

      {execution && execution.failed > 0 && !isRunWorking(run.status) ? (
        <p className="text-xs text-amber-700">
          Cards that failed stay open. Preview again to retry them: the new
          preview picks up every Rain card still held.
        </p>
      ) : null}
    </div>
  );
}

function ProgressBar({ run }: { run: RainSunsetBulkCancelRun }) {
  const percent = runProgress(run);
  const label =
    run.status === "previewing"
      ? `Reading balances: ${count(run.preview.read)} of ${count(run.preview.cards)}`
      : `Closing cards: ${count(run.execution?.processed ?? 0)} of ${count(run.execution?.selected ?? 0)}`;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full transition-all ${
            run.status === "cancelling" ? "bg-red-500" : "bg-indigo-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ConfirmPanel({ run }: { run: RainSunsetBulkCancelRun }) {
  const confirm = useConfirmRainSunsetBulkCancel();
  const [mode, setMode] = useState<RainSunsetBulkCancelMode>("low_balance");
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  const toClose = cardsToClose(run, mode);
  const keptOpen = cardsKeptOpen(run, mode);
  const money = balanceOnCardsToClose(run, mode);
  const limit = formatUsd(run.maxBalanceUsd);

  const submit = () => {
    confirm.mutate(
      { runId: run.id, mode, expectedCount: toClose },
      {
        onSuccess: () => {
          setConfirming(false);
          setTyped("");
          toast.success(`Closing ${count(toClose)} Rain cards.`);
        },
        onError: (err) =>
          toast.error(describeError(err, "Could not start closing the cards.")),
      },
    );
  };

  const options: Array<{
    value: RainSunsetBulkCancelMode;
    title: string;
    detail: string;
  }> = [
    {
      value: "low_balance",
      title: `Only cards holding ${limit} or less — ${count(cardsToClose(run, "low_balance"))} cards`,
      detail: `Keeps ${count(cardsKeptOpen(run, "low_balance"))} cards open: those holding more, and those whose balance could not be read, so their holders can withdraw first. Each balance is re-read just before its card is closed.`,
    },
    {
      value: "all",
      title: `Every previewed card — ${count(cardsToClose(run, "all"))} cards`,
      detail: `Includes ${count(run.preview.high.cards)} cards holding ${formatUsd(run.preview.high.balanceUsd)} in total and ${count(run.preview.unknown.cards)} whose balance could not be read.`,
    },
  ];

  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-3">
      <div className="text-sm font-medium text-gray-900">Which cards to close</div>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm ${
              mode === option.value
                ? "border-indigo-300 bg-indigo-50"
                : "border-gray-200"
            }`}
          >
            <input
              type="radio"
              name="rain-bulk-cancel-mode"
              className="mt-1"
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
            />
            <span>
              <span className="block font-medium text-gray-900">
                {option.title}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {option.detail}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {run.previewExpiresAt
            ? `This preview can be confirmed until ${formatDateTime(run.previewExpiresAt)}.`
            : null}
        </p>
        <button
          type="button"
          disabled={toClose === 0 || confirm.isPending}
          onClick={() => setConfirming(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirm.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Ban className="h-3.5 w-3.5" aria-hidden />
          )}
          Close {count(toClose)} cards
        </button>
      </div>

      <ConfirmationModal
        isOpen={confirming}
        title={`Close ${count(toClose)} Rain cards?`}
        isDestructive
        confirmText={confirm.isPending ? "Starting…" : "Close cards"}
        confirmDisabled={!phraseMatches(typed, toClose) || confirm.isPending}
        onCancel={() => {
          setConfirming(false);
          setTyped("");
        }}
        onConfirm={submit}
        message={
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-900">
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                aria-hidden
              />
              <p>
                Closing is permanent. A closed card stops working at once and
                cannot be reopened; its holder gets a new card only by moving
                to Wirex.
              </p>
            </div>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                {MODE_LABEL[mode]}: <strong>{count(toClose)}</strong> cards
                close, holding {formatUsd(money)} in total at preview.
              </li>
              <li>
                <strong>{count(keptOpen)}</strong> cards stay open.
              </li>
              <li>
                Every closed card is recorded in its holder&apos;s admin trail
                under your name.
              </li>
            </ul>
            <label className="block">
              <span className="text-xs text-gray-600">
                Type <code className="font-semibold">{confirmPhrase(toClose)}</code>{" "}
                to confirm
              </span>
              <input
                type="text"
                value={typed}
                autoFocus
                onChange={(event) => setTyped(event.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </label>
          </div>
        }
      />
    </div>
  );
}

const PREVIEW_FILTERS: Array<{
  value: RainSunsetBulkCancelItemFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "low", label: "≤ $1" },
  { value: "high", label: "> $1" },
  { value: "unknown", label: "Unreadable" },
];

const RESULT_FILTERS: typeof PREVIEW_FILTERS = [
  { value: "cancelled", label: "Closed" },
  { value: "kept", label: "Still open" },
  { value: "skipped", label: "Kept by the run" },
  { value: "failed", label: "Failed" },
];

function AffectedUsers({ run }: { run: RainSunsetBulkCancelRun }) {
  const [filter, setFilter] = useState<RainSunsetBulkCancelItemFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const working = isRunWorking(run.status);

  const { data, isFetching, error } = useRainSunsetBulkCancelItems(
    run.id,
    { filter, search: debouncedSearch, page, limit: PAGE_SIZE },
    working,
  );

  const filters = run.mode ? [...PREVIEW_FILTERS, ...RESULT_FILTERS] : PREVIEW_FILTERS;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const items = await fetchAllBulkCancelItems(run.id);
      const blob = new Blob([itemsToCsv(items, run)], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rain-cards-${run.id}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(describeError(err as Error, "Could not export the list."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFilter(option.value);
                setPage(1);
              }}
              className={`cursor-pointer rounded-full px-2.5 py-1 text-xs transition-colors ${
                filter === option.value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Email, username, user or card id"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-60 rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={exporting || run.preview.cards === 0}
            onClick={() => void exportCsv()}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            CSV
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red-700">
          {describeError(error, "Could not load the affected users.")}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Country</th>
              <th className="px-3 py-2 font-medium">Card</th>
              <th className="px-3 py-2 text-right font-medium">Withdrawable</th>
              <th className="px-3 py-2 text-right font-medium">Collateral</th>
              <th className="px-3 py-2 font-medium">Balance</th>
              <th className="px-3 py-2 font-medium">Notes</th>
              {run.mode ? <th className="px-3 py-2 font-medium">Result</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data?.items ?? []).map((item) => (
              <ItemRow key={item.cardId} item={item} run={run} />
            ))}
            {data && data.items.length === 0 ? (
              <tr>
                <td
                  colSpan={run.mode ? 8 : 7}
                  className="px-3 py-6 text-center text-gray-400"
                >
                  No cards match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {count(total)} cards{isFetching ? " · updating…" : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="cursor-pointer rounded border border-gray-300 px-2 py-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="cursor-pointer rounded border border-gray-300 px-2 py-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  run,
}: {
  item: RainSunsetBulkCancelItem;
  run: RainSunsetBulkCancelRun;
}) {
  const result = itemResultLabel(item, run);
  const resultTone =
    item.outcome === "failed"
      ? "text-red-700"
      : item.outcome === "cancelled" || item.outcome === "already_cancelled"
        ? "text-gray-900"
        : "text-gray-500";
  const notes = [
    item.migrationStarted ? "Move to Wirex started" : null,
    item.accountDeleted ? "Account closed" : null,
  ].filter(Boolean);
  return (
    <tr>
      <td className="px-3 py-2">
        <Link
          href={`/users/${item.userId}`}
          className="font-medium text-indigo-600 hover:underline"
        >
          {item.username ?? item.userId}
        </Link>
        {item.email ? (
          <div className="text-gray-400">{item.email}</div>
        ) : null}
      </td>
      <td className="px-3 py-2">{item.country ?? "—"}</td>
      <td className="px-3 py-2">
        <div className="font-mono text-gray-600">{item.cardId}</div>
        <div className="text-gray-400">{item.cardStatus}</div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {item.balanceUsd === null ? "—" : formatUsd(item.balanceUsd)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-500">
        {item.totalCollateralUsd === null
          ? "—"
          : formatUsd(item.totalCollateralUsd)}
      </td>
      <td className="px-3 py-2">
        <span
          title={item.balanceError ?? undefined}
          className={
            item.bucket === "high"
              ? "text-amber-700"
              : item.bucket === "unknown"
                ? "text-red-700"
                : "text-gray-700"
          }
        >
          {bucketLabel(item.bucket, run.maxBalanceUsd)}
        </span>
      </td>
      <td className="px-3 py-2 text-gray-500">
        {notes.length ? notes.join(" · ") : "—"}
      </td>
      {run.mode ? (
        <td className={`px-3 py-2 ${resultTone}`}>
          <span title={item.outcomeError ?? undefined}>{result ?? "—"}</span>
          {item.outcomeBalanceUsd !== null ? (
            <div className="text-gray-400">
              at {formatUsd(item.outcomeBalanceUsd)}
            </div>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}

/** The backend's own reason (a 409 says why), else `fallback`. */
function describeError(error: Error, fallback: string): string {
  const response = (
    error as Error & {
      response?: { data?: { message?: string | string[] } };
    }
  ).response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}
