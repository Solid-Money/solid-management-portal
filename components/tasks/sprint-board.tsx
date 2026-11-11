"use client";

import { useDeferredValue, useMemo, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Inbox, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASK_KEYS, useTaskBoards, useTaskPeople, useTaskSprint } from "@/hooks/use-tasks";
import { getTasks, patchTask } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import {
  Avatar,
  DueLabel,
  PRIORITY_META,
  PriorityLabel,
  STATUS_META,
  StatusPill,
  personName,
} from "@/components/tasks/task-format";
import type {
  TaskPatchInput,
  TaskPerson,
  TaskRow,
  TaskSprintPage,
  TaskStatus,
} from "@/types/tasks";

/** The board's columns: the statuses each holds, and the one a card dropped there gets. */
const COLUMNS: Array<{ key: string; label: string; statuses: TaskStatus[]; drop: TaskStatus }> = [
  { key: "todo", label: "To do", statuses: ["todo"], drop: "todo" },
  { key: "doing", label: "In progress", statuses: ["working", "waiting", "stuck"], drop: "working" },
  { key: "review", label: "Review & QA", statuses: ["review", "qa"], drop: "review" },
  { key: "done", label: "Done", statuses: ["done", "cancelled"], drop: "done" },
];

const DRAG_TYPE = "application/x-solid-task";

interface Dragged {
  id: string;
  from: "sprint" | "backlog";
}

/** The task being dropped, or null when the drop isn't one of ours. */
function readDrag(event: DragEvent): Dragged | null {
  try {
    const value = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as Partial<Dragged> | null;
    if (typeof value?.id !== "string" || (value.from !== "sprint" && value.from !== "backlog")) return null;
    return { id: value.id, from: value.from };
  } catch {
    return null;
  }
}

function byUrgency(a: TaskRow, b: TaskRow): number {
  const rank = (row: TaskRow) => (row.priority ? PRIORITY_META[row.priority].rank : 9);
  return rank(a) - rank(b) || a.number - b.number;
}

