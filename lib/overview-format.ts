/**
 * Number formatting for the Overview page, pinned to en-US like the rest of
 * the portal (see `formatUsd` in `lib/utils.ts`).
 */

const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** `$834`, `$5.6K`, `$151.6K`, `$1.2M`: the tiles' and chips' money. */
export function compactUsd(value: number | null | undefined): string {
  const v = Number.isFinite(value) ? (value as number) : 0;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs < 1_000) return `${sign}$${count.format(Math.round(abs))}`;
  if (abs < 999_950) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
}

/** Axis ticks: `$0`, `$15K`, `$1.5M` — no ".0" on round numbers. */
export function axisUsd(value: number): string {
  return compactUsd(value).replace(/\.0(?=[KM]$)/, "");
}

/** The next round number at or above `value` (1, 2, 2.5 or 5 × a power of ten). */
export function niceCeil(value: number): number {
  if (!(value > 0)) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}

/** `3,919` */
export function formatCount(value: number | null | undefined): string {
  return count.format(Number.isFinite(value) ? (value as number) : 0);
}

/** `43%` from a 0–1 ratio; a dash when there is nothing to divide. */
export function formatRatio(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export type ChangeTone = "up" | "down" | "flat";

export interface Change {
  /** −1…∞; null when the previous period had nothing to compare with. */
  ratio: number | null;
  /** `▲ 16%`, `▼ 15%`, `0%`, or null when there is no comparison. */
  text: string | null;
  tone: ChangeTone;
}

/** Change against the previous period, rounded to whole percent. */
export function change(current: number, previous: number): Change {
  if (!Number.isFinite(previous) || previous === 0) {
    return { ratio: null, text: null, tone: "flat" };
  }
  const ratio = (current - previous) / previous;
  const pct = Math.round(Math.abs(ratio) * 100);
  if (pct === 0) return { ratio, text: "0%", tone: "flat" };
  return {
    ratio,
    text: `${ratio > 0 ? "▲" : "▼"} ${pct}%`,
    tone: ratio > 0 ? "up" : "down",
  };
}

/** `14 s`, `10 min`, `2.5 h`: a median wait. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 90 * 60) return `${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
}

/** A support intent as people read it: `card_declined` → `Card declined`. */
export function intentLabel(intent: string): string {
  const special: Record<string, string> = {
    kyc: "KYC",
    cashback_rewards: "Cashback",
    deposit: "Deposits",
    referral: "Referrals",
  };
  if (special[intent]) return special[intent];
  const words = intent.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
