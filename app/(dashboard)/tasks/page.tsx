"use client";

import { Suspense, useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListTodo, Loader2, MessagesSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaskCounts } from "@/hooks/use-tasks";
import NewTaskDialog from "@/components/tasks/new-task-dialog";
import TeamFeed from "@/components/tasks/team-feed";
import { cn } from "@/lib/utils";
import TaskDrawer from "@/components/tasks/task-drawer";
import TaskList from "@/components/tasks/task-list";
import BoardTabs from "@/components/tasks/board-tabs";
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

/**
 * The team's tasks, on boards (Features, Bugs, Support, …), by hand or opened
 * by Solid AI and the radar, and the Team feed beside them. The tab, board,
 * view, filters and the open task live in the URL (`?tab=feed&post=`,
 * `?board=&view=&owner=&priority=&label=&q=&task=`), so any task or post is a link.
 */
function TasksScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [creating, setCreating] = useState(false);
  const tab = params.get("tab") === "feed" ? "feed" : "tasks";
  const { data: counts } = useTaskCounts();

  const rawView = params.get("view");
  // Old links: the "From support" and "From radar" views are boards now.
  const legacyBoard = rawView === "support" || rawView === "radar" ? rawView : null;
  const view = legacyBoard ? "open" : rawView;
  const board = params.get("board") ?? legacyBoard;
  const priority = params.get("priority");
  const filters: TaskListFilters = {
    view: isView(view) ? view : "open",
    ...(board ? { board } : {}),
    ...(params.get("owner") ? { owner: params.get("owner")! } : {}),
    ...(isPriority(priority) ? { priority } : {}),
    ...(params.get("label") ? { label: params.get("label")! } : {}),
    ...(params.get("q") ? { q: params.get("q")! } : {}),
  };
  const open = params.get("task");

  const update = useCallback(
    (changes: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(params.toString());
      // An old ?view=support|radar link moves onto ?board= on the first change.
      if (legacyBoard) {
        if (!next.has("board")) next.set("board", legacyBoard);
        next.delete("view");
      }
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (next.get("view") === "open") next.delete("view");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router, legacyBoard],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
          <p className="mt-1 text-sm text-gray-500">
            Everything the team is working on, opened by hand or by Solid AI and the radar.
          </p>
        </div>
        <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setCreating(true)}>
          <Plus /> New task
        </Button>
      </div>

      <div className="inline-flex rounded-lg bg-gray-200/70 p-1">
        {(
          [
            { key: "tasks", label: "Tasks", icon: ListTodo },
            { key: "feed", label: "Team feed", icon: MessagesSquare },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => update({ tab: key === "feed" ? "feed" : null, post: null })}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
              tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "feed" ? (
        <TeamFeed highlight={params.get("post")} />
      ) : (
        <>
          <BoardTabs
            value={board}
            onChange={(next) => update({ board: next })}
          />
          <TaskList
          filters={filters}
          onFilters={(next) => update(next)}
          selected={open}
          onOpen={(id) => update({ task: id })}
          counts={counts}
        />
        </>
      )}

      <TaskDrawer taskId={open} onClose={() => update({ task: null })} />
      <NewTaskDialog
        open={creating}
        defaultBoard={board && board !== "none" ? board : null}
        onOpenChange={setCreating}
        onCreated={(id) => update({ task: id, tab: null })}
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
