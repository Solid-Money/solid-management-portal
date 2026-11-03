import type {
  AttentionItemView,
  AttentionListResponse,
  RadarStatus,
} from "@/types/radar";

/**
 * How the "Needs your attention" card shows an item: its level badge, its
 * status pill, and the footer line. No React here, so the rules are tested.
 */

export type Tone =
  "red" | "orange" | "gray" | "green" | "indigo" | "purple" | "solid-red";

export const TONE_CLASSES: Record<Tone, string> = {
  red: "bg-[#fdecec] text-[#b91c1c]",
  orange: "bg-[#fdf1e3] text-[#b45309]",
  gray: "bg-[#f1f2f6] text-[#4b5563]",
  green: "bg-[#e8f7ee] text-[#15803d]",
  indigo: "bg-[#eef0ff] text-[#3b3bd6]",
  purple: "bg-[#f3e8ff] text-[#7e22ce]",
  "solid-red": "bg-[#dc2626] text-white",
};

/** The badge at the start of a row. */
export function levelBadge(item: AttentionItemView): {
  label: string;
  tone: Tone;
} {
  if (item.status === "resolved") {
    return item.resolution === "dismissed"
      ? { label: "DISMISSED", tone: "gray" }
      : { label: "FIXED", tone: "green" };
  }
  if (item.level === "incident")
    return { label: "INCIDENT", tone: "solid-red" };
  if (item.status === "needs_check") return { label: "CHECK", tone: "orange" };
  switch (item.severity) {
    case "high":
      return { label: "HIGH", tone: "red" };
    case "medium":
      return { label: "MED", tone: "orange" };
    case "low":
      return { label: "LOW", tone: "gray" };
    default:
      return { label: "WATCH", tone: "gray" };
  }
}

const STATUS: Record<RadarStatus, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "indigo" },
  watching: { label: "Watching", tone: "gray" },
  in_solid: { label: "In #solid", tone: "purple" },
  live_in_app: { label: "Live in app", tone: "red" },
  needs_check: { label: "Needs a check", tone: "orange" },
  resolved: { label: "Resolved", tone: "green" },
};

/** A status this mirror does not know yet reads as its own words, in grey. */
export function statusPill(status: RadarStatus): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: humanize(String(status)), tone: "gray" };
}

function humanize(value: string): string {
  const words = value.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "No live incidents", "5 new", "1 to check", "1 watching" — only what is non-zero, bar the first. */
export function summaryPills(
  summary: AttentionListResponse["summary"],
): Array<{ label: string; tone: Tone; dot?: boolean }> {
  const pills: Array<{ label: string; tone: Tone; dot?: boolean }> = [
    summary.liveIncidents > 0
      ? {
          label: `${summary.liveIncidents} live incident${summary.liveIncidents === 1 ? "" : "s"}`,
          tone: "solid-red",
        }
      : { label: "No live incidents", tone: "green", dot: true },
  ];
  if (summary.new > 0)
    pills.push({ label: `${summary.new} new`, tone: "indigo" });
  if (summary.toCheck > 0)
    pills.push({ label: `${summary.toCheck} to check`, tone: "orange" });
  if (summary.watching > 0)
    pills.push({ label: `${summary.watching} watching`, tone: "gray" });
  return pills;
}

const QUIET_NAMES: Record<string, string> = {
  card_decline_spike: "card declines",
  spend_drop: "card spend",
  signup_spike: "sign-ups",
};

/** "No spike this week in card declines, card spend or sign-ups · checks every 5 min · last check 11:30 UTC · escalations go to #solid" */
export function footerLine(
  list: Pick<AttentionListResponse, "quiet" | "lastCheckAt">,
): string {
  const names = list.quiet.map((q) => QUIET_NAMES[q] ?? q.replace(/_/g, " "));
  const parts: string[] = [];
  if (names.length > 0) {
    const joined =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
    parts.push(`No spike this week in ${joined}`);
  }
  parts.push("checks every 5 min");
  parts.push(
    list.lastCheckAt
      ? `last check ${list.lastCheckAt.slice(11, 16)} UTC`
      : "not checked yet",
  );
  parts.push("escalations go to #solid");
  return parts.join(" · ");
}

/** The outside wallet a cash-out pattern is about, from its signals' evidence. */
export function walletOf(item: Pick<AttentionItemView, "signals">): string | null {
  for (const signal of item.signals) {
    const address = (signal.evidence as { address?: unknown } | undefined)?.address;
    if (typeof address === "string" && address) return address;
  }
  return null;
}

/** "1 h 38 min", "12 min", "2 days" */
export function elapsed(fromIso: string, toIso: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000),
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48)
    return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

/** Whether people are still being hit: a failure in the last half hour. */
export function stillHappening(
  item: Pick<AttentionItemView, "lastSeenAt">,
  nowIso: string,
): boolean {
  return Date.parse(nowIso) - Date.parse(item.lastSeenAt) < 30 * 60_000;
}
