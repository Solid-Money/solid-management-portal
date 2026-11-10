"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
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
  Megaphone,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Rocket,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";
import {
  isTaskId,
  usePatchTask,
  useRefreshTask,
  TASK_KEYS,
  useMarketing,
  useTask,
  useTaskBoards,
  useTaskPeople,
} from "@/hooks/use-tasks";
import {
  addChecklistItem,
  deleteChecklistItem,
  deleteTask,
  followTask,
  patchChecklistItem,
  postTaskUpdate,
} from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import TaskComposer from "@/components/tasks/task-composer";
import TaskUpdateCard, {
  Attachments,
  TaskText,
  inlineImages,
  taskUpdateApi,
} from "@/components/tasks/task-update-card";
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
  PriorityLabel,
  StatusPill,
  authorName,
  formatWhen,
  personName,
} from "@/components/tasks/task-format";
import type {
  TaskBodyInput,
  TaskDetail,
  TaskLink,
  TaskMarketingInput,
  TaskPerson,
  TaskUpdate,
} from "@/types/tasks";
import {
  CAMPAIGN_SWATCH,
  CampaignPicker,
  ChannelChip,
  ChannelPicker,
  PublishPicker,
  StagePicker,
  StagePill,
} from "@/components/tasks/marketing-format";
import { ApprovalBox, AssetField, BriefEditor, LaunchPicker } from "@/components/tasks/marketing-piece";
import { launchesFor, publishLabel } from "@/lib/task-marketing";

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

/** Updates in the order they were written: the newest last. */
function oldestFirst(updates: TaskUpdate[]): TaskUpdate[] {
  return [...updates].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

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
  onSave: (input: Required<TaskBodyInput>) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const { body, format, mentions, attachments } = task.description;
  const empty = !body && !attachments.length;

  if (editing)
    return (
      <TaskComposer
        people={people}
        initial={{ body, format, mentions, attachments }}
        placeholder="What needs to happen, and why… @ to mention, paste an image or a table"
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
          <TaskText
            className="pr-6"
            body={body}
            format={format}
            mentions={mentions}
            attachments={attachments}
            people={people}
          />
          <Attachments attachments={attachments} inline={inlineImages(body, format)} />
        </>
      )}
    </div>
  );
}

