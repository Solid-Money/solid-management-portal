"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, MessageSquare, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTaskBoards, useTaskList, useTaskPeople } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { PersonPicker, PriorityPicker } from "@/components/tasks/task-pickers";
import {
  Avatar,
  DueLabel,
  OPEN_STATUS_ORDER,
  PRIORITY_META,
  PriorityLabel,
  STATUS_HINTS,
  STATUS_META,
  StatusPill,
  TaskSource,
  formatWhen,
  personName,
} from "@/components/tasks/task-format";
import type {
  TaskListCounts,
  TaskListFilters,
  TaskListView,
  TaskPerson,
  TaskRow,
  TaskStatus,
} from "@/types/tasks";

const VIEWS: Array<{ view: TaskListView; label: string; count?: keyof TaskListCounts }> = [
  { view: "open", label: "All open", count: "open" },
  { view: "mine", label: "Mine", count: "mine" },
  { view: "mentions", label: "Mentions", count: "mentions" },
  { view: "done", label: "Done" },
];

function sortRows(rows: TaskRow[]): TaskRow[] {
  const rank = (row: TaskRow) => (row.priority ? PRIORITY_META[row.priority].rank : 9);
  return [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      (b.lastUpdateAt ?? b.createdAt).localeCompare(a.lastUpdateAt ?? a.createdAt),
  );
}

function Row({
  row,
  people,
  selected,
  onOpen,
  onLabel,
  boardName,
}: {
  row: TaskRow;
  people: TaskPerson[];
  selected: boolean;
  onOpen: () => void;
  onLabel: (label: string) => void;
  /** Set when every board is listed: each row says which board it's on. */
  boardName?: (key: string) => string | null;
}) {
  const board = boardName && row.board ? boardName(row.board) : null;
  const closed = row.status === "done" || row.status === "cancelled";
  return (
    <tr
      onClick={onOpen}
      tabIndex={0}
      aria-label={`T-${row.number}: ${row.title}`}
      onKeyDown={(event) => {
        // Keys pressed on a control inside the row (a label) are that control's.
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group cursor-pointer border-b border-gray-100 outline-none last:border-b-0 hover:bg-gray-50 focus-visible:bg-indigo-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400",
        selected && "bg-indigo-50/60 hover:bg-indigo-50",
      )}
    >
      <td className="py-2.5 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", row.hasNew ? "bg-indigo-600" : "bg-transparent")}
            title={row.hasNew ? "New since you last looked" : undefined}
          />
          <span
            className={cn(
              "truncate text-sm",
              row.hasNew ? "font-semibold text-gray-900" : "text-gray-800",
              closed && "text-gray-500",
            )}
          >
            {row.title}
          </span>
          {board && (
            <span className="hidden shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500 md:inline">
              {board}
            </span>
          )}
          {row.labels.slice(0, 2).map((label) => (
            <button
              key={label}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onLabel(label);
              }}
              className="hidden shrink-0 cursor-pointer rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 hover:bg-gray-200 xl:inline"
            >
              {label}
            </button>
          ))}
          {row.updateCount > 0 && (
            <span className="ml-auto hidden shrink-0 items-center gap-1 pl-2 text-xs text-gray-400 sm:inline-flex">
              <MessageSquare className="size-3.5" />
              {row.updateCount}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        {row.ownerEmail ? (
          <span className="flex items-center gap-1.5 text-xs text-gray-700">
            <span className="flex -space-x-1.5">
              <Avatar email={row.ownerEmail} people={people} size={22} ring />
              {row.helperEmails.slice(0, 2).map((email) => (
                <Avatar key={email} email={email} people={people} size={22} ring />
              ))}
            </span>
            <span className="hidden truncate lg:inline">{personName(row.ownerEmail, people).split(" ")[0]}</span>
          </span>
        ) : (
          <span className="text-xs text-gray-400">Nobody</span>
        )}
      </td>
      <td className="hidden px-3 py-2.5 sm:table-cell">
        <StatusPill status={row.status} />
        {row.status === "stuck" && row.quietDays !== null && row.quietDays >= 3 && (
          <span className="ml-1.5 text-[11px] text-red-600">quiet {row.quietDays}d</span>
        )}
      </td>
      <td className="hidden px-3 py-2.5 md:table-cell">
        <PriorityLabel priority={row.priority} />
      </td>
      <td className="hidden px-3 py-2.5 md:table-cell">
        <DueLabel date={row.dueDate} closed={closed} />
      </td>
      <td className="hidden px-3 py-2.5 lg:table-cell">
        <TaskSource row={row} people={people} />
      </td>
      <td className="hidden whitespace-nowrap px-3 py-2.5 pr-4 text-xs text-gray-500 xl:table-cell">
        {formatWhen(closed && row.closedAt ? row.closedAt : (row.lastUpdateAt ?? row.createdAt))}
      </td>
    </tr>
  );
}

