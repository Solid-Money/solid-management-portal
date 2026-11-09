import type { TaskPerson } from "@/types/tasks";

/** Pure helpers for Tasks: names, dates and @mentions. */

/** A person's display name: their Firebase name, else the part before @. */
export function personName(email: string | null | undefined, people?: TaskPerson[]): string {
  if (!email) return "Nobody";
  const found = people?.find((p) => p.email === email);
  if (found?.name) return found.name;
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

export function firstName(email: string | null | undefined, people?: TaskPerson[]): string {
  return personName(email, people).split(" ")[0] ?? "";
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `2026-11-10` → `Tue, Nov 10` (a calendar date: no time zone involved). */
export function formatDue(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${DAYS[weekday]}, ${MONTHS[m! - 1]} ${d}`;
}

/** `2026-11-10` → `Nov 10`. */
export function formatShortDate(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8))}`;
}

/** Whole days a due date is past, in the admin's own calendar (0 or less: not late). */
export function daysLate(date: string, now = new Date()): number {
  const [y, m, d] = date.split("-").map(Number);
  const due = Date.UTC(y!, m! - 1, d!);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - due) / 86_400_000);
}

/** `Nov 7, 13:05` in the admin's time; `Today, 13:05` / `Yesterday, …` when close. */
export function formatWhen(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (at >= startOfToday) return `Today, ${time}`;
  if (at >= startOfYesterday) return `Yesterday, ${time}`;
  const year = at.getFullYear() === now.getFullYear() ? "" : ` ${at.getFullYear()}`;
  return `${MONTHS[at.getMonth()]} ${at.getDate()}${year}, ${time}`;
}

/** The names a mention can appear under in text: full name and first name, longest first. */
export function mentionNames(mentions: string[], people?: TaskPerson[]): string[] {
  return mentions
    .map((email) => personName(email, people))
    .concat(mentions.map((email) => firstName(email, people)))
    .filter((name, index, all) => name && all.indexOf(name) === index)
    .sort((a, b) => b.length - a.length);
}

/** Splits text into plain runs and `@Name` mentions, in order. */
export function splitMentions(
  body: string,
  names: string[],
): Array<{ text: string; mention: boolean }> {
  if (!body) return [];
  if (!names.length) return [{ text: body, mention: false }];
  const pattern = new RegExp(`@(${names.map(escapeRegex).join("|")})`, "g");
  const parts: Array<{ text: string; mention: boolean }> = [];
  let last = 0;
  for (const match of body.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: body.slice(last, start), mention: false });
    parts.push({ text: match[0], mention: true });
    last = start + match[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last), mention: false });
  return parts;
}

/**
 * Mentions still in the text: picking someone writes `@Name`; deleting that
 * text un-mentions them.
 */
export function mentionsInText(text: string, picked: string[], people?: TaskPerson[]): string[] {
  return picked.filter(
    (email) =>
      text.includes(`@${personName(email, people)}`) || text.includes(`@${firstName(email, people)}`),
  );
}

/** The `@query` being typed just before the caret, if any. */
export function mentionQuery(text: string, caret: number): { text: string; start: number } | null {
  const match = /(^|\s)@([\p{L}\p{N}._-]{0,30})$/u.exec(text.slice(0, caret));
  if (!match) return null;
  const typed = match[2] ?? "";
  return { text: typed, start: caret - typed.length - 1 };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type RichPart =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string; internal: boolean };

const RICH =
  /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])/g;

/** A link Tasks will follow: a portal path (`/support?c=…`) or an http(s) address. */
function safeHref(href: string): { href: string; internal: boolean } | null {
  // `//host` and `/\host` leave the portal in a browser: not internal paths.
  if (href.startsWith("/") && href[1] !== "/" && href[1] !== "\\") return { href, internal: true };
  if (/^https?:\/\//i.test(href)) return { href, internal: false };
  return null;
}

/**
 * Splits text Solid AI, the radar or a person wrote into plain runs,
 * `**bold**` headings, `[label](link)` links and bare `https://` addresses.
 * Anything else (a `javascript:` link, say) stays plain text.
 */
export function splitRich(body: string): RichPart[] {
  if (!body) return [];
  const parts: RichPart[] = [];
  let last = 0;
  const text = (value: string) => {
    if (!value) return;
    const prev = parts.at(-1);
    if (prev?.kind === "text") prev.text += value;
    else parts.push({ kind: "text", text: value });
  };
  for (const match of body.matchAll(RICH)) {
    const start = match.index ?? 0;
    text(body.slice(last, start));
    last = start + match[0].length;
    if (match[1] !== undefined && match[2] !== undefined) {
      const link = safeHref(match[2]);
      if (link) parts.push({ kind: "link", text: match[1], ...link });
      else text(match[0]);
    } else if (match[3] !== undefined) {
      parts.push({ kind: "bold", text: match[3] });
    } else if (match[4] !== undefined) {
      parts.push({ kind: "link", text: match[4], href: match[4], internal: false });
    }
  }
  text(body.slice(last));
  return parts;
}

/** The text without its marks, for one-line previews. */
export function plainText(body: string): string {
  return splitRich(body)
    .map((part) => part.text)
    .join("");
}

// ---- Sprints: weeks, Monday to Sunday (UTC), named by the Monday ----------

const WEEK_MS = 7 * 86_400_000;

function isoDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** This week's sprint (its Monday, `YYYY-MM-DD`). */
export function sprintStart(now = new Date()): string {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const back = (new Date(day).getUTCDay() + 6) % 7;
  return isoDay(new Date(day - back * 86_400_000));
}

export function shiftSprint(start: string, weeks: number): string {
  return isoDay(new Date(Date.parse(`${start}T00:00:00Z`) + weeks * WEEK_MS));
}

/** "Nov 9–15", or "Oct 26–Nov 1" across a month. */
export function sprintLabel(start: string): string {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(from.getTime() + WEEK_MS - 86_400_000);
  const head = `${MONTHS[from.getUTCMonth()]} ${from.getUTCDate()}`;
  return from.getUTCMonth() === to.getUTCMonth()
    ? `${head}–${to.getUTCDate()}`
    : `${head}–${MONTHS[to.getUTCMonth()]} ${to.getUTCDate()}`;
}
