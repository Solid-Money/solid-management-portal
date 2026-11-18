import type { TaskPartnerGroup } from "@/types/tasks";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOUR = 60 * 60_000;

/** When to check again, said the way people read a queue: overdue, soon, or a date. */
export function followUpLabel(iso: string, now = new Date()): { text: string; tone: "late" | "soon" | "later" } {
  const at = new Date(iso);
  const diff = at.getTime() - now.getTime();
  const span = (ms: number) => {
    const hours = Math.max(1, Math.round(Math.abs(ms) / HOUR));
    return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
  };
  if (diff < 0) return { text: `Overdue ${span(diff)}`, tone: "late" };
  if (diff < 24 * HOUR) return { text: `In ${span(diff)}`, tone: "soon" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return { text: `${MONTHS[at.getMonth()]} ${at.getDate()}, ${pad(at.getHours())}:${pad(at.getMinutes())}`, tone: "later" };
}

/** 09:00 local on the day `days` from today. */
export function morningIn(days: number, now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 9, 0, 0, 0);
}

/** The next Monday at 09:00 local (a week on, if today is Monday). */
export function nextMonday(now = new Date()): Date {
  const days = ((8 - now.getDay()) % 7) || 7;
  return morningIn(days, now);
}

/**
 * One group as text to paste into a partner's ticket: their id for each
 * customer first, then what's wrong, then our ref.
 */
export function partnerListText(group: TaskPartnerGroup, now = new Date()): string {
  const date = `${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const head = `${group.label}: ${group.cases.length} customer${group.cases.length === 1 ? "" : "s"} waiting (${date})`;
  const lines = group.cases.map((c, index) => {
    const reason = c.reason.replace(/\s+/g, " ").trim();
    const short = reason.length > 180 ? `${reason.slice(0, 177)}…` : reason;
    const who = [c.partnerId, c.customer].filter(Boolean).join(" · ") || "unknown customer";
    return `${index + 1}. ${who}: ${short}${c.externalRef ? ` (ref ${c.externalRef})` : ""}`;
  });
  return [head, ...lines].join("\n");
}
