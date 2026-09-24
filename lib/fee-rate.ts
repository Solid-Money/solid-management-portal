/**
 * Percent <-> parts-per-million for deposit fee rates.
 *
 * Done on strings, never floats: 0.03 * 10_000 is 299.99999999999994 in
 * floating point, and the backend only accepts whole ppm. One ppm is 0.0001%,
 * so a percent has at most four decimal places.
 */

/** "0.03" -> 300. Null when the text is not a valid percent from 0 to 100. */
export function percentToPpm(text: string): number | null {
  const trimmed = text.trim();
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(trimmed);
  if (!match) return null;
  const whole = Number(match[1]);
  const frac = Number((match[2] ?? "").padEnd(4, "0"));
  const ppm = whole * 10_000 + frac;
  return Number.isSafeInteger(ppm) ? ppm : null;
}

/** 300 -> "0.03". */
export function ppmToPercent(ppm: number): string {
  const whole = Math.floor(ppm / 10_000);
  const frac = String(ppm % 10_000)
    .padStart(4, "0")
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/** 300 -> "0.03%"; null -> "0.03% (default)" given the default. */
export function formatRate(ppm: number | null, defaultPpm = 300): string {
  return ppm === null
    ? `${ppmToPercent(defaultPpm)}% (default)`
    : `${ppmToPercent(ppm)}%`;
}

/** The fee a rate takes from a deposit of `amountUsd`, as "$0.30". */
export function feeOn(ppm: number, amountUsd: number): string {
  return `$${((amountUsd * ppm) / 1_000_000).toFixed(2)}`;
}
