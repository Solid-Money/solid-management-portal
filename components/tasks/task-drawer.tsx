"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CircleDot,
  Flag,
  Headphones,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Tag,
  Timer,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/components/auth-provider";
import {
  isTaskId,
  usePatchTask,
  useRefreshTask,
  useTask,
  useTaskBoards,
  useTaskPeople,
} from "@/hooks/use-tasks";
import {
  addChecklistItem,
  deleteChecklistItem,
  followTask,
  patchChecklistItem,
  postTaskUpdate,
} from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import TaskComposer from "@/components/tasks/task-composer";
import TaskUpdateCard, { Attachments, taskUpdateApi } from "@/components/tasks/task-update-card";
import {
  BoardPicker,
  DuePicker,
  PeoplePicker,
  PersonPicker,
  PriorityPicker,
  SprintPicker,
  StatusPicker,
} from "@/components/tasks/task-pickers";
import { sprintLabel, sprintStart } from "@/lib/task-format";
import {
  Avatar,
  BotAvatar,
  DueLabel,
  MentionText,
  PriorityLabel,
  StatusPill,
  authorName,
  formatWhen,
  personName,
} from "@/components/tasks/task-format";
import type { TaskDetail, TaskLink, TaskPerson } from "@/types/tasks";

/** A label and its value: two cells, so the grid fits two fields a row from `sm`. */
function Field({
  icon: Icon,
  label,
  wide = false,
  children,
}: {
  icon: typeof User;
  label: string;
  /** Takes the rest of the row (links). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex h-8 items-center gap-2 text-xs text-gray-500">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </div>
      <div className={cn("flex min-h-8 min-w-0 flex-wrap items-center gap-1.5", wide && "sm:col-span-3")}>
        {children}
      </div>
    </>
  );
}

const fieldButton =
  "inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-sm text-gray-800 hover:bg-gray-100";

function linkHref(link: TaskLink): string | null {
  switch (link.kind) {
    case "conversation":
      return `/support?c=${encodeURIComponent(link.ref)}`;
    case "user":
      return `/users/${encodeURIComponent(link.ref)}`;
    case "task":
      return `/tasks?task=${encodeURIComponent(link.ref)}`;
    case "url":
      return /^https?:\/\//.test(link.ref) ? link.ref : null;
  }
}

function LinkChip({ link }: { link: TaskLink }) {
  const href = linkHref(link);
  const Icon = link.kind === "conversation" ? Headphones : link.kind === "user" ? User : Link2;
  const label =
    link.label ??
    (link.kind === "conversation" ? "Support conversation" : link.kind === "user" ? "User" : link.ref);
  const body = (
    <>
      <Icon className="size-3.5 shrink-0 text-gray-400" />
      <span className="truncate">{label}</span>
    </>
  );
  const className =
    "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-gray-200 px-2 text-xs text-gray-700 hover:bg-gray-50";
  if (!href) return <span className={className}>{body}</span>;
  if (link.kind === "url")
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {body}
      </a>
    );
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function TitleEditor({ task, onSave }: { task: TaskDetail; onSave: (title: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null)
    return (
      <SheetTitle
        className="cursor-text rounded-md px-1 py-0.5 text-xl font-semibold leading-snug text-gray-900 hover:bg-gray-50"
        onClick={() => setDraft(task.title)}
      >
        {task.title}
      </SheetTitle>
    );
  const save = () => {
    const title = draft.trim();
    setDraft(null);
    if (title && title !== task.title) onSave(title);
  };
  return (
    <>
      <SheetTitle className="sr-only">{task.title}</SheetTitle>
      <textarea
        autoFocus
        value={draft}
        rows={2}
        maxLength={200}
        onChange={(event) => setDraft(event.target.value.replace(/\n/g, " "))}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDraft(null);
          }
        }}
        className="w-full resize-none rounded-md border border-indigo-300 px-1 py-0.5 text-xl font-semibold leading-snug text-gray-900 outline-none ring-2 ring-indigo-100"
      />
    </>
  );
}

function Labels({ labels, onChange }: { labels: string[]; onChange: (labels: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const add = () => {
    const label = draft.trim().toLowerCase();
    setDraft("");
    setAdding(false);
    if (label && !labels.includes(label)) onChange([...labels, label]);
  };
  return (
    <>
      {labels.map((label) => (
        <span
          key={label}
          className="group inline-flex h-6 items-center gap-1 rounded-md bg-gray-100 pl-2 pr-1 text-xs text-gray-700"
        >
          {label}
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={() => onChange(labels.filter((l) => l !== label))}
            className="cursor-pointer rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={draft}
          maxLength={40}
          placeholder="Label"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={add}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setDraft("");
              setAdding(false);
            }
          }}
          className="h-6 w-28 rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-indigo-400"
        />
      ) : (
        labels.length < 10 && (
          <button type="button" onClick={() => setAdding(true)} className={cn(fieldButton, "text-gray-400")}>
            <Plus className="size-3.5" />
            {labels.length ? "" : "Add label"}
          </button>
        )
      )}
    </>
  );
}

function Checklist({
  task,
  people,
  onChanged,
}: {
  task: TaskDetail;
  people: TaskPerson[];
  onChanged: (task: TaskDetail) => void;
}) {
  const [draft, setDraft] = useState("");
  const done = task.checklist.filter((item) => item.done).length;

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onChanged(await addChecklistItem(task.id, { text }));
  };

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Checklist</h3>
        {task.checklist.length > 0 && (
          <span className="text-xs text-gray-500">
            {done}/{task.checklist.length}
          </span>
        )}
        {task.checklist.length > 0 && (
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: `${(done / task.checklist.length) * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="space-y-0.5">
        {task.checklist.map((item) => (
          <div key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-gray-50">
            <Checkbox
              checked={item.done}
              onCheckedChange={async (checked) =>
                onChanged(await patchChecklistItem(task.id, item.id, { done: checked === true }))
              }
            />
            <span className={cn("min-w-0 flex-1 text-sm", item.done ? "text-gray-400 line-through" : "text-gray-800")}>
              {item.text}
            </span>
            <PersonPicker
              people={people}
              value={item.ownerEmail}
              align="end"
              onChange={async (ownerEmail) =>
                onChanged(await patchChecklistItem(task.id, item.id, { ownerEmail }))
              }
            >
              <button type="button" className="cursor-pointer rounded-full" aria-label="Who does this">
                {item.ownerEmail ? (
                  <Avatar email={item.ownerEmail} people={people} size={20} />
                ) : (
                  <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-300 opacity-0 group-hover:opacity-100">
                    <User className="size-3" />
                  </span>
                )}
              </button>
            </PersonPicker>
            <button
              type="button"
              aria-label="Remove item"
              onClick={async () => onChanged(await deleteChecklistItem(task.id, item.id))}
              className="cursor-pointer rounded p-0.5 text-gray-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      {task.checklist.length < 50 && (
        <div className="mt-1 flex items-center gap-2 px-1">
          <Plus className="size-4 text-gray-300" />
          <input
            value={draft}
            maxLength={300}
            placeholder="Add an item"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void add();
              }
            }}
            onBlur={() => void add()}
            className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>
      )}
    </section>
  );
}

function Description({
  task,
  people,
  onSave,
}: {
  task: TaskDetail;
  people: TaskPerson[];
  onSave: (input: { body: string; mentions: string[]; attachmentIds: string[] }) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const { body, mentions, attachments } = task.description;
  const empty = !body && !attachments.length;

  if (editing)
    return (
      <TaskComposer
        people={people}
        initial={{ body, mentions }}
        placeholder="What needs to happen, and why… @ to mention, paste an image"
        submitLabel="Save"
        autoFocus
        minRows={4}
        onCancel={() => setEditing(false)}
        onSubmit={async (input) => {
          await onSave(input);
          setEditing(false);
        }}
      />
    );

  return (
    <div
      className={cn(
        "group relative rounded-lg border px-4 py-3",
        empty ? "border-dashed border-gray-200" : "border-gray-200 bg-gray-50/60",
      )}
    >
      {empty ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full cursor-pointer text-left text-sm text-gray-400"
        >
          Add a description…
        </button>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Edit description"
            className="absolute right-2 top-2 text-gray-400 opacity-0 group-hover:opacity-100"
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
          {body && (
            <p className="whitespace-pre-wrap break-words pr-6 text-sm leading-relaxed text-gray-800">
              <MentionText body={body} mentions={mentions} people={people} />
            </p>
          )}
          <Attachments attachments={attachments} />
        </>
      )}
    </div>
  );
}

function TaskBody({ task, people, me }: { task: TaskDetail; people: TaskPerson[]; me: string }) {
  const patch = usePatchTask(task.id);
  const refresh = useRefreshTask();
  const { data: boardList } = useTaskBoards();
  const boards = boardList?.boards ?? [];
  const boardName = task.board ? (boards.find((b) => b.key === task.board)?.name ?? task.board) : null;
  const [following, setFollowing] = useState<boolean | null>(null);
  const isFollowing = following ?? task.following;
  const closed = task.status === "done" || task.status === "cancelled";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/tasks?task=${task.id}`);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  // One scroll for the whole task: the fields go up with the description and
  // updates instead of staying pinned and leaving a small window below.
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="border-b border-gray-200 px-6 pb-4 pt-5">
        <div className="mb-2 flex items-center gap-2 pr-8 text-xs text-gray-500">
          <span className="shrink-0 whitespace-nowrap font-mono font-medium text-gray-600">T-{task.number}</span>
          {task.visibility === "restricted" && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5">
              <Lock className="size-3" /> Private
            </span>
          )}
          {task.source.kind !== "manual" && (
            <span className="hidden min-w-0 items-center gap-1.5 truncate sm:inline-flex">
              <BotAvatar size={16} />
              Opened by {authorName(task.createdBy, people)}
              {task.source.label && <span className="text-gray-400">· {task.source.label}</span>}
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="xs" onClick={() => void copyLink()}>
              <Link2 /> <span className="hidden sm:inline">Copy link</span>
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className={cn(isFollowing && "text-indigo-700")}
              onClick={async () => {
                const next = !isFollowing;
                setFollowing(next);
                try {
                  await followTask(task.id, next);
                  refresh(task.id);
                } catch {
                  setFollowing(!next);
                }
              }}
            >
              <Bell className={cn(isFollowing && "fill-indigo-100")} />
              {isFollowing ? "Following" : "Follow"}
            </Button>
          </div>
        </div>

        <TitleEditor task={task} onSave={(title) => patch.mutate({ title })} />
        <SheetDescription className="sr-only">Task T-{task.number}</SheetDescription>

        <div className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 sm:grid-cols-[5rem_minmax(0,1fr)_5rem_minmax(0,1fr)]">
          <Field icon={CircleDot} label="Status">
            <StatusPicker value={task.status} onChange={(status) => patch.mutate({ status })}>
              <button type="button" className="cursor-pointer">
                <StatusPill status={task.status} />
              </button>
            </StatusPicker>
            {patch.isPending && <Loader2 className="size-3.5 animate-spin text-gray-400" />}
          </Field>
          <Field icon={User} label="Owner">
            <PersonPicker
              people={people}
              value={task.ownerEmail}
              onChange={(ownerEmail) => patch.mutate({ ownerEmail })}
            >
              <button type="button" className={fieldButton}>
                {task.ownerEmail ? (
                  <>
                    <Avatar email={task.ownerEmail} people={people} size={20} />
                    <span className="truncate">{personName(task.ownerEmail, people)}</span>
                  </>
                ) : (
                  <span className="text-gray-400">Nobody yet</span>
                )}
              </button>
            </PersonPicker>
          </Field>
          <Field icon={Flag} label="Priority">
            <PriorityPicker value={task.priority} onChange={(priority) => patch.mutate({ priority })}>
              <button type="button" className={fieldButton}>
                <PriorityLabel priority={task.priority} />
              </button>
            </PriorityPicker>
          </Field>
          <Field icon={CalendarDays} label="Due">
            <DuePicker value={task.dueDate} onChange={(dueDate) => patch.mutate({ dueDate })}>
              <button type="button" className={fieldButton}>
                <DueLabel date={task.dueDate} closed={closed} />
              </button>
            </DuePicker>
          </Field>
          <Field icon={LayoutGrid} label="Board">
            <BoardPicker boards={boards} value={task.board} onChange={(board) => patch.mutate({ board })}>
              <button type="button" className={fieldButton}>
                {boardName ? <span className="truncate">{boardName}</span> : <span className="text-gray-400">No board</span>}
              </button>
            </BoardPicker>
          </Field>
          <Field icon={Timer} label="Sprint">
            <SprintPicker value={task.sprint} onChange={(sprint) => patch.mutate({ sprint })}>
              <button type="button" className={fieldButton}>
                {task.sprint ? (
                  <span className="truncate">
                    {task.sprint === sprintStart() ? "This sprint" : "Sprint"}{" "}
                    <span className="text-gray-500">· {sprintLabel(task.sprint)}</span>
                  </span>
                ) : (
                  <span className="text-gray-400">Backlog</span>
                )}
              </button>
            </SprintPicker>
            {task.carriedOver > 0 && !closed && (
              <span
                className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
                title="Sprints that ended with it still open"
              >
                Carried over{task.carriedOver > 1 ? ` ×${task.carriedOver}` : ""}
              </span>
            )}
          </Field>
          <Field icon={Users} label="Helpers">
            <PeoplePicker
              people={people}
              value={task.helperEmails}
              onChange={(helperEmails) => patch.mutate({ helperEmails })}
            >
              <button type="button" className={fieldButton}>
                {task.helperEmails.length ? (
                  <span className="flex -space-x-1.5">
                    {task.helperEmails.map((email) => (
                      <Avatar key={email} email={email} people={people} size={20} ring />
                    ))}
                  </span>
                ) : (
                  <span className="text-gray-400">Add</span>
                )}
              </button>
            </PeoplePicker>
          </Field>
          <Field icon={Tag} label="Labels">
            <Labels labels={task.labels} onChange={(labels) => patch.mutate({ labels })} />
          </Field>
          {task.links.length > 0 && (
            <Field icon={Link2} label="Linked" wide>
              {task.links.map((link, index) => (
                <LinkChip key={`${link.kind}:${link.ref}:${index}`} link={link} />
              ))}
            </Field>
          )}
        </div>
      </div>

      <div className="space-y-6 px-6 py-5">
        <Description
          task={task}
          people={people}
          onSave={(description) => patch.mutateAsync({ description })}
        />

        <Checklist task={task} people={people} onChanged={(next) => refresh(task.id, next)} />

        <section>
          <div className="mb-2 flex items-center gap-2">
            <MessageSquare className="size-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Updates</h3>
            <span className="text-xs text-gray-500">{task.updateCount}</span>
          </div>
          <TaskComposer
            people={people}
            onSubmit={async (input) => {
              await postTaskUpdate(task.id, input);
              refresh(task.id);
            }}
          />
          <div className="mt-4 space-y-3">
            {task.updates.map((update) => (
              <TaskUpdateCard
                key={update.id}
                api={taskUpdateApi(task.id)}
                update={update}
                me={me}
                people={people}
                onChanged={() => refresh(task.id)}
              />
            ))}
            <p className="pt-1 text-center text-xs text-gray-400">
              Opened by {authorName(task.createdBy, people)} · {formatWhen(task.createdAt)}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * A task, over the list: its fields at the top, then the description,
 * checklist and the updates feed. Opened by `?task=<id>`, so the URL is the
 * link to share.
 */
export default function TaskDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { user } = useAuth();
  const { data: task, isLoading, isError } = useTask(taskId);
  const { data: people = [] } = useTaskPeople();
  const me = user?.email?.toLowerCase() ?? "";

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 p-0 sm:max-w-2xl">
        {task ? (
          <TaskBody key={task.id} task={task} people={people} me={me} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-gray-500">
            <SheetTitle className="sr-only">Task</SheetTitle>
            <SheetDescription className="sr-only">Loading the task</SheetDescription>
            {isLoading && <Loader2 className="size-5 animate-spin text-indigo-600" />}
            {(isError || (!!taskId && !isTaskId(taskId))) && (
              <p>This task doesn&apos;t exist or isn&apos;t shared with you.</p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
