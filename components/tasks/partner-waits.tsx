"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Handshake,
  Loader2,
  MessageCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TASK_KEYS, useTaskPartners } from "@/hooks/use-tasks";
import { followUpLabel, morningIn, nextMonday, partnerListText } from "@/lib/partner-format";
import { updateEscalation } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import type { TaskPartnerCase, TaskPartnerGroup } from "@/types/tasks";

/** Partners first; our own teams (engineering, other) start folded. */
const FOLDED = new Set(["engineering", "other"]);

function FollowUpPicker({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (at: Date) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pick = (at: Date) => {
    onChange(at);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col gap-1 border-b border-gray-100 p-2">
          {[
            { label: "Tomorrow, 09:00", at: () => morningIn(1) },
            { label: "In 2 days, 09:00", at: () => morningIn(2) },
            { label: "Next Monday, 09:00", at: () => nextMonday() },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => pick(option.at())}
              className="cursor-pointer rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100"
            >
              {option.label}
            </button>
          ))}
        </div>
        <Calendar
          mode="single"
          selected={new Date(value)}
          disabled={{ before: morningIn(0) }}
          onSelect={(date) => {
            if (date) pick(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function RefEditor({ value, onSave }: { value: string | null; onSave: (ref: string | null) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  // The ref when editing began: an unchanged draft is never saved, so a ref
  // someone else set in the meantime (a refresh brought it) is kept.
  const [started, setStarted] = useState<string | null>(value);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    // Enter then blur would save twice.
    if (saving) return;
    const next = draft.trim() || null;
    if (next === started || next === value) return setEditing(false);
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // The error is already shown; keep the editor open to try again.
    } finally {
      setSaving(false);
    }
  };
  if (editing)
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Input
          autoFocus
          value={draft}
          maxLength={200}
          placeholder="Ticket or ref"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
          onBlur={() => void save()}
          className="h-7 w-36 text-xs"
        />
        {saving && <Loader2 className="size-3.5 animate-spin text-gray-400" />}
      </form>
    );
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? "");
        setStarted(value);
        setEditing(true);
      }}
      className={cn(
        "inline-flex max-w-full cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-gray-100",
        value ? "font-mono text-gray-800" : "text-gray-400",
      )}
    >
      <span className="truncate">{value ?? "Add ref"}</span>
      <Pencil className="size-3 shrink-0 opacity-50" />
    </button>
  );
}

function CaseRow({ item, onChanged }: { item: TaskPartnerCase; onChanged: () => void }) {
  const follow = followUpLabel(item.followUpAt);
  const save = async (input: { externalRef?: string | null; followUpAt?: string }) => {
    try {
      await updateEscalation(item.caseId, input);
      onChanged();
    } catch {
      // The API layer shows the error.
      throw new Error("not saved");
    }
  };
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-b border-gray-100 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,9rem)_8.5rem]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={`/support?c=${encodeURIComponent(item.conversationId)}`}
          className="truncate text-sm font-medium text-gray-900 hover:text-indigo-700 hover:underline"
        >
          {item.customer ?? "Customer"}
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.partnerId && (
            <span className="inline-flex min-w-0 items-center gap-0.5 font-mono text-[11px] text-gray-500">
              <span className="max-w-[8rem] truncate" title={item.partnerId}>
                {item.partnerId}
              </span>
              <CopyButton value={item.partnerId} label="Partner id" />
            </span>
          )}
          {item.backInInbox && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
              Back in inbox
            </span>
          )}
          {item.customerWroteSince && (
            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
              <MessageCircle className="size-3" /> Wrote again
            </span>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm text-gray-700" title={item.reason}>
          {item.reason}
        </p>
        {item.task && (
          <Link
            href={`/tasks?task=${encodeURIComponent(item.task.id)}`}
            className="mt-0.5 inline-block font-mono text-[11px] text-indigo-700 hover:underline"
          >
            T-{item.task.number}
          </Link>
        )}
      </div>
      <div className="min-w-0 md:pt-0.5">
        <RefEditor value={item.externalRef} onSave={(externalRef) => save({ externalRef })} />
      </div>
      <div className="md:pt-0.5 md:text-right">
        <FollowUpPicker
          value={item.followUpAt}
          onChange={(at) => {
            void save({ followUpAt: at.toISOString() }).then(
              () => toast.success("Follow-up moved"),
              () => undefined,
            );
          }}
        >
          <button
            type="button"
            title={new Date(item.followUpAt).toLocaleString()}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium hover:bg-gray-100",
              follow.tone === "late" ? "text-red-700" : follow.tone === "soon" ? "text-amber-700" : "text-gray-600",
            )}
          >
            <CalendarClock className="size-3.5" />
            {follow.text}
          </button>
        </FollowUpPicker>
      </div>
    </li>
  );
}

