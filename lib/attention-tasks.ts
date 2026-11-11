import type { Tone } from "@/lib/attention";
import { levelBadge, stillHappening } from "@/lib/attention";
import type {
  AttentionItemView,
  RadarCategory,
  RadarDetector,
} from "@/types/radar";
import type { TaskPriority, TaskRow } from "@/types/tasks";

/**
 * "Needs your attention" once Tasks is the work queue: the radar opens one
 * task per problem, and the card only summarises. These are the card's rules,
 * with no React, so they are tested: which open alerts belong to which radar
 * task, how the tasks are ordered, what counts as quiet, and the tiles.
 */

const HOUR_MS = 60 * 60_000;
/** A task with no update from a person for this long is "quiet". */
export const QUIET_AFTER_HOURS = 24;

/**
 * Detectors whose alerts share one task whatever they point at. Mirrors
 * GROUP_TITLES in solid-backend's task-radar.service.ts; keep the two in step.
 */
const GROUPED: ReadonlySet<RadarDetector> = new Set([
  "shared_cashout_wallet",
  "card_decline_spike",
  "support_cluster",
  "referral_burst",
  "flagged_referrer_recruiting",
  "same_ip_signups",
  "signup_spike",
  "passkey_many_accounts",
  "cashback_cash_like",
  "spend_drop",
  "support_ai_off_model",
  "rewards_above_revenue",
]);
const FAILURES: ReadonlySet<RadarDetector> = new Set([
  "flow_failure",
  "error_spike",
  "known_bad_error",
]);

/**
 * Which problem an alert is about, as the radar groups alerts into tasks: a
 * grouped detector on its own, a failure by its error code, anything else by
 * detector and key. Mirrors `radarKey` in solid-backend.
 */
export function problemKey(
  item: Pick<AttentionItemView, "id" | "signals" | "codes">,
): string {
  const signal = item.signals?.[0];
  if (!signal?.detector) return `item:${item.id}`;
  if (GROUPED.has(signal.detector)) return signal.detector;
  if (FAILURES.has(signal.detector)) {
    const code = (item.codes ?? []).find((c) => c && c !== "UNKNOWN");
    if (code) return `code:${code}`;
  }
  return `${signal.detector}:${signal.key}`;
}

export interface RadarTask {
  task: TaskRow;
  /** Its open alerts, largest (most people) first. */
  items: AttentionItemView[];
  badge: { label: string; tone: Tone };
  tag: string;
  /** One line of numbers under the title. */
  meta: string;
  incident: boolean;
  /** A failure in the last half hour. */
  happening: boolean;
  /** Seen in the last 24 hours. */
  today: boolean;
  /** People hit in its largest alert. */
  people: number;
  /** Hours since a person last wrote on it (or since it opened). */
  quietHours: number;
}

/** Whole hours since a person last wrote on the task, or since it opened. */
export function quietHours(
  task: Pick<TaskRow, "lastPersonUpdateAt" | "createdAt">,
  nowIso: string,
): number {
  const since = Date.parse(task.lastPersonUpdateAt ?? task.createdAt);
  return Math.max(0, Math.floor((Date.parse(nowIso) - since) / HOUR_MS));
}

/** "2d quiet", "5 h quiet", "updated 3 h ago", "updated just now" */
export function quietLabel(hours: number): { text: string; quiet: boolean } {
  if (hours >= QUIET_AFTER_HOURS) {
    const days = Math.floor(hours / 24);
    return { text: `${days}d quiet`, quiet: true };
  }
  if (hours < 1) return { text: "updated just now", quiet: false };
  return { text: `updated ${hours} h ago`, quiet: false };
}

const PRIORITY_BADGE: Record<TaskPriority, { label: string; tone: Tone }> = {
  critical: { label: "INCIDENT", tone: "solid-red" },
  high: { label: "HIGH", tone: "red" },
  medium: { label: "MED", tone: "orange" },
  low: { label: "LOW", tone: "gray" },
};

const SEVERITY_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  watch: 0,
};

/**
 * The open radar tasks with their open alerts, most urgent first: incidents,
 * then whatever is still happening, then what happened today, each by people
 * hit and severity, then the quietest. An old alert with many accounts (a
 * passkey from last month) waits behind a failure that hit people today. An alert belongs to a task when the task lists it, or when it
 * is about the same problem as one the task lists (older duplicates of an
 * error the radar now keeps in one alert).
 */
export function radarTasks(
  tasks: TaskRow[],
  items: AttentionItemView[],
  nowIso: string,
): RadarTask[] {
  const open = items.filter((i) => i.status !== "resolved");
  const byId = new Map(open.map((i) => [i.id, i]));
  const rows = tasks
    .filter((t) => t.source.kind === "radar")
    .map((task) => {
      // Absent until the backend sends it: the task's alerts then show as
      // alerts in no task, never hidden.
      const ids = new Set(task.radarItemIds ?? []);
      const listed = [...ids]
        .map((id) => byId.get(id))
        .filter(Boolean) as AttentionItemView[];
      const keys = new Set(listed.map(problemKey));
      const mine = open.filter((i) => ids.has(i.id) || keys.has(problemKey(i)));
      return { task, mine };
    });
  return rows
    .map(({ task, mine }) => describe(task, mine, nowIso))
    .sort(
      (a, b) =>
        Number(b.incident) - Number(a.incident) ||
        Number(b.happening) - Number(a.happening) ||
        Number(b.today) - Number(a.today) ||
        b.people - a.people ||
        rankOf(b) - rankOf(a) ||
        b.quietHours - a.quietHours,
    );
}

