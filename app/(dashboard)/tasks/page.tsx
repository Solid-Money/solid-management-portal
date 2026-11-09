"use client";

import { Suspense, useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Headphones, ListTodo, Loader2, MessagesSquare, Plus, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaskBoards, useTaskCounts, useTaskSprint } from "@/hooks/use-tasks";
import NewTaskDialog from "@/components/tasks/new-task-dialog";
import TeamFeed from "@/components/tasks/team-feed";
import { cn } from "@/lib/utils";
import TaskDrawer from "@/components/tasks/task-drawer";
import TaskList from "@/components/tasks/task-list";
import BoardTabs, { Pill } from "@/components/tasks/board-tabs";
import PartnerWaits from "@/components/tasks/partner-waits";
import SprintBoard from "@/components/tasks/sprint-board";
import { sprintStart } from "@/lib/task-format";
import {
  TASK_PRIORITIES,
  TASK_VIEWS,
  type TaskListFilters,
  type TaskListView,
  type TaskPriority,
} from "@/types/tasks";

function isView(value: string | null): value is TaskListView {
  return !!value && (TASK_VIEWS as readonly string[]).includes(value);
}

function isPriority(value: string | null): value is TaskPriority {
  return !!value && (TASK_PRIORITIES as readonly string[]).includes(value);
}

const TABS = ["sprint", "product", "support", "partners", "feed"] as const;
type Tab = (typeof TABS)[number];

/** Support and Radar: escalated chats and radar alerts, kept apart from product work. */
const SUPPORT_BOARDS = new Set(["support", "radar"]);

function isTab(value: string | null): value is Tab {
  return !!value && (TABS as readonly string[]).includes(value);
}

/** The support pills: escalated chats, radar alerts, and cases waiting on partners. */
function SupportTabs({
  board,
  partners,
  onBoard,
  onPartners,
}: {
  board: string | null;
  partners: boolean;
  onBoard: (board: string) => void;
  onPartners: () => void;
}) {
  const { data } = useTaskBoards();
  const open = (key: string) => data?.boards.find((b) => b.key === key)?.open ?? null;
  const name = (key: string, fallback: string) => data?.boards.find((b) => b.key === key)?.name ?? fallback;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill
        active={!partners && board === "support"}
        label="Escalated chats"
        count={open("support")}
        onClick={() => onBoard("support")}
      />
      <Pill
        active={!partners && board === "radar"}
        label={name("radar", "Radar")}
        count={open("radar")}
        onClick={() => onBoard("radar")}
      />
      <Pill active={partners} label="Waiting on partners" count={null} onClick={onPartners} />
    </div>
  );
}

/**
 * The team's work in four tabs: the Sprint board (this week's tasks by
 * status, and the backlog to plan from), Product (Features, Bugs, Discussion
 * and the boards the team adds), Support (escalated chats, radar alerts and
 * cases waiting on partners), and the Team feed. The tab, board, sprint,
 * view, filters and the open task live in the URL (`?tab=&board=&sprint=&view=
 * &owner=&priority=&label=&q=&task=`), so any task, board or sprint is a link.
 */
function TasksScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [creating, setCreating] = useState<{ sprint: string | null } | null>(null);
  const { data: counts } = useTaskCounts();

  const rawView = params.get("view");
  // Old links: the "From support" and "From radar" views are boards now.
  const legacyBoard = rawView === "support" || rawView === "radar" ? rawView : null;
  const view = legacyBoard ? "open" : rawView;
  const board = params.get("board") ?? legacyBoard;
  const rawTab = params.get("tab");
  // Links from before the tabs (`?board=bugs`, `?view=mine`) land where that work is now.
  const tab: Tab = isTab(rawTab)
    ? rawTab
    : board
      ? SUPPORT_BOARDS.has(board)
        ? "support"
        : "product"
      : rawView || params.get("owner") || params.get("priority") || params.get("label") || params.get("q")
        ? "product"
        : "sprint";
  const supportBoard = tab === "support" ? (board && SUPPORT_BOARDS.has(board) ? board : "support") : null;
  const productBoard = tab === "product" && board && !SUPPORT_BOARDS.has(board) ? board : null;
  const priority = params.get("priority");
  const filters: TaskListFilters = {
    view: isView(view) ? view : "open",
    ...(tab === "support"
      ? { board: supportBoard! }
      : productBoard
        ? { board: productBoard }
        : { area: "product" as const }),
    ...(params.get("owner") ? { owner: params.get("owner")! } : {}),
    ...(isPriority(priority) ? { priority } : {}),
    ...(params.get("label") ? { label: params.get("label")! } : {}),
    ...(params.get("q") ? { q: params.get("q")! } : {}),
  };
  const open = params.get("task");
  // A sprint in the URL is a day (`YYYY-MM-DD`); anything else means this week.
  const rawSprint = params.get("sprint");
  const sprint =
    rawSprint && /^\d{4}-\d{2}-\d{2}$/.test(rawSprint) && !Number.isNaN(Date.parse(rawSprint))
      ? rawSprint
      : null;

  const update = useCallback(
    (changes: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(params.toString());
      // An old ?view=support|radar link moves onto ?board= on the first change.
      if (legacyBoard) {
        if (!next.has("board")) next.set("board", legacyBoard);
        next.delete("view");
      }
      // A tab read from an old link stays put when its board or view changes.
      if (!next.has("tab") && !("tab" in changes) && tab !== "sprint") next.set("tab", tab);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (next.get("view") === "open") next.delete("view");
      if (next.get("tab") === "sprint") next.delete("tab");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router, legacyBoard, tab],
  );

  /** A top tab: its own board, view and filters start fresh. */
  const goTo = (next: Tab) =>
    update({
      tab: next,
      board: next === "support" ? "support" : null,
      view: null,
      owner: null,
      priority: null,
      label: null,
      q: null,
      post: null,
    });

  // The same query the board reads, so while the next week loads (the board
  // still showing the last one) this is the week on screen too.
  const { data: shownSprint } = useTaskSprint(sprint, tab === "sprint");

  // From the Sprint tab, into the week the board shows (before anything has
  // loaded, the one in the URL, else this week), unless that week is over.
  const newTask = () => {
    if (tab !== "sprint") return setCreating({ sprint: null });
    const shown = shownSprint?.sprint;
    if (shown) return setCreating({ sprint: shown.when === "past" ? null : shown.start });
    const start = sprint ?? sprintStart();
    setCreating({ sprint: start >= sprintStart() ? start : null });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
          <p className="mt-1 text-sm text-gray-500">
            The sprint, product work, and support work from escalated chats and the radar.
          </p>
        </div>
        <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={newTask}>
          <Plus /> New task
        </Button>
      </div>

      <div className="inline-flex max-w-full flex-wrap rounded-lg bg-gray-200/70 p-1">
        {(
          [
            { key: "sprint", label: "Sprint", icon: Timer },
            { key: "product", label: "Product", icon: ListTodo },
            { key: "support", label: "Support", icon: Headphones },
            { key: "feed", label: "Team feed", icon: MessagesSquare },
          ] as const
        ).map(({ key, label, icon: Icon }) => {
          const active = tab === key || (key === "support" && tab === "partners");
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => goTo(key)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "feed" ? (
        <TeamFeed highlight={params.get("post")} />
      ) : tab === "sprint" ? (
        <SprintBoard
          start={sprint}
          onStart={(start) => update({ sprint: start })}
          selected={open}
          onOpen={(id) => update({ task: id })}
          onNewTask={(start) => setCreating({ sprint: start })}
        />
      ) : (
        <>
          {tab === "product" ? (
            <BoardTabs value={productBoard} onChange={(next) => update({ board: next })} />
          ) : (
            <SupportTabs
              board={supportBoard}
              partners={tab === "partners"}
              onBoard={(next) => update({ tab: "support", board: next })}
              onPartners={() => update({ tab: "partners", board: null })}
            />
          )}
          {tab === "partners" ? (
            <PartnerWaits />
          ) : (
            <TaskList
              filters={filters}
              onFilters={(next) => update(next)}
              selected={open}
              onOpen={(id) => update({ task: id })}
              counts={counts}
            />
          )}
        </>
      )}

      <TaskDrawer taskId={open} onClose={() => update({ task: null })} />
      <NewTaskDialog
        open={creating !== null}
        defaultBoard={tab === "support" ? supportBoard : productBoard && productBoard !== "none" ? productBoard : null}
        defaultSprint={creating?.sprint ?? null}
        onOpenChange={(next) => !next && setCreating(null)}
        onCreated={(id) => update({ task: id })}
      />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      }
    >
      <TasksScreen />
    </Suspense>
  );
}