/** Delete, after asking: only for the person who opened the task. */
function DeleteTask({ task, onDeleted }: { task: TaskDetail; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await deleteTask(task.id);
      queryClient.removeQueries({ queryKey: TASK_KEYS.task(task.id) });
      void queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
      toast.success("Task deleted");
      setOpen(false);
      onDeleted();
    } catch {
      // The API layer shows the error.
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        aria-label="Delete task"
        title="Delete task"
        className="text-gray-500 hover:text-red-700"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>
              &ldquo;{task.title}&rdquo; and its updates go away for everyone. To keep it, set it to Done or
              Cancelled instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" disabled={busy} onClick={() => void remove()}>
              {busy && <Loader2 className="animate-spin" />}
              Delete task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskBody({
  task,
  people,
  me,
  onDeleted,
}: {
  task: TaskDetail;
  people: TaskPerson[];
  me: string;
  onDeleted: () => void;
}) {
  const patch = usePatchTask(task.id);
  const refresh = useRefreshTask();
  const { data: boardList } = useTaskBoards();
  const boards = boardList?.boards ?? [];
  const boardName = task.board ? (boards.find((b) => b.key === task.board)?.name ?? task.board) : null;
  const [following, setFollowing] = useState<boolean | null>(null);
  const isFollowing = following ?? task.following;
  const closed = task.status === "done" || task.status === "cancelled";

  // A marketing piece: stage, channel, publish, campaign, launch, asset.
  const piece = task.marketing;
  const { data: marketing } = useMarketing(null, !!piece);
  const campaigns = marketing?.campaigns ?? [];
  const campaign = piece?.campaignId ? campaigns.find((c) => c.id === piece.campaignId) : null;
  const launches = launchesFor(marketing?.pieces ?? [], piece?.campaignId ?? null, {
    id: task.id,
    parentId: piece?.parentId,
  });
  const parent = piece?.parentId ? marketing?.pieces.find((p) => p.id === piece.parentId) : null;
  const patchPiece = (input: TaskMarketingInput) => patch.mutateAsync({ marketing: input });

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
          {task.visibility === "restricted" && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5">
              <Lock className="size-3" /> Private
            </span>
          )}
          {/* Who opened it and when: a person, Solid AI, the radar or Claude. */}
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
            {task.source.kind !== "manual" || task.createdBy.bot || !task.createdBy.email ? (
              <BotAvatar size={16} />
            ) : (
              <Avatar email={task.createdBy.email} people={people} size={16} />
            )}
            <span className="truncate">
              Opened by {authorName(task.createdBy, people)}
              {task.source.kind !== "manual" && task.source.label && (
                <span className="text-gray-400"> · {task.source.label}</span>
              )}
              <span className="text-gray-400"> · {formatWhen(task.createdAt)}</span>
            </span>
          </span>
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
            {/* Solid AI's and the radar's tasks are cancelled, not deleted. */}
            {!task.createdBy.bot && !!me && task.createdBy.email?.toLowerCase() === me.toLowerCase() && (
              <DeleteTask task={task} onDeleted={onDeleted} />
            )}
          </div>
        </div>

        <TitleEditor task={task} onSave={(title) => patch.mutate({ title })} />
        <SheetDescription className="sr-only">Task T-{task.number}</SheetDescription>

        <div className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 sm:grid-cols-[5rem_minmax(0,1fr)_5rem_minmax(0,1fr)]">
          {piece ? (
            <Field icon={CircleDot} label="Status">
              <StagePicker value={piece.stage} onChange={(stage) => void patchPiece({ stage })}>
                <button type="button" className="cursor-pointer">
                  <StagePill stage={piece.stage} cancelled={task.status === "cancelled"} />
                </button>
              </StagePicker>
              {patch.isPending && <Loader2 className="size-3.5 animate-spin text-gray-400" />}
            </Field>
          ) : (
            <Field icon={CircleDot} label="Status">
              <StatusPicker value={task.status} onChange={(status) => patch.mutate({ status })}>
                <button type="button" className="cursor-pointer">
                  <StatusPill status={task.status} />
                </button>
              </StatusPicker>
              {patch.isPending && <Loader2 className="size-3.5 animate-spin text-gray-400" />}
            </Field>
          )}
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
          {piece ? (
            <Field icon={Megaphone} label="Channel">
              <ChannelPicker value={piece.channel} onChange={(channel) => void patchPiece({ channel })}>
                <button type="button" className={fieldButton}>
                  {piece.channel ? <ChannelChip channel={piece.channel} /> : <span className="text-gray-400">Add</span>}
                </button>
              </ChannelPicker>
            </Field>
          ) : (
            <Field icon={Flag} label="Priority">
              <PriorityPicker value={task.priority} onChange={(priority) => patch.mutate({ priority })}>
                <button type="button" className={fieldButton}>
                  <PriorityLabel priority={task.priority} />
                </button>
              </PriorityPicker>
            </Field>
          )}
          {piece ? (
            <Field icon={CalendarDays} label="Publish">
              <PublishPicker
                on={piece.publishOn}
                time={piece.publishTime}
                onChange={({ on, time }) => void patchPiece({ publishOn: on, publishTime: time })}
              >
                <button type="button" className={fieldButton}>
                  {piece.publishOn ? (
                    <span className="truncate">{publishLabel(piece.publishOn, piece.publishTime)}</span>
                  ) : (
                    <span className="text-gray-400">Add a date</span>
                  )}
                </button>
              </PublishPicker>
            </Field>
          ) : (
            <Field icon={CalendarDays} label="Due">
              <DuePicker value={task.dueDate} onChange={(dueDate) => patch.mutate({ dueDate })}>
                <button type="button" className={fieldButton}>
                  <DueLabel date={task.dueDate} closed={closed} />
                </button>
              </DuePicker>
            </Field>
          )}
          <Field icon={LayoutGrid} label="Board">
            <BoardPicker boards={boards} value={task.board} onChange={(board) => patch.mutate({ board })}>
              <button type="button" className={fieldButton}>
                {boardName ? <span className="truncate">{boardName}</span> : <span className="text-gray-400">No board</span>}
              </button>
            </BoardPicker>
          </Field>
          {piece ? (
            <Field icon={LayoutGrid} label="Campaign">
              <CampaignPicker
                campaigns={campaigns}
                value={piece.campaignId}
                onChange={(campaignId) =>
                  // A launch is in one campaign: moving the piece leaves it.
                  void patchPiece(
                    campaignId !== piece.campaignId && piece.parentId ? { campaignId, parentId: null } : { campaignId },
                  )
                }
              >
                <button type="button" className={fieldButton}>
                  {campaign ? (
                    <>
                      <span className={cn("size-2.5 shrink-0 rounded-[3px]", CAMPAIGN_SWATCH[campaign.color])} />
                      <span className="truncate">{campaign.name}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">No campaign</span>
                  )}
                </button>
              </CampaignPicker>
            </Field>
          ) : (
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
          )}
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
          {piece && (
            <>
              {/* A launch has pieces under it; it isn't under one. */}
              {piece.channel !== "launch" && (
                <Field icon={Rocket} label="Launch">
                  <LaunchPicker launches={launches} value={piece.parentId} onChange={(parentId) => void patchPiece({ parentId })}>
                    <button type="button" className={fieldButton}>
                      {parent ? (
                        <span className="truncate">{parent.title}</span>
                      ) : (
                        <span className="text-gray-400">{piece.parentId ? "A launch" : "None"}</span>
                      )}
                    </button>
                  </LaunchPicker>
                </Field>
              )}
              <Field icon={Paperclip} label="Asset">
                <AssetField url={piece.assetUrl} onSave={(assetUrl) => patchPiece({ assetUrl })} />
              </Field>
            </>
          )}
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
        {piece && (
          <>
            <ApprovalBox task={task} people={people} me={me} onSave={patchPiece} onChanged={(next) => refresh(task.id, next)} />
            <BriefEditor brief={piece.brief} onSave={(brief) => patchPiece({ brief })} />
          </>
        )}
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
          {/* Like monday: oldest first, the newest at the bottom, and the box
              to write the next one under it. */}
          <div className="space-y-3">
            <p className="pb-1 text-center text-xs text-gray-400">
              Opened by {authorName(task.createdBy, people)} · {formatWhen(task.createdAt)}
            </p>
            {oldestFirst(task.updates).map((update) => (
              <TaskUpdateCard
                key={update.id}
                api={taskUpdateApi(task.id)}
                update={update}
                me={me}
                people={people}
                onChanged={() => refresh(task.id)}
              />
            ))}
          </div>
          <TaskComposer
            className="mt-4"
            people={people}
            placeholder="Write an update… @ to mention, @Claude to ask AI to look into it"
            askClaude
            onSubmit={async (input) => {
              await postTaskUpdate(task.id, input);
              refresh(task.id);
            }}
          />
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
          <TaskBody key={task.id} task={task} people={people} me={me} onDeleted={onClose} />
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
