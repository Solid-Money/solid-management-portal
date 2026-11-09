"use client";

import { Fragment, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { TASK_KEYS, useTaskBoards } from "@/hooks/use-tasks";
import {
  createTaskBoard,
  deleteTaskBoard,
  renameTaskBoard,
} from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import type { TaskBoard, TaskBoards } from "@/types/tasks";

const NAME_MAX = 40;

function Pill({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 max-w-[14rem] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm",
        active
          ? "border-indigo-200 bg-indigo-50 font-medium text-indigo-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
      )}
    >
      <span className="truncate">{label}</span>
      {count !== null && count > 0 && (
        <span
          className={cn(
            "text-xs tabular-nums",
            active ? "text-indigo-500" : "text-gray-400",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Boards across the top of the task list: All, then each board, then a way
 * to add one. The board open in the URL gets a menu to rename or delete it.
 */
export default function BoardTabs({
  value,
  onChange,
}: {
  /** A board key, "none", or null for all boards. */
  value: string | null;
  onChange: (board: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const { data } = useTaskBoards();
  const [naming, setNaming] = useState<{ board: TaskBoard | null } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<TaskBoard | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const boards = data?.boards ?? [];

  const saved = (next: TaskBoards) => {
    queryClient.setQueryData(TASK_KEYS.boards, next);
    void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
  };

  const openNaming = (board: TaskBoard | null) => {
    setName(board?.name ?? "");
    setNaming({ board });
  };

  const submitName = async () => {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!naming || !trimmed || saving) return;
    setSaving(true);
    try {
      if (naming.board) {
        saved(await renameTaskBoard(naming.board.key, trimmed));
      } else {
        const before = new Set(boards.map((board) => board.key));
        const next = await createTaskBoard(trimmed);
        saved(next);
        const added = next.boards.find((board) => !before.has(board.key));
        if (added) onChange(added.key);
      }
      setNaming(null);
    } catch {
      // The API layer shows the error; keep the dialog open.
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const board = deleting;
    setDeleting(null);
    try {
      saved(await deleteTaskBoard(board.key));
      if (value === board.key) onChange(null);
    } catch {
      // The API layer shows the error.
    }
  };

  const menu = (board: TaskBoard) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${board.name} board options`}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onSelect={() => openNaming(board)}>
          <Pencil /> Rename board
        </DropdownMenuItem>
        {board.system ? (
          <p className="px-2 py-1.5 text-xs text-gray-500">
            {board.name} is filled automatically, so it can&apos;t be deleted.
          </p>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleting(board)}
          >
            <Trash2 /> Delete board
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill
        active={value === null}
        label="All"
        count={data?.all ?? null}
        onClick={() => onChange(null)}
      />
      {boards.map((board) => (
        <Fragment key={board.key}>
          <Pill
            active={value === board.key}
            label={board.name}
            count={board.open}
            onClick={() => onChange(board.key)}
          />
          {value === board.key && menu(board)}
        </Fragment>
      ))}
      {(value === "none" || (data?.unsorted ?? 0) > 0) && (
        <Pill
          active={value === "none"}
          label="No board"
          count={data?.unsorted ?? null}
          onClick={() => onChange("none")}
        />
      )}
      <button
        type="button"
        onClick={() => openNaming(null)}
        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-900"
      >
        <Plus className="size-3.5" /> New board
      </button>

      <Dialog
        open={naming !== null}
        onOpenChange={(open) => !open && setNaming(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {naming?.board ? "Rename board" : "New board"}
            </DialogTitle>
            <DialogDescription>
              {naming?.board
                ? "Its tasks stay on it."
                : "A tab for one kind of work, like Features, Bugs or Marketing."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitName();
            }}
          >
            <Input
              autoFocus
              value={name}
              maxLength={NAME_MAX}
              placeholder="Board name"
              onChange={(event) => setName(event.target.value)}
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNaming(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 text-white hover:bg-indigo-700"
                disabled={!name.trim() || saving}
              >
                {saving && <Loader2 className="animate-spin" />}
                {naming?.board ? "Save" : "Add board"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={deleting !== null}
        title={`Delete ${deleting?.name ?? "board"}?`}
        message={
          deleting && deleting.open > 0
            ? `Its ${deleting.open} open task${deleting.open === 1 ? "" : "s"} stay, on no board.`
            : "Its tasks stay, on no board."
        }
        confirmText="Delete board"
        isDestructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
