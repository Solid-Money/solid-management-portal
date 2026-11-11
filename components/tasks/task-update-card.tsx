"use client";

import { useMemo, useState, type ReactElement } from "react";
import { Download, Eye, Loader2, MoreHorizontal, Pencil, Reply, SmilePlus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fileSize, imageUrls, inlineKeys, isClaudeLooking, renderableHtml } from "@/lib/task-rich";
import { deleteTaskUpdate, editTaskUpdate, postTaskUpdate, reactToTaskUpdate } from "@/lib/tasks-api";
import TaskComposer from "@/components/tasks/task-composer";
import ImagePreview, { type PreviewImage } from "@/components/tasks/image-preview";
import {
  AuthorAvatar,
  Avatar,
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
  type TaskBodyFormat,
  type TaskPerson,
  type TaskPriority,
  type TaskBodyInput,
  type TaskReaction,
  type TaskStatus,
  type TaskUpdate,
} from "@/types/tasks";

/** The calls an update card makes. */
export interface UpdateApi {
  react: (updateId: string, emoji: TaskReaction) => Promise<unknown>;
  edit: (updateId: string, input: { body: string; format: TaskBodyFormat; mentions: string[] }) => Promise<unknown>;
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

/**
 * The message's files: images at a readable size (those already shown inside
 * rich text are left out), any other file as a card that downloads it.
 */
export function Attachments({
  attachments,
  inline,
}: {
  attachments: TaskAttachment[];
  /** Keys of the images shown inside the text. */
  inline?: Set<string>;
}) {
  // An inline image with no link can't show in the text: its fallback shows here.
  const shown = inline
    ? attachments.filter((a) => !inline.has(a.key) || (a.mime.startsWith("image/") && !a.url))
    : attachments;
  const [preview, setPreview] = useState<PreviewImage | null>(null);
  if (!shown.length) return null;
  const images = shown.filter((a) => a.mime.startsWith("image/"));
  const others = shown.filter((a) => !a.mime.startsWith("image/"));
  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <div className={cn("grid gap-2", images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {images.map((image) =>
            image.url ? (
              <button
                key={image.key}
                type="button"
                aria-label={`View ${image.fileName ?? "the image"} larger`}
                onClick={(event) => setPreview({ src: image.url!, name: image.fileName, from: event.currentTarget })}
                className="block w-full cursor-zoom-in overflow-hidden rounded-md border border-gray-200 bg-gray-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived link to the support service */}
                <img
                  src={image.url}
                  alt={image.fileName ?? "Image"}
                  loading="lazy"
                  className="max-h-80 w-full object-contain"
                />
              </button>
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
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map((file) => (
            <a
              key={file.key}
              href={file.url ?? undefined}
              target="_blank"
              rel="noreferrer"
              title={file.url ? `Download ${file.fileName ?? "the file"}` : "The link expired: reopen the task"}
              className="group/file inline-flex h-11 max-w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-white pl-2.5 pr-3 text-left hover:border-gray-300 hover:bg-gray-50"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[10px] font-semibold uppercase text-indigo-700">
                {fileExtension(file)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-gray-800">{file.fileName ?? "File"}</span>
                <span className="block text-[11px] text-gray-400">{fileSize(file.size)}</span>
              </span>
              <Download className="size-3.5 shrink-0 text-gray-400 group-hover/file:text-gray-700" />
            </a>
          ))}
        </div>
      )}
      <ImagePreview image={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

/** "PDF", "XLSX", "ZIP"…: from the name, at most four letters. */
function fileExtension(file: TaskAttachment): string {
  if (file.mime === "application/pdf") return "PDF";
  const ext = /\.([a-z0-9]{1,4})$/i.exec(file.fileName ?? "")?.[1];
  return ext ? ext.toUpperCase() : "FILE";
}

/**
 * The words of a description, update or post: rich text from the editor,
 * or plain text (and Solid AI's) with @mentions, **bold** and links.
 */
export function TaskText({
  body,
  format,
  mentions,
  attachments,
  people,
  className,
}: {
  body: string;
  format: TaskBodyFormat;
  mentions: string[];
  attachments: TaskAttachment[];
  people: TaskPerson[];
  className?: string;
}) {
  const html = useMemo(
    () => (format === "html" ? renderableHtml(body, imageUrls(attachments), { previewable: true }) : ""),
    [attachments, body, format],
  );
  // The same object between renders: React re-sets innerHTML when it changes,
  // which would swap the images (and lose the one focus returns to).
  const inner = useMemo(() => ({ __html: html }), [html]);
  const [preview, setPreview] = useState<PreviewImage | null>(null);
  if (!body) return null;
  if (format === "html")
    return (
      <>
        <div
          className={cn(
            "task-rich break-words text-sm leading-relaxed text-gray-800 [&_img]:cursor-zoom-in",
            className,
          )}
          // An image in the text opens larger (click, Enter or Space), unless
          // it's a link of its own.
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof HTMLImageElement) || target.closest("a")) return;
            event.preventDefault();
            setPreview({ src: target.currentSrc || target.src, name: target.alt || null, from: target });
          }}
          onKeyDown={(event) => {
            const target = event.target;
            if (!(target instanceof HTMLImageElement) || target.closest("a")) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            setPreview({ src: target.currentSrc || target.src, name: target.alt || null, from: target });
          }}
          // Cleaned by the server and again here (renderableHtml).
          dangerouslySetInnerHTML={inner}
        />
        <ImagePreview image={preview} onClose={() => setPreview(null)} />
      </>
    );
  return (
    <p className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800", className)}>
      <MentionText body={body} mentions={mentions} people={people} />
    </p>
  );
}

/** The images a body shows inside its text: not listed again below it. */
export function inlineImages(body: string, format: TaskBodyFormat): Set<string> | undefined {
  return format === "html" ? inlineKeys(body) : undefined;
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
    case "stage":
    case "channel":
    case "publish":
      // Marketing values come as labels ("Waiting approval", "Oct 27, 14:00").
      return value;
    default:
      return `“${value}”`;
  }
}

/** What a field is called in "changed … from … to …". */
const FIELD_NAMES: Partial<Record<TaskActivity["field"], string>> = {
  due: "the due date",
  stage: "the status",
  channel: "the channel",
  publish: "the publish date",
};

function campaignChange(activity: TaskActivity): string {
  if (!activity.to) return `took it out of the “${activity.from ?? ""}” campaign`;
  return `moved it to the “${activity.to}” campaign`;
}

function sprintChange(activity: TaskActivity, automatic: boolean): string {
  if (!activity.to) return `took it out of the ${activity.from ?? ""} sprint, back to the backlog`;
  if (!activity.from) return `added it to the ${activity.to} sprint`;
  return automatic
    ? `carried it over to ${activity.to}: it wasn't done by the end of ${activity.from}`
    : `moved it from the ${activity.from} sprint to ${activity.to}`;
}

/** A field change, shown as one quiet line in the feed. */
function ActivityLine({ update, people }: { update: TaskUpdate; people: TaskPerson[] }) {
  const activity = update.activity;
  if (!activity) return null;
  // Bots and the sprint carry-over have no email: they go by their name.
  const automatic = !update.author.bot && !update.author.email;
  const who =
    update.author.bot || automatic ? authorName(update.author, people) : firstName(update.author.email, people);
  const what =
    activity.field === "sprint"
      ? sprintChange(activity, automatic)
      : activity.field === "created"
      ? "created this task"
      : activity.field === "title"
        ? `renamed it to ${activityValue(activity, activity.to, people)}`
        : activity.field === "board"
          ? activity.to
            ? `moved it to ${activity.to}`
            : `took it off ${activity.from ?? "its board"}`
          : activity.field === "campaign"
            ? campaignChange(activity)
            : activity.field === "publish" && !activity.from
              ? `set it to go out ${activity.to ?? ""}`
              : activity.field === "publish" && !activity.to
                ? "cleared the publish date"
                : `changed ${FIELD_NAMES[activity.field] ?? activity.field} from ${activityValue(
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

/** Everyone, with their faces; a long list scrolls inside the card. */
function PeopleList({
  title,
  emails,
  people,
  focusable = false,
}: {
  title: string;
  emails: string[];
  people: TaskPerson[];
  /** In a popover: the list takes focus, so the keyboard can scroll a long one. */
  focusable?: boolean;
}) {
  return (
    <>
      <p className="mb-1.5 font-medium">{title}</p>
      <ul
        tabIndex={focusable ? 0 : undefined}
        aria-label={focusable ? title : undefined}
        className="max-h-60 space-y-1 overflow-y-auto rounded pr-1 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        {emails.map((email) => (
          <li key={email} className="flex min-w-0 items-center gap-1.5">
            <Avatar email={email} people={people} size={18} />
            <span className="min-w-0 [overflow-wrap:anywhere]">{personName(email, people)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** On hover or keyboard focus: who. Used for reactions and "Seen by". */
function PeopleTooltip({
  title,
  emails,
  people,
  children,
}: {
  title: string;
  emails: string[];
  people: TaskPerson[];
  children: ReactElement;
}) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[min(16rem,calc(100vw-2rem))] px-3 py-2">
        <PeopleList title={title} emails={emails} people={people} />
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * "Seen by N": the names on hover (a tooltip, like reactions), and on tap,
 * click or Enter in a popover, which touch and keyboard can reach. The
 * popover opens only on purpose, so it never takes focus from the composer.
 */
function SeenBy({ emails, people }: { emails: string[]; people: TaskPerson[] }) {
  return (
    <Popover>
      <PeopleTooltip title="Seen by" emails={emails} people={people}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Seen by ${emails.length}: ${emails.map((email) => personName(email, people)).join(", ")}`}
            className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded hover:text-gray-900"
          >
            <Eye className="size-3.5" /> Seen by {emails.length}
          </button>
        </PopoverTrigger>
      </PeopleTooltip>
      <PopoverContent side="top" align="end" className="w-auto max-w-[min(16rem,calc(100vw-2rem))] p-2.5 text-xs text-gray-800">
        <PeopleList title="Seen by" emails={emails} people={people} focusable />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Who reacted, for touch and keyboard: a tap on a reaction changes it, so
 * this small button beside them lists everyone (hover shows it per reaction).
 */
function ReactionPeople({ update, people }: { update: TaskUpdate; people: TaskPerson[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Who reacted"
          title="Who reacted"
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <Users className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto max-w-[min(16rem,calc(100vw-2rem))] space-y-2 p-2.5 text-xs text-gray-800">
        {update.reactions.map((reaction) => (
          <div key={reaction.emoji}>
            <PeopleList title={`Reacted ${reaction.emoji}`} emails={reaction.emails} people={people} focusable />
          </div>
        ))}
      </PopoverContent>
    </Popover>
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
        <PeopleTooltip key={reaction.emoji} title={`Reacted ${reaction.emoji}`} emails={reaction.emails} people={people}>
          <button
            type="button"
            aria-label={`${reaction.emoji} ${reaction.emails.map((email) => personName(email, people)).join(", ")}`}
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
        </PeopleTooltip>
      ))}
      <ReactionPeople update={update} people={people} />
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
              initial={{
                body: update.body,
                format: update.format,
                mentions: update.mentions,
                attachments: update.attachments,
              }}
              allowAttachments={false}
              autoFocus
              minRows={2}
              submitLabel="Save"
              onCancel={() => setEditing(false)}
              onSubmit={async ({ body, format, mentions }) => {
                await api.edit(update.id, { body, format, mentions });
                setEditing(false);
                onChanged();
              }}
            />
          ) : isClaudeLooking(update) ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-gray-500">
              <Loader2 className="size-3.5 animate-spin text-indigo-600" /> Looking into it…
            </p>
          ) : (
            <>
              <TaskText
                className="mt-1"
                body={update.body}
                format={update.format}
                mentions={update.mentions}
                attachments={update.attachments}
                people={people}
              />
              <Attachments attachments={update.attachments} inline={inlineImages(update.body, update.format)} />
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
              {seen.length > 0 && <SeenBy emails={seen} people={people} />}
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
              placeholder="Reply… @ to mention, @Claude to ask AI"
              submitLabel="Reply"
              askClaude
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