function Table({
  rows,
  people,
  selected,
  onOpen,
  onLabel,
  boardName,
  done,
}: {
  rows: TaskRow[];
  people: TaskPerson[];
  selected: string | null;
  onOpen: (id: string) => void;
  onLabel: (label: string) => void;
  boardName?: (key: string) => string | null;
  done?: boolean;
}) {
  return (
    <table className="w-full table-fixed">
      <thead>
        <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">
          <th className="py-2 pl-4 pr-3 font-medium">Task</th>
          <th className="w-[4.5rem] px-3 py-2 font-medium sm:w-[7.5rem] lg:w-[10rem]">Owner</th>
          <th className="hidden w-[9.5rem] px-3 py-2 font-medium sm:table-cell">Status</th>
          <th className="hidden w-[6.5rem] px-3 py-2 font-medium md:table-cell">Priority</th>
          <th className="hidden w-[8.5rem] px-3 py-2 font-medium md:table-cell">Due</th>
          <th className="hidden w-[11rem] px-3 py-2 font-medium lg:table-cell">Opened by</th>
          <th className="hidden w-[8.5rem] px-3 py-2 pr-4 font-medium xl:table-cell">{done ? "Closed" : "Last update"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Row
            key={row.id}
            row={row}
            people={people}
            selected={row.id === selected}
            onOpen={() => onOpen(row.id)}
            onLabel={onLabel}
            boardName={boardName}
          />
        ))}
      </tbody>
    </table>
  );
}

function Group({
  status,
  rows,
  ...table
}: {
  status: TaskStatus;
  rows: TaskRow[];
  people: TaskPerson[];
  selected: string | null;
  onOpen: (id: string) => void;
  onLabel: (label: string) => void;
  boardName?: (key: string) => string | null;
}) {
  const [open, setOpen] = useState(true);
  const meta = STATUS_META[status];
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50"
      >
        {open ? (
          <ChevronDown className="size-4 text-gray-400" />
        ) : (
          <ChevronRight className="size-4 text-gray-400" />
        )}
        <span className={cn("h-2.5 w-2.5 rounded-full", meta.swatch)} />
        <span className="text-sm font-semibold text-gray-900">{meta.label}</span>
        <span className="text-xs text-gray-500">{rows.length}</span>
        {STATUS_HINTS[status] && (
          <span className="ml-2 hidden text-xs text-gray-400 sm:inline">{STATUS_HINTS[status]}</span>
        )}
      </button>
      {open && (
        <div className="border-t border-gray-100">
          <Table rows={sortRows(rows)} {...table} />
        </div>
      )}
    </section>
  );
}

/**
 * Every task the team has, open ones grouped by status. Views pick whose
 * (all, mine, mentions, the AI's); filters narrow by owner, priority and
 * label; search takes words or a task number.
 */
