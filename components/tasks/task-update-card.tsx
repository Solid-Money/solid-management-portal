"use client";

import { useState } from "react";
import { Eye, FileText, MoreHorizontal, Pencil, Reply, SmilePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  deleteFeedPost,
  deleteTaskUpdate,
  editFeedPost,
  editTaskUpdate,
  postTaskUpdate,
  postToFeed,
  reactToFeedPost,
  reactToTaskUpdate,
} from "@/lib/tasks-api";
import TaskComposer from "@/components/tasks/task-composer";
import {
  AuthorAvatar,
  STATUS_META,
  authorName,
  firstName,
  formatDue,
  formatWhen,
  MentionText,
  personName,
  PRIORITY_META,
} from "@/components/tasks/task-format";
import {
  TASK_REACTIONS,
  type TaskActivity,
  type TaskAttachment,
  type TaskPerson,
  type TaskPriority,
  type TaskBodyInput,
  type TaskReaction,
  type TaskStatus,
  type TaskUpdate,
} from "@/types/tasks";

/** Where an update lives: a task's feed, or the Team feed. */
export interface UpdateApi {
  react: (updateId: string, emoji: TaskReaction) => Promise<unknown>;
  edit: (updateId: string, input: { body: string; mentions: string[] }) => Promise<unknown>;
  remove: (updateId: string) => Promise<unknown>;
  reply: (parentId: string, input: Required<TaskBodyInput>) => Promise<unknown>;
}

export function taskUpdateApi(taskId: string): UpdateApi {
  return {
    react: (updateId, emoji) => reactToTaskUpdate(taskId, updateId, emoji),
    edit: (updateId, input) => editTaskUpdate(taskId, updateId, input),
    remove: (updateId) => deleteTaskUpdate(taskId, updateId),
    reply: (parentId, input) => postTaskUpdate(taskId, { ...input, parentId }),
  };
}

export const feedUpdateApi: UpdateApi = {
  react: (postId, emoji) => reactToFeedPost(postId, emoji),
  edit: (postId, input) => editFeedPost(postId, input),
  remove: (postId) => deleteFeedPost(postId),
  reply: (parentId, input) => postToFeed({ ...input, parentId }),
};

/** Images inside the message, at a readable size; other files as chips. */
export function Attachments({ attachments }: { attachments: TaskAttachment[] }) {
  if (!attachments.length) return null;
  const images = attachments.filter((a) => a.mime.startsWith("image/"));
  const others = attachments.filter((a) => !a.mime.startsWith("image/"));
  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <div className={cn("grid gap-2", images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {images.map((image) =>
            image.url ? (
              <a
                key={image.key}
                href={image.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-md border border-gray-200 bg-gray-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived link to the support service */}
                <img
                  src={image.url}
                  alt={image.fileName ?? "Image"}
                  loading="lazy"
                  className="max-h-80 w-full object-contain"
                />
              </a>
            ) : (
              <div
                key={image.key}
                className="flex h-24 items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-400"
              >
                Image unavailable
              </div>
            ),
          )}
        </div>
      )}
      {others.map((file) => (
        <a
          key={file.key}
          href={file.url ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          <FileText className="size-3.5 shrink-0 text-gray-400" />
          <span className="truncate">{file.fileName ?? "File"}</span>
        </a>
      ))}
    </div>
  );
}

function activityValue(activity: TaskActivity, value: string | null, people: TaskPerson[]): string {
  if (value === null || value === "") return "nothing";
  switch (activity.field) {
    case "status":
      return STATUS_META[value as TaskStatus]?.label ?? value;
    case "priority":
      return PRIORITY_META[value as TaskPriority]?.label ?? value;
    case "owner":
      return personName(value, people);
    case "due":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDue(value) : value;
    case "board":
      return value;
    default:
      return `“${value}”`;
  }
}

/** A field change, shown as one quiet line in the feed. */
function ActivityLine({ update, people }: { update: TaskUpdate; people: TaskPerson[] }) {
  const activity = update.activity;
  if (!activity) return null;
  const who = update.author.bot ? authorName(update.author, people) : firstName(update.author.email, people);
  const what =
    activity.field === "created"
      ? "created this task"
      : activity.field === "title"
        ? `renamed it to ${activityValue(activity, activity.to, people)}`
        : activity.field === "board"
          ? activity.to
            ? `moved it to ${activity.to}`
            : `took it off ${activity.from ?? "its board"}`
          : `changed ${activity.field === "due" ? "the due date" : activity.field} from ${activityValue(
            activity,
            activity.from,
            people,
          )} to ${activityValue(activity, activity.to, people)}`;
  return (
    <div className="flex items-center gap-2 py-1 pl-1 text-xs text-gray-500">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
      <span>
        <span className="font-medium text-gray-700">{who}</span> {what}
      </span>
      <span className="ml-auto shrink-0 text-gray-400">{formatWhen(update.createdAt)}</span>
    </div>
  );
}

