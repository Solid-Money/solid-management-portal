import type { TaskTeamCard, TaskTeamColumns, TaskTeamPerson } from "@/types/tasks";
import { formatAgo } from "@/lib/task-format";

export const TEAM_COLUMNS = [
  { key: "working", label: "Working on it", dot: "bg-amber-500" },
  { key: "blocked", label: "Stuck / Waiting", dot: "bg-red-500" },
  { key: "review", label: "Review & QA", dot: "bg-indigo-500" },
  { key: "next", label: "Up next", dot: "bg-gray-400" },
  { key: "done", label: "Done · last 7 days", dot: "bg-green-500" },
] as const satisfies ReadonlyArray<{ key: keyof TaskTeamColumns; label: string; dot: string }>;

/** A person this many tasks at once is flagged. */
export const TEAM_BUSY_AT = 5;
/** No update from them for this many days: quiet. */
export const TEAM_QUIET_DAYS = 3;

const DAY_MS = 86_400_000;

/** Their own cards in a column (not the ones they help on). */
export function owned(columns: TaskTeamColumns, column: keyof TaskTeamColumns): number {
  return columns[column].filter((card) => !card.helping).length;
}

/** Open tasks they own that this scope doesn't show (To do outside the sprint). */
export function outsideScope(person: TaskTeamPerson): number {
  const shown = (["working", "blocked", "review", "next"] as const).reduce(
    (total, column) => total + owned(person.columns, column),
    0,
  );
  return Math.max(0, person.open - shown);
}

export interface TeamActivity {
  label: string;
  /** Wrote an update in the last 3 days. */
  recent: boolean;
}

/** "Active 14m ago", or "Last update 4 days ago" once it's been 3 days. */
export function activity(lastActiveAt: string | null, now = new Date()): TeamActivity {
  if (!lastActiveAt) return { label: "No updates yet", recent: false };
  const days = Math.floor((now.getTime() - new Date(lastActiveAt).getTime()) / DAY_MS);
  if (days >= TEAM_QUIET_DAYS) return { label: `Last update ${days} days ago`, recent: false };
  const ago = formatAgo(lastActiveAt, now);
  return { label: ago === "now" ? "Active now" : `Active ${ago} ago`, recent: true };
}

export type TeamFlag = { tone: "busy" | "quiet" | "idle"; label: string };

/** What to point out about a person: too much at once, nothing started, or gone quiet. */
export function personFlags(person: TaskTeamPerson, now = new Date()): TeamFlag[] {
  const working = owned(person.columns, "working");
  if (person.email === null)
    return working ? [{ tone: "busy", label: `${working} in progress with no owner` }] : [];
  const flags: TeamFlag[] = [];
  if (working >= TEAM_BUSY_AT) flags.push({ tone: "busy", label: `${working} in progress` });
  if (person.open > 0 && working === 0) flags.push({ tone: "idle", label: "Nothing in progress" });
  // Never having written one shows on the line under the name already.
  if (person.lastActiveAt && person.open > 0) {
    const days = Math.floor((now.getTime() - new Date(person.lastActiveAt).getTime()) / DAY_MS);
    if (days >= TEAM_QUIET_DAYS) flags.push({ tone: "quiet", label: `Quiet ${days} days` });
  }
  return flags;
}

/** The counts under a name: what's moving, then everything they own. */
export function personCounts(person: TaskTeamPerson): Array<[number, string]> {
  const parts: Array<[number, string]> = [[owned(person.columns, "working"), "in progress"]];
  const blocked = owned(person.columns, "blocked");
  if (blocked) parts.push([blocked, "stuck or waiting"]);
  const review = owned(person.columns, "review");
  if (review) parts.push([review, "in review"]);
  const next = owned(person.columns, "next");
  if (next) parts.push([next, "up next"]);
  if (person.email !== null) parts.push([person.open, "open"]);
  return parts;
}

/** Up next on a person's page: this sprint's, the ones they help on, then the rest. */
export function upNextGroups(
  cards: TaskTeamCard[],
  sprint: string,
): Array<{ label: string; cards: TaskTeamCard[] }> {
  const groups = [
    { label: "This sprint", cards: cards.filter((c) => !c.helping && c.task.sprint === sprint) },
    { label: "Helping", cards: cards.filter((c) => c.helping) },
    { label: "Not in this sprint", cards: cards.filter((c) => !c.helping && c.task.sprint !== sprint) },
  ];
  return groups.filter((group) => group.cards.length);
}

/** Tasks no one has written on for 3+ days, among what they own. */
export function quietCount(person: TaskTeamPerson): number {
  return (["working", "blocked", "review"] as const).reduce(
    (total, column) =>
      total + person.columns[column].filter((card) => !card.helping && card.quietDays !== null).length,
    0,
  );
}
