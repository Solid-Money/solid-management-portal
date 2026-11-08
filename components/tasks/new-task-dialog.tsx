"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Flag, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTaskPeople, TASK_KEYS } from "@/hooks/use-tasks";
import { createTask } from "@/lib/tasks-api";
import TaskComposer, { type ComposerValue } from "@/components/tasks/task-composer";
import { DuePicker, PersonPicker, PriorityPicker, StatusPicker } from "@/components/tasks/task-pickers";
import { Avatar, DueLabel, PriorityLabel, StatusPill, personName } from "@/components/tasks/task-format";
import type { TaskPriority, TaskStatus } from "@/types/tasks";

const chip =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 px-2.5 text-sm text-gray-700 hover:bg-gray-50";

/** A task by hand: a title is enough; everything else can wait. */
export default function NewTaskDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: people = [] } = useTaskPeople();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [owner, setOwner] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [saving, setSaving] = useState(false);
  // Remount the composer to clear it after a task is created.
  const [round, setRound] = useState(0);
  const description = useRef<ComposerValue>({ body: "", mentions: [], attachmentIds: [], uploading: false });
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setTitle("");
    setStatus("todo");
    setOwner(null);
    setPriority(null);
    setDue(null);
    setRestricted(false);
    setRound((n) => n + 1);
  };

  const create = async () => {
    if (!title.trim() || saving || uploading) return;
    setSaving(true);
    try {
      const { body, mentions, attachmentIds } = description.current;
      const task = await createTask({
        title: title.trim(),
        status,
        ...(owner ? { ownerEmail: owner } : {}),
        ...(priority ? { priority } : {}),
        ...(due ? { dueDate: due } : {}),
        ...(restricted ? { visibility: "restricted" as const } : {}),
        ...(body.trim() || attachmentIds.length
          ? { description: { body: body.trim(), mentions, attachmentIds } }
          : {}),
      });
      void queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
      reset();
      onOpenChange(false);
      onCreated(task.id);
    } catch {
      // The API layer shows the error; keep what was typed.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>People you @mention see it under Mentions.</DialogDescription>
        </DialogHeader>

        <input
          autoFocus
          value={title}
          maxLength={200}
          placeholder="What needs doing?"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void create();
            }
          }}
          className="w-full border-0 border-b border-gray-200 px-0 py-2 text-lg font-medium text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-500"
        />

        <div className="flex flex-wrap gap-2">
          <StatusPicker value={status} onChange={setStatus}>
            <button type="button" className={chip}>
              <StatusPill status={status} className="h-5" />
            </button>
          </StatusPicker>
          <PersonPicker people={people} value={owner} onChange={setOwner}>
            <button type="button" className={chip}>
              {owner ? (
                <>
                  <Avatar email={owner} people={people} size={18} />
                  {personName(owner, people)}
                </>
              ) : (
                <>
                  <User className="size-4 text-gray-400" /> Owner
                </>
              )}
            </button>
          </PersonPicker>
          <PriorityPicker value={priority} onChange={setPriority}>
            <button type="button" className={chip}>
              {priority ? (
                <PriorityLabel priority={priority} />
              ) : (
                <>
                  <Flag className="size-4 text-gray-400" /> Priority
                </>
              )}
            </button>
          </PriorityPicker>
          <DuePicker value={due} onChange={setDue}>
            <button type="button" className={chip}>
              {due ? (
                <DueLabel date={due} />
              ) : (
                <>
                  <CalendarDays className="size-4 text-gray-400" /> Due
                </>
              )}
            </button>
          </DuePicker>
        </div>

        <TaskComposer
          key={round}
          people={people}
          hideSubmit
          minRows={4}
          placeholder="Details, links, screenshots… @ to mention"
          onChange={(value) => {
            description.current = value;
            setUploading(value.uploading);
          }}
        />

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <Checkbox checked={restricted} onCheckedChange={(checked) => setRestricted(checked === true)} />
          Private: only the owner, helpers, followers and you can see it
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-indigo-600 text-white hover:bg-indigo-700"
            disabled={!title.trim() || saving || uploading}
            onClick={() => void create()}
          >
            {saving && <Loader2 className="animate-spin" />}
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
