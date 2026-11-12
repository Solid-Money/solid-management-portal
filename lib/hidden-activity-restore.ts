import type {
  HiddenActivityRestoreBlock,
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

/** Whether a preview response has the shape the panel renders. */
export function isHiddenActivityRestorePreview(
  value: unknown,
): value is HiddenActivityRestorePreview {
  if (!value || typeof value !== "object") return false;
  const preview = value as Partial<HiddenActivityRestorePreview>;
  return (
    typeof preview.eligible === "number" &&
    typeof preview.accounts === "number" &&
    typeof preview.previewToken === "string" &&
    typeof preview.canApply === "boolean" &&
    Array.isArray(preview.entries) &&
    !!preview.blocked &&
    typeof preview.blocked === "object" &&
    !Array.isArray(preview.blocked)
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
