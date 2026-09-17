import { CASHBACK_PERCENTAGE_SOURCE_LABELS } from "@/types";

/**
 * Cashback rates are stored as fractions everywhere — 0.03 is 3%, the same way
 * the tier rates on the rewards-config screen are stored — and are shown and
 * typed as percentages. These are the two conversions, in one place, because
 * getting the direction wrong by one factor of a hundred is the mistake that
 * actually costs money here.
 */

/** The highest rate an operator can set: 100% back. Mirrors the backend cap. */
export const MAX_CASHBACK_PERCENT = 100;

/** 0.0325 → "3.25%". Trailing zeros are dropped, so 0.03 reads as "3%". */
export function formatCashbackRate(fraction?: number | null): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction))
    return "—";

  // toFixed then strip: 0.0325 * 100 is 3.2500000000000004 in binary floating
  // point, which would otherwise print in full.
  return `${Number((fraction * 100).toFixed(4))}%`;
}

/** 0.03 → "3", for a percent input. Empty string when nothing is set. */
export function toPercentInput(fraction?: number | null): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction))
    return "";

  return String(Number((fraction * 100).toFixed(4)));
}

/**
 * A percent typed into a form, as the fraction the API takes.
 *
 * Returns `undefined` for anything unusable — a blank, a non-number, a value
 * outside 0–100 — which callers surface as "fix this" rather than sending. Zero
 * is usable: it means this earns nothing, which is a real thing to set.
 */
export function fromPercentInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  const percent = Number(trimmed);
  if (!Number.isFinite(percent)) return undefined;
  if (percent < 0 || percent > MAX_CASHBACK_PERCENT) return undefined;

  // Round to the fraction's 6th decimal — 0.0001% granularity — so a typed
  // "3.25" stores as 0.0325 rather than 0.032500000000000001.
  return Number((percent / 100).toFixed(6));
}

/** "3% (this user)" — the rate plus which level decided it. */
export function describeCashbackRate(
  fraction?: number | null,
  source?: string
): string {
  const rate = formatCashbackRate(fraction);
  if (!source) return rate;

  return `${rate} (${CASHBACK_PERCENTAGE_SOURCE_LABELS[source] ?? source})`;
}
