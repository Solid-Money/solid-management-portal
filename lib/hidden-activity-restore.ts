import type {
  HiddenActivityRestoreBlock,
  HiddenActivityRestoreEntry,
  HiddenActivityRestorePreview,
} from "@/types/hidden-activity-restore";

/** How the panel names each reason a row stays hidden. */
export const HIDDEN_RESTORE_BLOCK_LABELS: Record<
  HiddenActivityRestoreBlock,
  string
> = {
  token_not_listed: "Spam token (still not listed)",
  internal_transfer: "Deposit or withdrawal leg",
  settlement_sweep: "Card settlement sweep",
  settlement_unknown: "Treasury unreadable — retry later",
  duplicate: "Already shown by another row",
  no_hash: "Never sent on chain",
};

const isNullableString = (value: unknown) =>
  value === null || typeof value === "string";

/** Whether one preview row has every field the review table renders. */
export function isHiddenActivityRestoreEntry(
  value: unknown,
): value is HiddenActivityRestoreEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<HiddenActivityRestoreEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.userId === "string" &&
    typeof entry.type === "string" &&
    typeof entry.status === "string" &&
    typeof entry.amount === "string" &&
    typeof entry.symbol === "string" &&
    (entry.chainId === null || typeof entry.chainId === "number") &&
    isNullableString(entry.hash) &&
    isNullableString(entry.createdAt) &&
    (entry.state === "eligible" || entry.state === "blocked") &&
    (entry.blockedReason === undefined ||
      typeof entry.blockedReason === "string")
  );
}

/**
 * Whether a preview response has the shape the panel renders, rows included:
 * one malformed row would otherwise throw while the table renders.
 */
export function isHiddenActivityRestorePreview(
  value: unknown,
): value is HiddenActivityRestorePreview {
  if (!value || typeof value !== "object") return false;
  const preview = value as Partial<HiddenActivityRestorePreview>;
  return (
    isNullableString(preview.userId) &&
    typeof preview.scanned === "number" &&
    typeof preview.eligible === "number" &&
    typeof preview.accounts === "number" &&
    typeof preview.batchLimit === "number" &&
    typeof preview.hasMore === "boolean" &&
    typeof preview.previewToken === "string" &&
    typeof preview.canApply === "boolean" &&
    !!preview.blocked &&
    typeof preview.blocked === "object" &&
    !Array.isArray(preview.blocked) &&
    Array.isArray(preview.entries) &&
    preview.entries.every(isHiddenActivityRestoreEntry)
  );
}

/**
 * The reasons rows stay hidden, most common first, without the empty ones.
 * Unknown reasons from a newer server keep their raw name rather than vanish.
 */
export function hiddenReasonSummary(
  blocked: HiddenActivityRestorePreview["blocked"],
): { reason: string; label: string; count: number }[] {
  return Object.entries(blocked)
    .filter(([, count]) => typeof count === "number" && count > 0)
    .map(([reason, count]) => ({
      reason,
      label:
        HIDDEN_RESTORE_BLOCK_LABELS[reason as HiddenActivityRestoreBlock] ??
        reason,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Every row left hidden, across reasons. */
export function hiddenTotal(
  blocked: HiddenActivityRestorePreview["blocked"],
): number {
  return Object.values(blocked).reduce(
    (sum, count) => sum + (typeof count === "number" ? count : 0),
    0,
  );
}
