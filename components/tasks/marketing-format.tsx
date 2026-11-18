"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  TASK_CHANNELS,
  TASK_STAGES,
  type TaskCampaign,
  type TaskCampaignColor,
  type TaskChannel,
  type TaskStage,
} from "@/types/tasks";

/** monday's statuses, in the portal's colours. */
export const STAGE_META: Record<TaskStage, { label: string; pill: string; swatch: string }> = {
  coming: { label: "Coming", pill: "bg-gray-100 text-gray-600", swatch: "bg-gray-400" },
  in_progress: { label: "In progress", pill: "bg-amber-50 text-amber-700", swatch: "bg-amber-500" },
  waiting_approval: { label: "Waiting approval", pill: "bg-sky-50 text-sky-700", swatch: "bg-sky-500" },
  approved: { label: "Approved", pill: "bg-indigo-50 text-indigo-700", swatch: "bg-indigo-500" },
  scheduled: { label: "Scheduled", pill: "bg-violet-50 text-violet-700", swatch: "bg-violet-500" },
  pending_launch: { label: "Pending launch", pill: "bg-fuchsia-50 text-fuchsia-700", swatch: "bg-fuchsia-500" },
  posted: { label: "Posted", pill: "bg-green-50 text-green-700", swatch: "bg-green-500" },
  stuck: { label: "Stuck", pill: "bg-red-50 text-red-700", swatch: "bg-red-500" },
};

export const CHANNEL_META: Record<TaskChannel, { label: string; dot: string }> = {
  x_post: { label: "X post", dot: "bg-gray-900" },
  x_thread: { label: "X thread", dot: "bg-gray-900" },
  telegram: { label: "Telegram", dot: "bg-sky-500" },
  email: { label: "Email", dot: "bg-indigo-500" },
  push: { label: "Push", dot: "bg-violet-500" },
  in_app: { label: "In-app", dot: "bg-pink-600" },
  blog: { label: "Blog", dot: "bg-amber-500" },
  support_article: { label: "Support article", dot: "bg-teal-600" },
  video: { label: "Video", dot: "bg-red-500" },
  launch: { label: "Launch", dot: "bg-indigo-600" },
  other: { label: "Other", dot: "bg-gray-400" },
};

export const CAMPAIGN_SWATCH: Record<TaskCampaignColor, string> = {
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  slate: "bg-slate-500",
};

export const BRIEF_LABELS = {
  audience: "Audience",
  objective: "Objective",
  keyMessage: "Key message",
  tone: "Tone",
  format: "Format",
  visual: "Visual",
  cta: "CTA",
} as const;

/** Cancelled overrides the stage: the piece won't go out. */
export function StagePill({ stage, cancelled = false, className }: { stage: TaskStage; cancelled?: boolean; className?: string }) {
  if (cancelled)
    return (
      <span className={cn("inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-gray-100 px-2.5 text-xs font-medium text-gray-500 line-through", className)}>
        Cancelled
      </span>
    );
  const meta = STAGE_META[stage];
  return (
    <span className={cn("inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium", meta.pill, className)}>
      {meta.label}
    </span>
  );
}

export function ChannelChip({ channel, className }: { channel: TaskChannel | null; className?: string }) {
  if (!channel) return <span className="text-gray-300">—</span>;
  const meta = CHANNEL_META[channel];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700", className)}>
      <span className={cn("size-[7px] shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
  muted = false,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100",
        selected && "bg-gray-50 font-medium",
        muted && "text-gray-500",
      )}
    >
      {children}
      {selected && <Check className="ml-auto size-4 shrink-0" />}
    </button>
  );
}

export function StagePicker({
  value,
  onChange,
  onClear,
  children,
}: {
  value: TaskStage | null;
  onChange: (stage: TaskStage) => void;
  /** Set for a filter: an "Any status" option that clears it. */
  onClear?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
        {TASK_STAGES.map((stage) => (
          <OptionButton
            key={stage}
            selected={stage === value}
            onClick={() => {
              onChange(stage);
              setOpen(false);
            }}
          >
            <span className={cn("size-2.5 rounded-full", STAGE_META[stage].swatch)} />
            {STAGE_META[stage].label}
          </OptionButton>
        ))}
        {onClear && (
          <OptionButton
            selected={value === null}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            muted
          >
            Any status
          </OptionButton>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ChannelPicker({
  value,
  onChange,
  noneLabel = "No channel",
  children,
}: {
  value: TaskChannel | null;
  onChange: (channel: TaskChannel | null) => void;
  /** The last option, which sets null ("Any channel" in a filter). */
  noneLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pick = (channel: TaskChannel | null) => {
    onChange(channel);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-52 overflow-y-auto p-1">
        {TASK_CHANNELS.map((channel) => (
          <OptionButton key={channel} selected={channel === value} onClick={() => pick(channel)}>
            <span className={cn("size-2 rounded-full", CHANNEL_META[channel].dot)} />
            {CHANNEL_META[channel].label}
          </OptionButton>
        ))}
        <OptionButton selected={value === null} onClick={() => pick(null)} muted>
          {noneLabel}
        </OptionButton>
      </PopoverContent>
    </Popover>
  );
}

export function CampaignPicker({
  campaigns,
  value,
  onChange,
  children,
}: {
  campaigns: TaskCampaign[];
  value: string | null;
  onChange: (campaignId: string | null) => void;
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
      <PopoverContent align="start" className="max-h-80 w-64 overflow-y-auto p-1">
        {campaigns
          .filter((campaign) => !campaign.archived || campaign.id === value)
          .map((campaign) => (
            <OptionButton key={campaign.id} selected={campaign.id === value} onClick={() => pick(campaign.id)}>
              <span className={cn("size-2.5 shrink-0 rounded-[3px]", CAMPAIGN_SWATCH[campaign.color])} />
              <span className="truncate">{campaign.name}</span>
            </OptionButton>
          ))}
        <OptionButton selected={value === null} onClick={() => pick(null)} muted>
          No campaign
        </OptionButton>
      </PopoverContent>
    </Popover>
  );
}

function toDateOnly(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** A publish day and, optionally, a time (Israel time). */
export function PublishPicker({
  on,
  time,
  onChange,
  children,
}: {
  on: string | null;
  time: string | null;
  onChange: (value: { on: string | null; time: string | null }) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draftTime, setDraftTime] = useState(time ?? "");
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraftTime(time ?? "");
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={on ? fromDateOnly(on) : undefined}
          defaultMonth={on ? fromDateOnly(on) : undefined}
          onSelect={(date) => onChange({ on: date ? toDateOnly(date) : null, time: date ? draftTime || null : null })}
        />
        <div className="flex items-center gap-2 border-t p-2">
          <label htmlFor="publish-time" className="text-xs text-gray-500">
            Time (Israel)
          </label>
          <input
            id="publish-time"
            type="time"
            value={draftTime}
            disabled={!on}
            onChange={(event) => setDraftTime(event.target.value)}
            onBlur={() => on && (draftTime || null) !== time && onChange({ on, time: draftTime || null })}
            className="h-8 rounded-md border border-gray-200 px-2 text-sm disabled:opacity-50"
          />
          {on && (
            <button
              type="button"
              onClick={() => {
                onChange({ on: null, time: null });
                setOpen(false);
              }}
              className="ml-auto cursor-pointer rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