function rankOf(row: RadarTask): number {
  return (
    SEVERITY_RANK[row.items[0]?.severity ?? ""] ??
    PRIORITY_RANK[row.task.priority ?? "medium"]
  );
}
const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function describe(
  task: TaskRow,
  mine: AttentionItemView[],
  nowIso: string,
): RadarTask {
  const items = [...mine].sort(
    (a, b) =>
      b.affectedCount - a.affectedCount ||
      Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt),
  );
  const largest = items[0];
  const incident =
    task.priority === "critical" || items.some((i) => i.level === "incident");
  const badge = incident
    ? { label: "INCIDENT", tone: "solid-red" as const }
    : largest
      ? levelBadge(largest)
      : PRIORITY_BADGE[task.priority ?? "medium"];
  const more = items.length - 1;
  // A grouped kind's alerts are each about one thing ("47 accounts cash out
  // to one wallet"): name it. A failure's alerts repeat the task's error.
  const named =
    !!largest && GROUPED.has(largest.signals?.[0]?.detector as RadarDetector);
  const meta = largest
    ? [
        named && largest.title !== task.title ? largest.title : null,
        largest.metaLine,
        more > 0
          ? `${more} more alert${more === 1 ? "" : "s"} in this task`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Its alerts are closed; a person decides the outcome";
  return {
    task,
    items,
    badge,
    tag: largest?.tag ?? categoryTag(task.labels),
    meta,
    incident,
    happening: items.some((i) => stillHappening(i, nowIso)),
    today: items.some(
      (i) => Date.parse(nowIso) - Date.parse(i.lastSeenAt) < 24 * HOUR_MS,
    ),
    people: largest?.affectedCount ?? 0,
    quietHours: quietHours(task, nowIso),
  };
}

const CATEGORY_TAGS: Record<RadarCategory, string> = {
  incident: "Incident",
  abuse: "Abuse",
  security: "Security",
  reliability: "Reliability",
  money: "Money",
};

function categoryTag(labels: string[]): string {
  const found = (Object.keys(CATEGORY_TAGS) as RadarCategory[]).find((c) =>
    labels.includes(c),
  );
  return found ? CATEGORY_TAGS[found] : "Radar";
}

export interface CardSummary {
  tasks: RadarTask[];
  quiet: RadarTask[];
  /** Deposit gaps and the like, waiting for a person to check before a task opens. */
  toCheck: AttentionItemView[];
  /** Watch-level alerts in no task: seen, not yet anyone's work. */
  watching: AttentionItemView[];
  /** Escalated alerts in no task you can see (a private task, or one about to open). */
  untasked: AttentionItemView[];
  /** "Abuse 2 · Reliability 1 · Security 1" */
  byCategory: string;
  unassigned: number;
  /** Closed on their own (quiet) in the last 24 h, newest first. */
  closedOnOwn: AttentionItemView[];
}

export function cardSummary(
  tasks: TaskRow[],
  items: AttentionItemView[],
  resolved: AttentionItemView[],
  nowIso: string,
): CardSummary {
  const rows = radarTasks(tasks, items, nowIso);
  const inTasks = new Set(rows.flatMap((r) => r.items.map((i) => i.id)));
  const open = items.filter(
    (i) => i.status !== "resolved" && !inTasks.has(i.id),
  );
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  const since = Date.parse(nowIso) - 24 * HOUR_MS;
  return {
    tasks: rows,
    quiet: rows
      .filter((r) => r.quietHours >= QUIET_AFTER_HOURS)
      .sort((a, b) => b.quietHours - a.quietHours),
    toCheck: open.filter((i) => i.status === "needs_check"),
    watching: open.filter(
      (i) => i.status !== "needs_check" && i.level === "watch",
    ),
    untasked: open.filter(
      (i) => i.status !== "needs_check" && i.level !== "watch",
    ),
    byCategory: [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, n]) => `${tag} ${n}`)
      .join(" · "),
    unassigned: rows.filter((r) => !r.task.ownerEmail).length,
    closedOnOwn: resolved
      .filter(
        (i) =>
          i.resolution === "quiet" &&
          !!i.resolvedAt &&
          Date.parse(i.resolvedAt) >= since,
      )
      .sort((a, b) => Date.parse(b.resolvedAt!) - Date.parse(a.resolvedAt!)),
  };
}

/** "3 closed on their own in the last 24 h: Card declines spiking, No bank transfer deposits…" */
export function closedLine(closed: AttentionItemView[]): string | null {
  if (!closed.length) return null;
  const names = closed.slice(0, 3).map((i) => i.title);
  const rest = closed.length - names.length;
  return `${closed.length} closed on ${closed.length === 1 ? "its" : "their"} own in the last 24 h: ${names.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}`;
}

/** The Tasks page, on the radar board, optionally with one task open. */
export function tasksHref(taskId?: string): string {
  return taskId ? `/tasks?board=radar&task=${taskId}` : "/tasks?board=radar";
}
