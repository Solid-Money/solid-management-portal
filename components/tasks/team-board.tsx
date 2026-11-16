"use client";

import { useMemo } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskBoards, useTaskPeople, useTeam } from "@/hooks/use-tasks";
import {
  TEAM_COLUMNS,
  activity,
  outsideScope,
  owned,
  personCounts,
  personFlags,
  quietCount,
  upNextGroups,
  type TeamFlag,
} from "@/lib/task-team";
import { Avatar, DueLabel, LastUpdateLine, PriorityLabel, personName } from "@/components/tasks/task-format";
import type { TaskArea, TaskPerson, TaskTeamCard, TaskTeamColumns, TaskTeamPerson, TaskTeamScope } from "@/types/tasks";

/** Cards shown in a cell before "+N more" (which opens the person). */
const CELL_CARDS = 2;

const AREAS: Array<{ key: TaskArea | null; label: string }> = [
  { key: null, label: "All boards" },
  { key: "product", label: "Product" },
  { key: "support", label: "Support" },
  { key: "marketing", label: "Marketing" },
];

const FLAG_TONE: Record<TeamFlag["tone"], string> = {
  busy: "bg-amber-100 text-amber-800",
  quiet: "bg-orange-100 text-orange-800",
  idle: "bg-gray-100 text-gray-600",
};

export interface TeamFilters {
  scope: TaskTeamScope;
  area: TaskArea | null;
  helpers: boolean;
  /** An email, "nobody", or null for everyone. */
  person: string | null;
}

function TeamCard({
  card,
  people,
  boardNames,
  onOpen,
  selected,
}: {
  card: TaskTeamCard;
  people: TaskPerson[];
  boardNames: Map<string, string>;
  onOpen: (id: string) => void;
  selected: boolean;
}) {
  const { task } = card;
  const board = task.board ? (boardNames.get(task.board) ?? null) : null;
  const closed = task.status === "done" || task.status === "cancelled";
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      className={cn(
        "w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-left shadow-[0_1px_1px_rgba(0,0,0,0.03)] hover:border-gray-300",
        card.helping && "opacity-60 hover:opacity-100",
        selected && "border-indigo-300 ring-2 ring-indigo-100",
      )}
    >
      <span className="block text-[13px] leading-snug text-gray-900">{task.title}</span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {board && (
          <span className="rounded border border-gray-200 px-1.5 text-[11px] leading-[17px] text-gray-500">{board}</span>
        )}
        {task.priority && (
          <span className="text-[11px]">
            <PriorityLabel priority={task.priority} />
          </span>
        )}
        {task.dueDate && !closed && (
          <span className="text-[11px]">
            <DueLabel date={task.dueDate} />
          </span>
        )}
        {card.quietDays !== null && (
          <span
            title="No update from a person in this many days"
            className="rounded bg-orange-100 px-1.5 text-[11px] font-semibold leading-[17px] text-orange-800"
          >
            Quiet {card.quietDays}d
          </span>
        )}
        {card.helping && (
          <span className="rounded border border-indigo-200 px-1.5 text-[11px] leading-[17px] text-indigo-700">
            Helping
          </span>
        )}
      </span>
      <LastUpdateLine update={task.lastUpdate} people={people} className="mt-1.5" />
    </button>
  );
}