export default function TaskList({
  filters,
  onFilters,
  selected,
  onOpen,
  counts,
}: {
  filters: TaskListFilters;
  onFilters: (next: Partial<TaskListFilters>) => void;
  selected: string | null;
  onOpen: (id: string) => void;
  counts: TaskListCounts | undefined;
}) {
  const { data: people = [] } = useTaskPeople();
  const list = useTaskList(filters);
  const [search, setSearch] = useState(filters.q ?? "");
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.rows) ?? [], [list.data]);
  const liveCounts = list.data?.pages[0]?.counts ?? counts;
  const groups = useMemo(
    () =>
      OPEN_STATUS_ORDER.map((status) => ({ status, rows: rows.filter((row) => row.status === status) })).filter(
        (group) => group.rows.length > 0,
      ),
    [rows],
  );
  const filtered = !!(filters.owner || filters.priority || filters.label || filters.q);
  const { data: boards } = useTaskBoards();
  const boardNames = useMemo(
    () => new Map((boards?.boards ?? []).map((board) => [board.key, board.name])),
    [boards],
  );
  const table = {
    people,
    selected,
    onOpen,
    onLabel: (label: string) => onFilters({ label }),
    ...(filters.board ? {} : { boardName: (key: string) => boardNames.get(key) ?? null }),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200">
        {VIEWS.map(({ view, label, count }) => {
          const n = count && liveCounts ? liveCounts[count] : null;
          return (
            <button
              key={view}
              type="button"
              onClick={() => onFilters({ view })}
              className={cn(
                "-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
                filters.view === view
                  ? "border-indigo-600 font-medium text-indigo-700"
                  : "border-transparent text-gray-600 hover:text-gray-900",
              )}
            >
              {label}
              {n !== null && n > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-semibold",
                    view === "mentions" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600",
                  )}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative w-full sm:w-72"
          onSubmit={(event) => {
            event.preventDefault();
            onFilters({ q: search.trim() || undefined });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (!event.target.value) onFilters({ q: undefined });
            }}
            placeholder="Search titles or T-number"
            className="h-8 pl-8 text-sm"
          />
        </form>
        <PersonPicker
          people={people}
          value={filters.owner && filters.owner !== "none" ? filters.owner : null}
          onChange={(owner) => onFilters({ owner: owner ?? "none" })}
        >
          <Button variant="outline" size="sm" className={cn(filters.owner && "border-indigo-300 text-indigo-700")}>
            Owner:{" "}
            {filters.owner === "none" ? "Nobody" : filters.owner ? personName(filters.owner, people) : "Anyone"}
          </Button>
        </PersonPicker>
        <PriorityPicker value={filters.priority ?? null} onChange={(priority) => onFilters({ priority: priority ?? undefined })}>
          <Button variant="outline" size="sm" className={cn(filters.priority && "border-indigo-300 text-indigo-700")}>
            Priority: {filters.priority ? PRIORITY_META[filters.priority].label : "Any"}
          </Button>
        </PriorityPicker>
        {filters.label && (
          <Button variant="outline" size="sm" className="border-indigo-300 text-indigo-700" onClick={() => onFilters({ label: undefined })}>
            Label: {filters.label} <X />
          </Button>
        )}
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500"
            onClick={() => {
              setSearch("");
              onFilters({ owner: undefined, priority: undefined, label: undefined, q: undefined });
            }}
          >
            Clear filters
          </Button>
        )}
        {list.isFetching && !list.isLoading && <Loader2 className="size-4 animate-spin text-gray-400" />}
      </div>

      {list.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-indigo-600" />
        </div>
      ) : list.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
          Couldn&apos;t load tasks.{" "}
          <button type="button" className="cursor-pointer underline" onClick={() => void list.refetch()}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-16 text-center text-sm text-gray-500">
          {filtered
            ? "No tasks match these filters."
            : filters.view === "mentions"
              ? "Nobody has mentioned you lately."
              : filters.view === "mine"
                ? "Nothing on your plate."
                : filters.view === "done"
                  ? "Nothing closed yet."
                  : "No open tasks here."}
        </div>
      ) : filters.view === "done" ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <Table rows={rows} done {...table} />
          </div>
          {list.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                {list.isFetchingNextPage && <Loader2 className="animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Group key={group.status} status={group.status} rows={group.rows} {...table} />
          ))}
        </div>
      )}
    </div>
  );
}
