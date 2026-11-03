/**
 * The Overview page's date range: presets, the URL it lives in, and its labels.
 *
 * Days are UTC calendar days, `YYYY-MM-DD`, both ends inclusive — the same
 * contract as `GET /admin/v1/overview`. Kept free of React so the rules (no
 * future days, at most 365 days, "Last 7 days" ends yesterday) are tested
 * once and shared by the picker, the header and the links.
 */

export const OVERVIEW_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "last90", label: "Last 90 days" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "custom", label: "Custom range" },
] as const;

export type OverviewPreset = (typeof OVERVIEW_PRESETS)[number]["id"];

export const DEFAULT_PRESET: Exclude<OverviewPreset, "custom"> = "last7";
export const MAX_RANGE_DAYS = 365;

export interface OverviewRangeState {
  from: string;
  to: string;
  preset: OverviewPreset;
  /** Compare with the previous period of the same length (on by default). */
  compare: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Today's UTC day. */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Days from `from` to `to`, both inclusive. */
export function rangeDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** The days a preset covers, as of `today`. "Last N days" are full days. */
export function presetRange(
  preset: Exclude<OverviewPreset, "custom">,
  today: string,
): { from: string; to: string } {
  const yesterday = addDays(today, -1);
  const [y, m] = today.split("-").map(Number);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: yesterday, to: yesterday };
    case "last7":
      return { from: addDays(yesterday, -6), to: yesterday };
    case "last30":
      return { from: addDays(yesterday, -29), to: yesterday };
    case "last90":
      return { from: addDays(yesterday, -89), to: yesterday };
    case "thisMonth":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "lastMonth": {
      const firstOfThis = Date.UTC(y, m - 1, 1);
      const lastOfPrev = new Date(firstOfThis - DAY_MS).toISOString().slice(0, 10);
      return { from: `${lastOfPrev.slice(0, 7)}-01`, to: lastOfPrev };
    }
  }
}

/** The preset a pair of days matches, or `custom`. */
export function matchPreset(from: string, to: string, today: string): OverviewPreset {
  for (const { id } of OVERVIEW_PRESETS) {
    if (id === "custom") continue;
    const range = presetRange(id, today);
    if (range.from === from && range.to === to) return id;
  }
  return "custom";
}

/**
 * Why a picked range cannot be applied, or null when it can. A future end is
 * not an error here: the picker never offers one, and a link with one is
 * pulled back to today by {@link parseRange}.
 */
export function rangeError(from: string, to: string, today: string): string | null {
  if (!isDay(from) || !isDay(to)) return "Pick a start and an end day";
  if (from > to) return "The start must be on or before the end";
  if (from > today) return "The range cannot start in the future";
  if (rangeDays(from, to) > MAX_RANGE_DAYS) return `Pick ${MAX_RANGE_DAYS} days or fewer`;
  return null;
}

/**
 * Read the range from the page URL (`?from=&to=&compare=0`). Anything missing
 * or unusable falls back to the default rather than erroring, so an old or
 * hand-edited link still opens the page.
 */
export function parseRange(
  params: { get(name: string): string | null },
  today: string,
): OverviewRangeState {
  const compare = params.get("compare") !== "0";
  let from = params.get("from") ?? "";
  let to = params.get("to") ?? "";
  if (isDay(to) && to > today) to = today;

  if (rangeError(from, to, today) !== null) {
    ({ from, to } = presetRange(DEFAULT_PRESET, today));
  }
  return { from, to, preset: matchPreset(from, to, today), compare };
}

/** The query string that reproduces a range; the default range writes nothing. */
export function rangeQuery(state: OverviewRangeState, today: string): string {
  const params = new URLSearchParams();
  const fallback = presetRange(DEFAULT_PRESET, today);
  if (state.from !== fallback.from || state.to !== fallback.to) {
    params.set("from", state.from);
    params.set("to", state.to);
  }
  if (!state.compare) params.set("compare", "0");
  return params.toString();
}

/** `Oct 26`, or `Oct 26, 2025` when the year is not `currentYear`. */
export function dayLabel(day: string, currentYear?: string): string {
  const [y, m, d] = day.split("-");
  const base = `${MONTHS[Number(m) - 1]} ${Number(d)}`;
  return currentYear && y !== currentYear ? `${base}, ${y}` : base;
}

/** `Oct 26 – Nov 1`, or one day alone. */
export function spanLabel(from: string, to: string, today?: string): string {
  const year = (today ?? to).slice(0, 4);
  return from === to
    ? dayLabel(from, year)
    : `${dayLabel(from, year)} – ${dayLabel(to, year)}`;
}

/**
 * Whether the range is the latest seven days, ending yesterday or today, so
 * "this week" is true of it. Any other seven days is just a range.
 */
export function isLatestWeek(range: { days: number; chartTo: string; today: string }): boolean {
  return range.days === 7 && range.chartTo === range.today;
}

export function presetLabel(preset: OverviewPreset): string {
  return OVERVIEW_PRESETS.find((p) => p.id === preset)?.label ?? "Custom range";
}

/** The header line: "Last 7 days, Oct 26 – Nov 1 (UTC), compared with the 7 days before". */
export function rangeSentence(state: OverviewRangeState, today: string): string {
  const days = rangeDays(state.from, state.to);
  const span = spanLabel(state.from, state.to, today);
  const head =
    state.preset === "custom" ? span : `${presetLabel(state.preset)}, ${span}`;
  if (!state.compare) return `${head} (UTC)`;
  const before = days === 1 ? "the day before" : `the ${days} days before`;
  return `${head} (UTC), compared with ${before}`;
}

function isDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