function Card({
  row,
  people,
  boardName,
  selected,
  draggable,
  showStatus,
  onOpen,
}: {
  row: TaskRow;
  people: TaskPerson[];
  boardName: string | null;
  selected: boolean;
  draggable: boolean;
  showStatus: boolean;
  onOpen: () => void;
}) {
  const closed = row.status === "done" || row.status === "cancelled";
  const carried = row.carriedOver > 0 && !closed;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${row.title}, task ${row.number}`}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: row.id, from: "sprint" }));
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-pointer rounded-lg border border-gray-200 bg-white p-2.5 shadow-xs outline-none hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-indigo-400",
        selected && "border-indigo-300 ring-1 ring-indigo-200",
        draggable && "active:cursor-grabbing",
      )}
    >
      {(carried || row.priority) && (
        <div className="mb-1 flex items-center gap-1.5 text-[11px] text-gray-400">
          {carried && (
            <span
              className="rounded bg-amber-50 px-1 py-px font-medium text-amber-700"
              title="Sprints that ended with it still open"
            >
              Carried over{row.carriedOver > 1 ? ` ×${row.carriedOver}` : ""}
            </span>
          )}
          {row.priority && (
            <span className="ml-auto">
              <PriorityLabel priority={row.priority} />
            </span>
          )}
        </div>
      )}
      <p
        className={cn(
          "line-clamp-2 text-sm leading-snug text-gray-900",
          row.hasNew && "font-semibold",
          closed && "text-gray-500",
          row.status === "cancelled" && "line-through",
        )}
      >
        {row.hasNew && (
          <span
            className="mr-1.5 inline-block size-1.5 rounded-full bg-indigo-600 align-middle"
            title="New since you last looked"
          />
        )}
        {row.title}
      </p>
      <div className="mt-2 flex min-w-0 items-center gap-1.5">
        {row.ownerEmail ? (
          <Avatar email={row.ownerEmail} people={people} size={20} />
        ) : (
          <span className="text-[11px] text-gray-400">Nobody</span>
        )}
        {showStatus && <StatusPill status={row.status} className="h-5 px-2 text-[11px]" />}
        {boardName && (
          <span className="truncate rounded border border-gray-200 px-1.5 py-px text-[11px] text-gray-500">
            {boardName}
          </span>
        )}
        {row.dueDate && (
          <span className="ml-auto shrink-0">
            <DueLabel date={row.dueDate} closed={closed} />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The sprint board: one week's tasks in columns by status, like the monday
 * Main Sprint. Drag a card to another column to change its status, or a
 * backlog row onto the board to plan it into this sprint. Tasks still open
 * when the week ends move into the next sprint by themselves.
 */
export default function SprintBoard({
  start,
  onStart,
  selected,
  onOpen,
}: {
  /** A sprint's Monday from the URL; null for this week's. */
  start: string | null;
  onStart: (start: string | null) => void;
  selected: string | null;
  onOpen: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useTaskSprint(start);
  const { data: people = [] } = useTaskPeople();
  const { data: boardList } = useTaskBoards();
  const boardNames = useMemo(
    () => new Map((boardList?.boards ?? []).map((board) => [board.key, board.name])),
    [boardList],
  );
  const [over, setOver] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const key = TASK_KEYS.sprint(start);
  // The board brings the most urgent 200; past that, a search asks the API
  // for the rest of the open product tasks. The open list has no pages: it
  // returns up to 1,000 matches and says when there are more, which the
  // backlog then says too.
  const term = useDeferredValue(search.trim());
  const searchAll = !!data?.backlogHasMore && data.sprint.when !== "past" && term.length >= 2;
  const { data: found, isFetching: searching } = useQuery({
    queryKey: ["tasks", "backlog-search", term],
    queryFn: () => getTasks({ view: "open", area: "product", q: term }),
    enabled: searchAll,
    staleTime: 30_000,
  });

  const move = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskPatchInput }) => patchTask(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<TaskSprintPage>(key);
      if (before) {
        const row = before.rows.find((r) => r.id === id) ?? before.backlog.find((r) => r.id === id);
        if (row) {
          const moved: TaskRow = {
            ...row,
            ...(input.status ? { status: input.status } : {}),
            ...(input.sprint !== undefined ? { sprint: input.sprint } : {}),
          };
          const inSprint = moved.sprint === before.sprint.start;
          // Taken out of the sprint: back on top of the backlog until the refresh sorts it.
          const toBacklog = !inSprint && moved.sprint === null && !before.backlog.some((r) => r.id === id);
          queryClient.setQueryData<TaskSprintPage>(key, {
            ...before,
            rows: [...before.rows.filter((r) => r.id !== id), ...(inSprint ? [moved] : [])],
            backlog: inSprint
              ? before.backlog.filter((r) => r.id !== id)
              : toBacklog
                ? [moved, ...before.backlog]
                : before.backlog,
          });
        }
      }
      return { before };
    },
    // The API layer shows the error; put the card back.
    onError: (_error, _input, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-indigo-600" />
      </div>
    );
  // A failed refresh keeps the board it has; the message is for no board at all.
  if (!data)
    return <p className="py-10 text-center text-sm text-gray-500">The sprint couldn&apos;t be loaded. Try again in a moment.</p>;

  const { sprint, rows } = data;
  const past = sprint.when === "past";
  const done = rows.filter((row) => row.status === "done").length;
  const counted = rows.filter((row) => row.status !== "cancelled").length;
  const query = search.trim().toLowerCase();
  const shown = query
    ? data.backlog.filter((row) => `t-${row.number} ${row.title}`.toLowerCase().includes(query))
    : data.backlog;
  const shownIds = new Set(shown.map((row) => row.id));
  const backlog = searchAll
    ? [...shown, ...(found?.rows ?? []).filter((row) => row.sprint === null && !shownIds.has(row.id))]
    : shown;

  const drop = (event: DragEvent, column: (typeof COLUMNS)[number]) => {
    event.preventDefault();
    setOver(null);
    if (past) return;
    const dragged = readDrag(event);
    if (!dragged) return;
    const row = rows.find((r) => r.id === dragged.id);
    if (dragged.from === "backlog")
      move.mutate({ id: dragged.id, input: { sprint: sprint.start, status: column.drop } });
    else if (row && !column.statuses.includes(row.status))
      move.mutate({ id: dragged.id, input: { status: column.drop } });
  };

  // A card dropped on the backlog leaves the sprint (its status stays).
  const dropOnBacklog = (event: DragEvent) => {
    event.preventDefault();
    setOver(null);
    const dragged = readDrag(event);
    if (!dragged || dragged.from !== "sprint") return;
    const row = rows.find((r) => r.id === dragged.id);
    if (!row || row.status === "done" || row.status === "cancelled") return;
    move.mutate({ id: dragged.id, input: { sprint: null } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white">
          <button
            type="button"
            aria-label={`Previous sprint, ${data.previous.label}`}
            onClick={() => onStart(data.previous.when === "current" ? null : data.previous.start)}
            className="inline-flex size-9 cursor-pointer items-center justify-center text-gray-500 hover:text-gray-900"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-36 px-1 text-center text-sm font-semibold text-gray-900">
            Sprint {sprint.label}
          </span>
          <button
            type="button"
            aria-label={`Next sprint, ${data.next.label}`}
            onClick={() => onStart(data.next.when === "current" ? null : data.next.start)}
            className="inline-flex size-9 cursor-pointer items-center justify-center text-gray-500 hover:text-gray-900"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        {sprint.when === "current" ? (
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">This week</span>
        ) : (
          <>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {past ? "Ended" : "Upcoming"}
            </span>
            <button
              type="button"
              onClick={() => onStart(null)}
              className="cursor-pointer text-sm font-medium text-indigo-700 hover:underline"
            >
              Back to this week
            </button>
          </>
        )}
        {counted > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.round((done / counted) * 100)}%` }} />
            </div>
            {done} of {counted} done
          </div>
        )}
      </div>

      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
          {past
            ? `Nothing was finished in the ${sprint.label} sprint.`
            : `Nothing planned for ${sprint.label} yet. Drag tasks from the backlog below onto the board, or press New task.`}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const cards = rows.filter((row) => column.statuses.includes(row.status)).sort(byUrgency);
          return (
            <section
              key={column.key}
              aria-label={column.label}
              onDragOver={(event) => {
                if (past || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
                event.preventDefault();
                setOver(column.key);
              }}
              onDragLeave={() => setOver((current) => (current === column.key ? null : current))}
              onDrop={(event) => drop(event, column)}
              className={cn(
                "flex min-h-40 flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50/70 p-2",
                over === column.key && "border-indigo-300 bg-indigo-50/60",
              )}
            >
              <header className="flex items-center gap-2 px-1 pt-0.5">
                <span className={cn("size-2 rounded-full", STATUS_META[column.statuses[0]!].swatch)} />
                <h3 className="text-sm font-semibold text-gray-800">{column.label}</h3>
                <span className="text-xs tabular-nums text-gray-400">{cards.length}</span>
              </header>
              {cards.map((row) => (
                <Card
                  key={row.id}
                  row={row}
                  people={people}
                  boardName={row.board ? (boardNames.get(row.board) ?? null) : null}
                  selected={selected === row.id}
                  draggable={!past}
                  showStatus={column.statuses.length > 1 && row.status !== column.drop}
                  onOpen={() => onOpen(row.id)}
                />
              ))}
            </section>
          );
        })}
      </div>

      {!past && (
        <section
          aria-label="Backlog"
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
            event.preventDefault();
            setOver("backlog");
          }}
          onDragLeave={(event) => {
            // Only when the pointer leaves the backlog, not one of its rows.
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setOver((current) => (current === "backlog" ? null : current));
          }}
          onDrop={dropOnBacklog}
          className={cn(
            "rounded-xl border border-gray-200 bg-white",
            over === "backlog" && "border-indigo-300 bg-indigo-50/40",
          )}
        >
          <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
            <Inbox className="size-4 text-gray-400" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Backlog <span className="font-normal text-gray-400">{data.backlog.length}{data.backlogHasMore ? "+" : ""}</span>
              </h3>
              <p className="text-xs text-gray-500">
                Open product tasks in no sprint, most urgent first. Drag one onto the board, or press Add; drag a card
                back here to take it out of the sprint.
                {data.backlogHasMore && " Showing the most urgent; search finds the rest."}
              </p>
            </div>
            <div className="relative ml-auto w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find in the backlog"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </header>
          {backlog.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              {query
                ? searchAll && searching
                  ? "Searching the whole backlog…"
                  : "Nothing in the backlog matches."
                : "The backlog is empty: every open product task is in a sprint."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {backlog.map((row) => {
                const board = row.board ? (boardNames.get(row.board) ?? null) : null;
                return (
                  <li
                    key={row.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: row.id, from: "backlog" }));
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 hover:bg-gray-50",
                      selected === row.id && "bg-indigo-50/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(row.id)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                    >
                      <span className="truncate text-sm text-gray-800">{row.title}</span>
                      {board && (
                        <span className="hidden shrink-0 rounded border border-gray-200 px-1.5 py-px text-[11px] text-gray-500 sm:inline">
                          {board}
                        </span>
                      )}
                    </button>
                    <span className="hidden w-20 shrink-0 sm:block">
                      <PriorityLabel priority={row.priority} />
                    </span>
                    <span className="hidden w-6 shrink-0 sm:block" title={personName(row.ownerEmail, people)}>
                      {row.ownerEmail && <Avatar email={row.ownerEmail} people={people} size={20} />}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="shrink-0 text-indigo-700 hover:text-indigo-800"
                      onClick={() => move.mutate({ id: row.id, input: { sprint: sprint.start } })}
                    >
                      <Plus /> Add
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {searchAll && found?.hasMore && (
            <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
              Over 1,000 open tasks match, so not all are listed: type more of the title, or its T-number.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
