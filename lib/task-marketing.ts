import { formatDue, formatShortDate, shiftSprint, sprintStart } from "@/lib/task-format";
import type { TaskCampaign, TaskMarketingOverview, TaskRow } from "@/types/tasks";

/**
 * The Marketing tab's shaping: campaigns with their pieces (launches with
 * the pieces under them), and a week of pieces by day. Pure, so it is
 * tested on its own.
 */

/** A piece's row: a launch's pieces sit right under it. */
export interface MarketingRow {
  piece: TaskRow;
  /** Under a launch shown just above it. */
  child: boolean;
  /** Pieces under it (a launch). */
  children: number;
}

export interface MarketingGroup {
  /** Null: pieces in no campaign. */
  campaign: TaskCampaign | null;
  rows: MarketingRow[];
  total: number;
  posted: number;
}

/** "Mon, Oct 27 · 13:00", "Mon, Oct 27", or null. */
export function publishLabel(on: string | null, time: string | null): string | null {
  if (!on) return null;
  return time ? `${formatDue(on)} · ${time}` : formatDue(on);
}

/** What an asset link is: "Figma", "Typefully", or its site ("solid.xyz"). */
export function assetLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "figma.com" || host.endsWith(".figma.com")) return "Figma";
    if (host === "typefully.com" || host.endsWith(".typefully.com")) return "Typefully";
    if (host === "docs.google.com") return "Google Docs";
    return host;
  } catch {
    return "Link";
  }
}

/**
 * The launches a piece can go under: pieces on the Launch channel in the
 * same campaign, not under a launch themselves (and the one it's under now).
 */
export function launchesFor(
  pieces: TaskRow[],
  campaignId: string | null,
  current: { id?: string; parentId?: string | null } = {},
): TaskRow[] {
  return pieces.filter(
    (p) =>
      p.id !== current.id &&
      p.marketing &&
      !p.marketing.parentId &&
      (p.id === current.parentId ||
        (p.marketing.channel === "launch" && (p.marketing.campaignId ?? null) === campaignId)),
  );
}

/** Whether any brief field is filled in. */
export function hasBrief(row: TaskRow): boolean {
  return Object.values(row.marketing?.brief ?? {}).some((value) => !!value?.trim());
}

/** "Oct 19 – 24", "Oct 26 – Nov 1", "From Oct 19", or null. */
export function campaignDates(campaign: TaskCampaign): string | null {
  const { startOn, endOn } = campaign;
  if (startOn && endOn) {
    const sameMonth = startOn.slice(0, 7) === endOn.slice(0, 7);
    return `${formatShortDate(startOn)} – ${sameMonth ? Number(endOn.slice(8)) : formatShortDate(endOn)}`;
  }
  if (startOn) return `From ${formatShortDate(startOn)}`;
  if (endOn) return `Until ${formatShortDate(endOn)}`;
  return null;
}

/** Earliest first by publish day and time; undated last, in the order they came. */
function byPublish(a: TaskRow, b: TaskRow): number {
  const key = (row: TaskRow) =>
    row.marketing?.publishOn ? `${row.marketing.publishOn} ${row.marketing.publishTime ?? "00:00"}` : null;
  const [x, y] = [key(a), key(b)];
  if (x === y) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return x < y ? -1 : 1;
}

/**
 * The pieces by campaign, in the order the campaigns came (newest first),
 * then pieces in no campaign. A launch is followed by its pieces; a piece
 * whose launch isn't shown stands on its own.
 */
export function groupByCampaign(
  overview: TaskMarketingOverview,
  matches: (piece: TaskRow) => boolean = () => true,
): MarketingGroup[] {
  const pieces = overview.pieces.filter((piece) => piece.marketing);
  const shown = new Set(pieces.filter(matches).map((piece) => piece.id));
  // A launch shows when it or any piece under it matches.
  for (const piece of pieces)
    if (shown.has(piece.id) && piece.marketing?.parentId) shown.add(piece.marketing.parentId);
  const ids = new Set(pieces.map((piece) => piece.id));
  const under = new Map<string, TaskRow[]>();
  for (const piece of pieces) {
    const parent = piece.marketing?.parentId;
    if (parent && ids.has(parent)) under.set(parent, [...(under.get(parent) ?? []), piece]);
  }
  const groupOf = (campaignId: string | null): MarketingGroup => {
    const top = pieces
      .filter((piece) => (piece.marketing?.campaignId ?? null) === campaignId)
      .filter((piece) => !piece.marketing?.parentId || !ids.has(piece.marketing.parentId))
      .sort(byPublish);
    const rows: MarketingRow[] = [];
    for (const piece of top) {
      if (!shown.has(piece.id)) continue;
      const children = (under.get(piece.id) ?? []).sort(byPublish);
      rows.push({ piece, child: false, children: children.length });
      for (const child of children) if (shown.has(child.id)) rows.push({ piece: child, child: true, children: 0 });
    }
    // Progress leaves out cancelled pieces: they won't go out.
    const all = pieces.filter(
      (piece) => (piece.marketing?.campaignId ?? null) === campaignId && piece.status !== "cancelled",
    );
    return {
      campaign: overview.campaigns.find((c) => c.id === campaignId) ?? null,
      rows,
      total: all.length,
      posted: all.filter((piece) => piece.marketing?.stage === "posted").length,
    };
  };
  const groups = overview.campaigns.map((campaign) => groupOf(campaign.id));
  const known = new Set(overview.campaigns.map((c) => c.id));
  // Pieces in no campaign, or in one not sent (archived): together at the end.
  const loose = groupOf(null);
  const orphans = pieces.filter((p) => p.marketing?.campaignId && !known.has(p.marketing.campaignId));
  if (orphans.length) {
    for (const piece of orphans.sort(byPublish))
      if (shown.has(piece.id)) loose.rows.push({ piece, child: false, children: 0 });
    const counted = orphans.filter((p) => p.status !== "cancelled");
    loose.total += counted.length;
    loose.posted += counted.filter((p) => p.marketing?.stage === "posted").length;
  }
  return loose.rows.length || !groups.length ? [...groups, loose] : groups;
}

export interface CalendarDay {
  date: string;
  /** "Mon" */
  weekday: string;
  /** 13 */
  day: number;
  today: boolean;
  pieces: TaskRow[];
}

/** The Monday of the week `date` is in (any day, `YYYY-MM-DD`). */
export function weekStart(date: string): string {
  return sprintStart(new Date(`${date}T12:00:00Z`));
}

/** Monday to Sunday, `from`–`to` for the API. */
export function weekRange(start: string): { from: string; to: string } {
  return { from: start, to: shiftDays(start, 6) };
}

export function shiftDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export { shiftSprint as shiftWeek };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Seven days from `start`, each with its pieces: "all day" first, then by time. */
export function calendarWeek(start: string, pieces: TaskRow[], today: string): CalendarDay[] {
  return WEEKDAYS.map((weekday, index) => {
    const date = shiftDays(start, index);
    return {
      date,
      weekday,
      day: Number(date.slice(8)),
      today: date === today,
      pieces: pieces
        .filter((piece) => piece.marketing?.publishOn === date)
        .sort((a, b) => (a.marketing?.publishTime ?? "").localeCompare(b.marketing?.publishTime ?? "")),
    };
  });
}

/** Today in the viewer's own calendar, `YYYY-MM-DD`. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
