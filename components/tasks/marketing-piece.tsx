"use client";

import { useState, type ReactNode } from "react";
import { Check, ExternalLink, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { taskApproval } from "@/lib/tasks-api";
import { formatWhen } from "@/lib/task-format";
import { assetLabel } from "@/lib/task-marketing";
import { Avatar, personName } from "@/components/tasks/task-format";
import { PeoplePicker } from "@/components/tasks/task-pickers";
import { BRIEF_LABELS } from "@/components/tasks/marketing-format";
import {
  TASK_BRIEF_FIELDS,
  type TaskBrief,
  type TaskDetail,
  type TaskMarketingInput,
  type TaskPerson,
  type TaskRow,
} from "@/types/tasks";

/** Hints for an empty brief, from the briefs on monday. */
const BRIEF_HINTS: Record<keyof typeof BRIEF_LABELS, string> = {
  audience: "Who it's for",
  objective: "What it should get them to do",
  keyMessage: "The one thing to remember",
  tone: "How it sounds",
  format: "Thread, 5 posts · single post + 2 replies…",
  visual: "Size, what's on it",
  cta: "What to tap or do next",
};

/** Who signs it off, where it stands, and the buttons to ask or approve. */
export function ApprovalBox({
  task,
  people,
  me,
  onSave,
  onChanged,
}: {
  task: TaskDetail;
  people: TaskPerson[];
  me: string;
  onSave: (input: TaskMarketingInput) => Promise<unknown>;
  onChanged: (task: TaskDetail) => void;
}) {
  const marketing = task.marketing!;
  const [busy, setBusy] = useState<"request" | "approve" | null>(null);
  const approvers = marketing.approvers;
  const waiting = marketing.stage === "waiting_approval";
  const approved = marketing.stage === "approved" && marketing.approvedBy;
  const canApprove = waiting && approvers.includes(me);

  const act = async (action: "request" | "approve") => {
    setBusy(action);
    try {
      onChanged(await taskApproval(task.id, action));
      toast.success(action === "request" ? "Sent for approval" : "Approved");
    } catch {
      // The API layer shows the error.
    } finally {
      setBusy(null);
    }
  };

  const state = approved
    ? `Approved by ${personName(marketing.approvedBy, people)}${marketing.approvedAt ? ` · ${formatWhen(marketing.approvedAt)}` : ""}`
    : waiting
      ? `Waiting${marketing.approvalRequestedAt ? ` since ${formatWhen(marketing.approvalRequestedAt)}` : ""}${
          marketing.approvalRequestedBy ? `, asked by ${personName(marketing.approvalRequestedBy, people)}` : ""
        }`
      : "Not sent yet";

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Approval</h3>
        <span className={cn("text-xs", approved ? "text-green-700" : "text-gray-500")}>{state}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5">
        <PeoplePicker people={people} value={approvers} onChange={(next) => void onSave({ approvers: next })}>
          <button
            type="button"
            className="inline-flex min-h-8 cursor-pointer flex-wrap items-center gap-2 rounded-md px-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            {approvers.length ? (
              approvers.map((email) => (
                <span key={email} className="inline-flex items-center gap-1.5">
                  <Avatar email={email} people={people} size={20} />
                  {personName(email, people)}
                  {approved && marketing.approvedBy === email && <Check className="size-3.5 text-green-600" />}
                </span>
              ))
            ) : (
              <span className="text-gray-400">Add who approves it</span>
            )}
          </button>
        </PeoplePicker>
        <div className="ml-auto flex gap-2">
          {canApprove && (
            <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" disabled={busy !== null} onClick={() => void act("approve")}>
              {busy === "approve" && <Loader2 className="animate-spin" />}
              Approve
            </Button>
          )}
          {!waiting && (
            <Button
              size="sm"
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={!approvers.length || busy !== null}
              onClick={() => void act("request")}
            >
              {busy === "request" && <Loader2 className="animate-spin" />}
              {approved ? "Ask again" : "Send for approval"}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Sending moves it to Waiting approval and emails them. When one approves, it moves to Approved.
      </p>
    </section>
  );
}