function Who({
  person,
  people,
  onPerson,
  now,
}: {
  person: TaskTeamPerson;
  people: TaskPerson[];
  onPerson: () => void;
  now: Date;
}) {
  const seen = activity(person.lastActiveAt, now);
  const flags = personFlags(person, now);
  return (
    <div className="border-r border-gray-100 p-3.5">
      <button
        type="button"
        onClick={onPerson}
        className="flex max-w-full cursor-pointer items-center gap-2.5 text-left text-sm font-semibold text-gray-900 hover:text-indigo-700"
      >
        {person.email ? (
          <Avatar email={person.email} people={people} size={28} />
        ) : (
          <span className="size-7 shrink-0 rounded-full border-[1.5px] border-dashed border-gray-300" />
        )}
        <span className={cn("truncate", !person.email && "text-gray-500")}>
          {person.email ? personName(person.email, people) : "Nobody"}
        </span>
      </button>
      {person.email && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
          <span className={cn("size-[7px] shrink-0 rounded-full", seen.recent ? "bg-green-500" : "bg-gray-300")} />
          {seen.label}
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-gray-600">
        {personCounts(person).map(([count, label], index) => (
          <span key={label}>
            {index > 0 && " · "}
            <b className="font-semibold text-gray-900">{count}</b> {label}
          </span>
        ))}
      </p>
      {flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {flags.map((flag) => (
            <span key={flag.label} className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", FLAG_TONE[flag.tone])}>
              {flag.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The Team tab: one row per person (and Nobody, for unowned work), one
 * column per status. Built from the tasks alone: who is working on what, what
 * is stuck or waiting, what is in review, what is next and what got done this
 * week; quiet tasks and people are flagged. A name opens that person's page.
 */
export default function TeamBoard({
  filters,
  onFilters,
  selected,
  onOpen,
}: {
  filters: TeamFilters;
  onFilters: (changes: Partial<Record<"scope" | "area" | "helpers" | "person", string | null>>) => void;
  selected: string | null;
  onOpen: (id: string) => void;
}) {
  const { data, isPending, isError, dataUpdatedAt } = useTeam(filters.scope, filters.area, filters.helpers);
  const { data: people = [] } = useTaskPeople();
  const { data: boardList } = useTaskBoards();
  const boardNames = useMemo(
    () => new Map((boardList?.boards ?? []).map((board) => [board.key, board.name])),
    [boardList],
  );
  // Ages on screen are as of the last answer, kept fresh every minute.
  const now = useMemo(() => new Date(dataUpdatedAt), [dataUpdatedAt]);

  const person =
    filters.person && data
      ? (data.people.find((p) => (filters.person === "nobody" ? p.email === null : p.email === filters.person)) ??
        null)
      : null;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-md border border-gray-200 bg-white text-sm" role="group" aria-label="Which tasks">
        {(
          [
            { key: "sprint", label: data ? `This sprint · ${data.sprint.label}` : "This sprint" },
            { key: "open", label: "All open" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filters.scope === key}
            onClick={() => onFilters({ scope: key === "sprint" ? null : key })}
            className={cn(
              "cursor-pointer px-3 py-1.5",
              filters.scope === key ? "bg-indigo-50 font-medium text-indigo-700" : "text-gray-600 hover:bg-gray-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {AREAS.map(({ key, label }) => (
        <button
          key={label}
          type="button"
          aria-pressed={filters.area === key}
          onClick={() => onFilters({ area: key })}
          className={cn(
            "cursor-pointer rounded-full border px-3 py-1 text-sm",
            filters.area === key
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
          )}
        >
          {label}
        </button>
      ))}
      <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={filters.helpers}
          onChange={(event) => onFilters({ helpers: event.target.checked ? null : "0" })}
          className="size-3.5 cursor-pointer accent-indigo-600"
        />
        Show tasks they help on
      </label>
      <span className="ml-auto text-xs text-gray-500">
        {data &&
          `${isError ? "Couldn't refresh · showing" : "Updated"} ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · sorted by work in progress`}
      </span>
    </div>
  );

  if (isPending)
    return (
      <div className="space-y-4">
        {toolbar}
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-sm text-gray-500">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading the team…
        </div>
      </div>
    );
  // A failed refresh keeps the last board on screen (the line above says so).
  if (!data)
    return (
      <div className="space-y-4">
        {toolbar}
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
          The team view didn&apos;t load. Try again in a moment.
        </p>
      </div>
    );

  const card = (c: TaskTeamCard) => (
    <TeamCard
      key={`${c.task.id}${c.helping ? "-h" : ""}`}
      card={c}
      people={people}
      boardNames={boardNames}
      onOpen={onOpen}
      selected={selected === c.task.id}
    />
  );
  const columnLabel = (key: keyof TaskTeamColumns, label: string) =>
    key === "next" && data.scope === "sprint" ? "Up next · this sprint" : label;

  if (filters.person) {
    if (!person)
      return (
        <div className="space-y-4">
          {toolbar}
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
            Nothing for this person here.{" "}
            <button type="button" className="cursor-pointer text-indigo-700 hover:underline" onClick={() => onFilters({ person: null })}>
              Back to the team
            </button>
          </p>
        </div>
      );
    const seen = activity(person.lastActiveAt, now);
    const flags = personFlags(person, now);
    const stats: Array<[number, string]> = [
      [owned(person.columns, "working"), "working on it"],
      [owned(person.columns, "blocked"), "stuck or waiting"],
      [owned(person.columns, "review"), "review & QA"],
      [owned(person.columns, "next"), data.scope === "sprint" ? "up next" : "to do"],
      [quietCount(person), "quiet 3+ days"],
      [owned(person.columns, "done"), "done · 7 days"],
    ];
    return (
      <div className="space-y-4">
        {toolbar}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5">
          <button
            type="button"
            onClick={() => onFilters({ person: null })}
            className="inline-flex cursor-pointer items-center gap-1 text-sm text-indigo-700 hover:underline"
          >
            <ArrowLeft className="size-4" /> Team
          </button>
          <div className="flex items-center gap-3">
            {person.email ? (
              <Avatar email={person.email} people={people} size={40} />
            ) : (
              <span className="size-10 rounded-full border-2 border-dashed border-gray-300" />
            )}
            <div>
              <p className="text-lg font-semibold text-gray-900">{person.email ? personName(person.email, people) : "Nobody"}</p>
              {person.email && (
                <p className="flex items-center gap-1.5 text-[13px] text-gray-500">
                  <span className={cn("size-[7px] rounded-full", seen.recent ? "bg-green-500" : "bg-gray-300")} />
                  {seen.label} · {person.updatesThisWeek} {person.updatesThisWeek === 1 ? "update" : "updates"} this week
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-5">
            {stats.map(([count, label]) => (
              <div key={label} className="text-xs text-gray-500">
                <b className="block text-xl font-semibold text-gray-900">{count}</b>
                {label}
              </div>
            ))}
          </div>
          {flags.length > 0 && (
            <div className="ml-auto flex flex-wrap gap-1">
              {flags.map((flag) => (
                <span key={flag.label} className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", FLAG_TONE[flag.tone])}>
                  {flag.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {TEAM_COLUMNS.map(({ key, label, dot }) => {
            const cards = person.columns[key];
            return (
              <section key={key} className="flex flex-col gap-2 rounded-xl bg-gray-100/80 p-2.5">
                <h3 className="flex items-center gap-2 px-0.5 pb-0.5 text-[13px] font-semibold text-gray-700">
                  <span className={cn("size-2 rounded-full", dot)} />
                  {columnLabel(key, label)}
                  <span className="font-medium text-gray-400">{cards.length}</span>
                </h3>
                {cards.length === 0 ? (
                  <p className="px-0.5 py-1 text-xs text-gray-400">Nothing here</p>
                ) : key === "next" ? (
                  upNextGroups(cards, data.sprint.start).map((group) => (
                    <div key={group.label} className="flex flex-col gap-2">
                      <p className="px-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {group.label} · {group.cards.length}
                      </p>
                      {group.cards.map(card)}
                    </div>
                  ))
                ) : (
                  cards.map(card)
                )}
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  const stats: Array<[number, string, boolean?]> = [
    [data.summary.people, "people with open tasks"],
    [data.summary.working, "working on it"],
    [data.summary.blocked, "stuck or waiting"],
    [data.summary.review, "in review & QA"],
    [data.summary.quiet, "quiet 3+ days", data.summary.quiet > 0],
    [data.summary.doneThisWeek, "done in the last 7 days"],
  ];

  return (
    <div className="space-y-4">
      {toolbar}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(([count, label, warn]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white px-3.5 py-3">
            <b className={cn("block text-[22px] font-semibold", warn ? "text-amber-700" : "text-gray-900")}>{count}</b>
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
      {data.people.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          No open tasks here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="min-w-[1100px]">
            <div className="grid grid-cols-[232px_repeat(5,minmax(0,1fr))] border-b border-gray-200 bg-gray-50">
              <div className="px-3 py-2.5 text-xs font-semibold text-gray-600">Person</div>
              {TEAM_COLUMNS.map(({ key, label, dot }) => (
                <div key={key} className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-gray-600">
                  <span className={cn("size-2 rounded-full", dot)} />
                  {columnLabel(key, label)}
                </div>
              ))}
            </div>
            {data.people.map((p) => {
              const open = () => onFilters({ person: p.email ?? "nobody" });
              const outside = data.scope === "sprint" ? outsideScope(p) : 0;
              return (
                <div
                  key={p.email ?? "nobody"}
                  className="grid grid-cols-[232px_repeat(5,minmax(0,1fr))] border-t border-gray-100 first:border-t-0"
                >
                  <Who person={p} people={people} onPerson={open} now={now} />
                  {TEAM_COLUMNS.map(({ key }) => {
                    const cards = p.columns[key];
                    const extra = cards.length - CELL_CARDS;
                    return (
                      <div key={key} className="flex min-w-0 flex-col gap-2 border-r border-gray-100 p-2.5 last:border-r-0">
                        {cards.length === 0 ? (
                          <p className="px-0.5 py-1 text-xs text-gray-400">
                            {key === "next" && outside > 0
                              ? `Nothing in this sprint · ${outside} open outside it`
                              : "—"}
                          </p>
                        ) : (
                          cards.slice(0, CELL_CARDS).map(card)
                        )}
                        {extra > 0 && (
                          <button
                            type="button"
                            onClick={open}
                            className="cursor-pointer self-start px-0.5 text-xs font-medium text-indigo-700 hover:underline"
                          >
                            +{extra} more
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {data.truncated && (
        <p className="text-xs text-gray-500">More tasks than one page holds: the ones nobody has touched longest are left out.</p>
      )}
    </div>
  );
}
