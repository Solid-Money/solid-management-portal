"use client";

import { Fragment } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  daysLate,
  firstName,
  formatDue,
  formatShortDate,
  mentionNames,
  personName,
  splitMentions,
} from "@/lib/task-format";
import type {
  TaskAuthor,
  TaskBot,
  TaskPerson,
  TaskPriority,
  TaskRow,
  TaskStatus,
} from "@/types/tasks";

export { daysLate, firstName, formatDue, formatWhen, personName } from "@/lib/task-format";

export const STATUS_META: Record<
  TaskStatus,
  { label: string; pill: string; swatch: string; groupOrder: number }
> = {
  stuck: { label: "Stuck", pill: "bg-red-50 text-red-700", swatch: "bg-red-500", groupOrder: 0 },
  working: {
    label: "Working on it",
    pill: "bg-amber-50 text-amber-700",
    swatch: "bg-amber-500",
    groupOrder: 1,
  },
  waiting: { label: "Waiting", pill: "bg-sky-50 text-sky-700", swatch: "bg-sky-500", groupOrder: 2 },
  todo: { label: "To do", pill: "bg-gray-100 text-gray-600", swatch: "bg-gray-400", groupOrder: 3 },
  review: {
    label: "Review",
    pill: "bg-indigo-50 text-indigo-700",
    swatch: "bg-indigo-500",
    groupOrder: 4,
  },
  qa: { label: "QA", pill: "bg-violet-50 text-violet-700", swatch: "bg-violet-500", groupOrder: 5 },
  done: { label: "Done", pill: "bg-green-50 text-green-700", swatch: "bg-green-500", groupOrder: 6 },
  cancelled: {
    label: "Cancelled",
    pill: "bg-gray-100 text-gray-500 line-through",
    swatch: "bg-gray-300",
    groupOrder: 7,
  },
};

/** Status groups on the open list, in the order they are shown. */
export const OPEN_STATUS_ORDER: TaskStatus[] = ["stuck", "working", "waiting", "todo", "review", "qa"];

export const STATUS_HINTS: Partial<Record<TaskStatus, string>> = {
  stuck: "Owners get a nudge after 3 quiet days",
  waiting: "On a partner or a customer",
};

export const PRIORITY_META: Record<TaskPriority, { label: string; dot: string; rank: number }> = {
  critical: { label: "Critical", dot: "bg-gray-900", rank: 0 },
  high: { label: "High", dot: "bg-red-500", rank: 1 },
  medium: { label: "Medium", dot: "bg-amber-500", rank: 2 },
  low: { label: "Low", dot: "bg-gray-400", rank: 3 },
};

export const BOT_NAMES: Record<TaskBot, string> = {
  "solid-ai": "Solid AI",
  radar: "Radar",
  claude: "Claude",
};

const AVATAR_COLORS = [
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-violet-600",
  "bg-pink-600",
  "bg-sky-600",
  "bg-orange-600",
  "bg-slate-500",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

function colorFor(email: string): string {
  let hash = 0;
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

export function Avatar({
  email,
  people,
  size = 22,
  ring = false,
  className,
}: {
  email: string;
  people?: TaskPerson[];
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const name = personName(email, people);
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        colorFor(email),
        ring && "ring-2 ring-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initials(name)}
    </span>
  );
}

/** Solid AI, the radar and Claude: a dark tile with a spark. */
export function BotAvatar({ size = 22 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md bg-gray-900 text-lime-300"
      style={{ width: size, height: size }}
    >
      <Sparkles style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}

export function AuthorAvatar({
  author,
  people,
  size = 28,
}: {
  author: TaskAuthor;
  people?: TaskPerson[];
  size?: number;
}) {
  if (author.bot || !author.email) return <BotAvatar size={size} />;
  return <Avatar email={author.email} people={people} size={size} />;
}

export function authorName(author: TaskAuthor, people?: TaskPerson[]): string {
  if (author.bot) return BOT_NAMES[author.bot];
  return author.name ?? personName(author.email, people);
}

export function StatusPill({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
        meta.pill,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: TaskPriority | null }) {
  if (!priority) return <span className="text-gray-300">—</span>;
  if (priority === "critical")
    return (
      <span className="inline-flex rounded bg-gray-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">
        Critical
      </span>
    );
  const meta = PRIORITY_META[priority];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
      <span className={cn("h-[7px] w-[7px] rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function TaskSource({ row, people }: { row: TaskRow; people?: TaskPerson[] }) {
  if (row.createdBy.bot || row.source.kind !== "manual") {
    const what =
      row.source.kind === "support"
        ? "Support"
        : row.source.kind === "radar"
          ? "Radar"
          : row.source.kind === "claude"
            ? "Claude"
            : authorName(row.createdBy, people);
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-600">
        <BotAvatar size={18} />
        <span className="font-medium text-gray-900">{what}</span>
        {row.source.label && <span>· {row.source.label}</span>}
      </span>
    );
  }
  const email = row.createdBy.email;
  if (!email) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <Avatar email={email} people={people} size={18} />
      {firstName(email, people)}
    </span>
  );
}

export function DueLabel({ date, closed }: { date: string | null; closed?: boolean }) {
  if (!date) return <span className="text-gray-300">—</span>;
  const late = closed ? 0 : daysLate(date);
  if (late > 0)
    return (
      <span className="whitespace-nowrap text-xs font-medium text-red-700">
        {formatShortDate(date)} · {late}d late
      </span>
    );
  return <span className="whitespace-nowrap text-xs text-gray-700">{formatDue(date)}</span>;
}

/**
 * Text with @mentions picked out. Mentions are stored as emails; the text
 * holds `@Name` as typed, so a mention is highlighted wherever that name
 * appears after an @.
 */
export function MentionText({
  body,
  mentions,
  people,
}: {
  body: string;
  mentions: string[];
  people?: TaskPerson[];
}) {
  return (
    <>
      {splitMentions(body, mentionNames(mentions, people)).map((part, index) =>
        part.mention ? (
          <span key={index} className="font-semibold text-indigo-700">
            {part.text}
          </span>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