/** The brief: monday's template, one field each. */
export function BriefEditor({ brief, onSave }: { brief: TaskBrief; onSave: (brief: TaskBrief | null) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TaskBrief>(brief);
  const [saving, setSaving] = useState(false);
  const filled = TASK_BRIEF_FIELDS.filter((field) => brief[field]);

  const save = async () => {
    setSaving(true);
    try {
      const kept = Object.fromEntries(
        TASK_BRIEF_FIELDS.flatMap((field) => (draft[field]?.trim() ? [[field, draft[field]!.trim()]] : [])),
      ) as TaskBrief;
      await onSave(Object.keys(kept).length ? kept : null);
      setEditing(false);
    } catch {
      // The API layer shows the error; the draft stays.
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Brief</h3>
        {!editing && (
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={() => {
              setDraft(brief);
              setEditing(true);
            }}
          >
            <Pencil /> {filled.length ? "Edit" : "Write a brief"}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          {TASK_BRIEF_FIELDS.map((field) => (
            <label key={field} className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start sm:gap-3">
              <span className="pt-1.5 text-xs text-gray-500">{BRIEF_LABELS[field]}</span>
              <textarea
                rows={field === "audience" || field === "visual" ? 3 : 2}
                value={draft[field] ?? ""}
                maxLength={2000}
                placeholder={BRIEF_HINTS[field]}
                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                className="w-full resize-y rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={saving} onClick={() => void save()}>
              {saving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      ) : filled.length ? (
        <dl className="grid overflow-hidden rounded-lg border border-gray-200 text-sm leading-relaxed sm:grid-cols-[8rem_minmax(0,1fr)]">
          {filled.map((field, index) => (
            <div key={field} className={cn("contents")}>
              <dt className={cn("bg-gray-50 px-3 pt-2 text-xs text-gray-500 sm:py-2.5", index > 0 && "sm:border-t sm:border-gray-100")}>
                {BRIEF_LABELS[field]}
              </dt>
              <dd className={cn("whitespace-pre-wrap break-words px-3 pb-2.5 pt-1 text-gray-800 sm:py-2.5", index > 0 && "sm:border-t sm:border-gray-100")}>
                {brief[field]}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-gray-400">Audience, objective, key message, tone, format, visual and CTA, one field each.</p>
      )}
    </section>
  );
}

/** The asset link: Figma, Typefully, a doc or the published page. */
export function AssetField({ url, onSave }: { url: string | null; onSave: (url: string | null) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(url ?? "");
  const valid = !draft.trim() || /^https?:\/\/\S+$/i.test(draft.trim());
  const host = url ? assetLabel(url) : null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1 truncate text-sm font-medium text-indigo-700 hover:underline"
        >
          <span className="truncate">{host}</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </a>
      )}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setDraft(url ?? "");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={url ? "Change the asset link" : undefined}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            {url ? <Pencil className="size-3.5" /> : "Add a Figma, Typefully or doc link"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-2 p-3">
          <label htmlFor="asset-url" className="text-xs text-gray-500">
            Link to the asset
          </label>
          <input
            id="asset-url"
            value={draft}
            autoFocus
            placeholder="https://www.figma.com/design/…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && valid) {
                void onSave(draft.trim() || null).then(() => setOpen(false));
              }
            }}
            className="h-9 w-full rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          {!valid && <p className="text-xs text-red-600">A link starts with https://</p>}
          <div className="flex justify-end gap-2">
            {url && (
              <Button variant="ghost" size="sm" onClick={() => void onSave(null).then(() => setOpen(false))}>
                Remove
              </Button>
            )}
            <Button
              size="sm"
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={!valid}
              onClick={() => void onSave(draft.trim() || null).then(() => setOpen(false))}
            >
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** The launch a piece is part of: one of the launches (top-level pieces). */
export function LaunchPicker({
  launches,
  value,
  onChange,
  children,
}: {
  launches: TaskRow[];
  value: string | null;
  onChange: (parentId: string | null) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-72 overflow-y-auto p-1">
        {launches.length === 0 && <p className="px-2 py-1.5 text-sm text-gray-500">No launches in this campaign yet.</p>}
        {launches.map((launch) => (
          <button
            key={launch.id}
            type="button"
            onClick={() => pick(launch.id)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100",
              launch.id === value && "bg-gray-50 font-medium",
            )}
          >
            <span className="truncate">{launch.title}</span>
            {launch.id === value && <Check className="ml-auto size-4 shrink-0" />}
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-100"
          >
            Not part of a launch
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