function Reactions({
  update,
  me,
  people,
  onReact,
}: {
  update: TaskUpdate;
  me: string;
  people: TaskPerson[];
  onReact: (emoji: (typeof TASK_REACTIONS)[number]) => void;
}) {
  if (!update.reactions.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {update.reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          title={reaction.emails.map((email) => personName(email, people)).join(", ")}
          onClick={() => onReact(reaction.emoji)}
          className={cn(
            "inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-xs",
            reaction.emails.includes(me)
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
          )}
        >
          <span>{reaction.emoji}</span>
          {reaction.emails.length}
        </button>
      ))}
    </div>
  );
}

/**
 * One update: who wrote it and when, the text with mentions picked out,
 * images inside the message, reactions, replies and who has seen it. Field
 * changes render as a single line instead.
 */
export default function TaskUpdateCard({
  api,
  update,
  me,
  people,
  isReply = false,
  onChanged,
}: {
  api: UpdateApi;
  update: TaskUpdate;
  me: string;
  people: TaskPerson[];
  isReply?: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);

  if (update.kind === "activity") return <ActivityLine update={update} people={people} />;

  const mine = !!update.author.email && update.author.email === me;
  const seen = update.seenBy.filter((email) => email !== update.author.email);

  const react = async (emoji: (typeof TASK_REACTIONS)[number]) => {
    setReactOpen(false);
    await api.react(update.id, emoji);
    onChanged();
  };

  return (
    <div className={cn(!isReply && "rounded-lg border border-gray-200 bg-white")}>
      <div className={cn("flex gap-3", isReply ? "py-2" : "p-3.5")}>
        <AuthorAvatar author={update.author} people={people} size={isReply ? 24 : 30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-gray-900">{authorName(update.author, people)}</span>
            <span className="text-xs text-gray-400">
              {formatWhen(update.createdAt)}
              {update.editedAt && !update.deleted && " · edited"}
            </span>
            {!update.deleted && (
              <div className="ml-auto flex items-center gap-0.5">
                <Popover open={reactOpen} onOpenChange={setReactOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label="React" className="text-gray-400">
                      <SmilePlus />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="flex w-auto gap-1 p-1">
                    {TASK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => void react(emoji)}
                        className="cursor-pointer rounded-md px-1.5 py-1 text-base hover:bg-gray-100"
                      >
                        {emoji}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                {mine && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-xs" aria-label="More" className="text-gray-400">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(true)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-700"
                        onSelect={async () => {
                          if (!window.confirm("Delete this update?")) return;
                          await api.remove(update.id);
                          onChanged();
                        }}
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>

          {update.deleted ? (
            <p className="mt-1 text-sm italic text-gray-400">This update was deleted.</p>
          ) : editing ? (
            <TaskComposer
              className="mt-2"
              people={people}
              initial={{ body: update.body, mentions: update.mentions }}
              allowAttachments={false}
              autoFocus
              minRows={2}
              submitLabel="Save"
              onCancel={() => setEditing(false)}
              onSubmit={async ({ body, mentions }) => {
                await api.edit(update.id, { body, mentions });
                setEditing(false);
                onChanged();
              }}
            />
          ) : (
            <>
              {update.body && (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">
                  <MentionText body={update.body} mentions={update.mentions} people={people} />
                </p>
              )}
              <Attachments attachments={update.attachments} />
              <Reactions update={update} me={me} people={people} onReact={(emoji) => void react(emoji)} />
            </>
          )}

          {!isReply && !update.deleted && !editing && (
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <button
                type="button"
                onClick={() => setReplying((open) => !open)}
                className="inline-flex cursor-pointer items-center gap-1 hover:text-gray-900"
              >
                <Reply className="size-3.5" /> Reply
              </button>
              {seen.length > 0 && (
                <span
                  className="ml-auto inline-flex items-center gap-1"
                  title={seen.map((email) => personName(email, people)).join(", ")}
                >
                  <Eye className="size-3.5" /> Seen by {seen.length}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {!isReply && (update.replies.length > 0 || replying) && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-3.5 pb-2 pl-14">
          {update.replies.map((reply) => (
            <TaskUpdateCard
              key={reply.id}
              api={api}
              update={reply}
              me={me}
              people={people}
              isReply
              onChanged={onChanged}
            />
          ))}
          {replying && (
            <TaskComposer
              className="my-2"
              people={people}
              placeholder="Reply… @ to mention"
              submitLabel="Reply"
              autoFocus
              minRows={2}
              onCancel={() => setReplying(false)}
              onSubmit={async (input) => {
                await api.reply(update.id, input);
                setReplying(false);
                onChanged();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