function Group({ group, onChanged }: { group: TaskPartnerGroup; onChanged: () => void }) {
  const [open, setOpen] = useState(!FOLDED.has(group.partner));
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(partnerListText(group));
      toast.success(`List for ${group.label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          {open ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
          <span className="truncate text-sm font-semibold text-gray-900">{group.label}</span>
          <span className="text-xs text-gray-500">{group.cases.length}</span>
          {group.overdue > 0 && (
            <span className="rounded-full bg-red-50 px-1.5 text-[11px] font-semibold text-red-700">
              {group.overdue} overdue
            </span>
          )}
        </button>
        <Button variant="ghost" size="xs" onClick={() => void copyList()}>
          <ClipboardList /> <span className="hidden sm:inline">Copy list</span>
        </Button>
      </div>
      {open && (
        <ul className="border-t border-gray-100">
          {group.cases.map((item) => (
            <CaseRow key={item.caseId} item={item} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Escalated support cases by who they wait on: each partner's customers in
 * one place, with the partner's id for them, our ticket ref and when to check
 * again. "Copy list" gives one message to send the partner about all of them.
 */
export default function PartnerWaits() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, isFetching, refetch } = useTaskPartners(true);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: TASK_KEYS.partners });
  const overdue = data?.groups.reduce((sum, group) => sum + group.overdue, 0) ?? 0;

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-indigo-600" />
      </div>
    );
  // A failed background refresh keeps the list it has (and any open edit).
  if (isError && !data)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
        Couldn&apos;t load escalations.{" "}
        <button type="button" className="cursor-pointer underline" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  // A failed refresh keeps what was loaded, with a warning (empty or not).
  const staleWarning = isError ? (
    <p className="flex flex-wrap items-center gap-x-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Couldn&apos;t refresh: this list may be out of date.
      <button
        type="button"
        disabled={isFetching}
        className="cursor-pointer font-medium underline disabled:opacity-50"
        onClick={() => void refetch()}
      >
        {isFetching ? "Trying…" : "Try again"}
      </button>
    </p>
  ) : null;
  if (!data?.total)
    return (
      <div className="space-y-3">
        {staleWarning}
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 px-4 py-16 text-center text-sm text-gray-500">
          <Handshake className="size-8 text-gray-300" />
          Nothing is waiting on a partner.
        </div>
      </div>
    );
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        {data.total} escalation{data.total === 1 ? "" : "s"} waiting
        {overdue > 0 && <span className="font-medium text-red-700"> · {overdue} past their follow-up</span>}. Past
        their follow-up, cases are back in the inbox too; give one a new date once you&apos;ve chased the partner.
      </p>
      {staleWarning}
      {data.partnersUnavailable && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Couldn&apos;t check which card issuer or KYC provider some customers are with, so they&apos;re under
          &ldquo;unknown&rdquo;. It&apos;s checked again on the next refresh.
        </p>
      )}
      {data.groups.map((group) => (
        <Group key={group.partner} group={group} onChanged={refresh} />
      ))}
    </div>
  );
}
