import type {
  RainSunsetBalanceBucket,
  RainSunsetBulkCancelItem,
  RainSunsetBulkCancelMode,
  RainSunsetBulkCancelOutcome,
  RainSunsetBulkCancelRun,
  RainSunsetBulkCancelRunStatus,
} from "@/types";

/**
 * Pure logic behind Config → General → Rain sunset → "Close Rain cards": what
 * a mode closes, how far a run has got, the words for each state, and the CSV
 * of affected users. Kept apart from the component so it is unit-tested.
 */

/** A run that still has work in it: the page polls while one is shown. */
export function isRunWorking(status: RainSunsetBulkCancelRunStatus): boolean {
  return status === "previewing" || status === "cancelling";
}

/** A run that holds the one active slot: no new preview until it ends. */
export function isRunActive(status: RainSunsetBulkCancelRunStatus): boolean {
  return isRunWorking(status) || status === "ready";
}

/** How many previewed cards `mode` closes, at most. */
export function cardsToClose(
  run: Pick<RainSunsetBulkCancelRun, "preview">,
  mode: RainSunsetBulkCancelMode,
): number {
  return mode === "low_balance" ? run.preview.low.cards : run.preview.cards;
}

/** How many previewed cards `mode` leaves open. */
export function cardsKeptOpen(
  run: Pick<RainSunsetBulkCancelRun, "preview">,
  mode: RainSunsetBulkCancelMode,
): number {
  return run.preview.cards - cardsToClose(run, mode);
}

/** Money on the cards `mode` closes, as far as the preview could read it. */
export function balanceOnCardsToClose(
  run: Pick<RainSunsetBulkCancelRun, "preview">,
  mode: RainSunsetBulkCancelMode,
): number {
  const { low, high } = run.preview;
  const total =
    mode === "low_balance" ? low.balanceUsd : low.balanceUsd + high.balanceUsd;
  return Math.round(total * 100) / 100;
}

/** 0–100: balances read while previewing, cards processed while closing. */
export function runProgress(run: RainSunsetBulkCancelRun): number {
  const [done, of] =
    run.status === "previewing" || !run.execution
      ? [run.preview.read, run.preview.cards]
      : [run.execution.processed, run.execution.selected];
  if (of <= 0) return 100;
  return Math.min(100, Math.floor((done / of) * 100));
}

/**
 * What the admin types to confirm. Carries the count, so a confirmation typed
 * for one mode cannot confirm the other.
 */
export function confirmPhrase(count: number): string {
  return `CLOSE ${count}`;
}

/** Whether the typed text confirms, ignoring case and outer spaces. */
export function phraseMatches(typed: string, count: number): boolean {
  return typed.trim().toUpperCase() === confirmPhrase(count);
}

export const RUN_STATUS_LABEL: Record<RainSunsetBulkCancelRunStatus, string> = {
  previewing: "Reading balances",
  ready: "Preview ready",
  cancelling: "Closing cards",
  completed: "Completed",
  stopped: "Stopped",
  discarded: "Discarded",
};

export const MODE_LABEL: Record<RainSunsetBulkCancelMode, string> = {
  all: "All previewed cards",
  low_balance: "Only cards holding $1 or less",
};

export function bucketLabel(
  bucket: RainSunsetBalanceBucket | null,
  maxBalanceUsd = 1,
): string {
  const limit = `$${maxBalanceUsd.toFixed(2)}`;
  switch (bucket) {
    case "low":
      return `≤ ${limit}`;
    case "high":
      return `> ${limit}`;
    case "unknown":
      return "Unreadable";
    default:
      return "Reading…";
  }
}

export const OUTCOME_LABEL: Record<RainSunsetBulkCancelOutcome, string> = {
  cancelled: "Closed",
  already_cancelled: "Already closed at Rain",
  skipped_balance: "Kept: holds more than $1",
  skipped_unreadable: "Kept: balance unreadable",
  skipped_not_held: "Kept: no longer held",
  failed: "Failed",
};

/**
 * What happened to a card, for its row: its outcome, or — once a run is
 * confirmed — why it was not closed or that it is still waiting.
 */
export function itemResultLabel(
  item: Pick<RainSunsetBulkCancelItem, "outcome" | "bucket">,
  run: Pick<RainSunsetBulkCancelRun, "status" | "mode">,
): string | null {
  if (item.outcome) return OUTCOME_LABEL[item.outcome];
  if (!run.mode) return null;
  if (run.mode === "low_balance" && item.bucket !== "low") {
    return "Kept open (not selected)";
  }
  return run.status === "cancelling" ? "Waiting" : "Not reached";
}

/** One CSV field, quoted when it has to be. */
function csvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Neutralise spreadsheet formulas in user-supplied text (usernames).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The affected users as CSV, one row per card. */
export function itemsToCsv(
  items: RainSunsetBulkCancelItem[],
  run: Pick<RainSunsetBulkCancelRun, "status" | "mode" | "maxBalanceUsd">,
): string {
  const header = [
    "userId",
    "username",
    "email",
    "country",
    "cardId",
    "cardStatus",
    "withdrawableUsd",
    "collateralUsd",
    "balanceGroup",
    "balanceError",
    "migrationStarted",
    "accountClosed",
    "result",
    "resultBalanceUsd",
    "resultError",
    "processedAt",
  ];
  const rows = items.map((item) =>
    [
      item.userId,
      item.username,
      item.email,
      item.country,
      item.cardId,
      item.cardStatus,
      item.balanceUsd,
      item.totalCollateralUsd,
      bucketLabel(item.bucket, run.maxBalanceUsd),
      item.balanceError,
      item.migrationStarted,
      item.accountDeleted,
      itemResultLabel(item, run),
      item.outcomeBalanceUsd,
      item.outcomeError,
      item.processedAt,
    ]
      .map(csvField)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}
