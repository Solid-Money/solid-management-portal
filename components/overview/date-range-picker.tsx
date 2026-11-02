"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { ArrowRight, CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  OVERVIEW_PRESETS,
  matchPreset,
  presetLabel,
  presetRange,
  rangeDays,
  rangeError,
  spanLabel,
  type OverviewPreset,
  type OverviewRangeState,
} from "@/lib/overview-range";

/**
 * The page's one range control. Presets on the left, two months, the two days
 * as fields, and "Compare with previous period". Nothing applies until Apply,
 * so a half-picked range never reloads the page.
 *
 * The calendar works in the browser's local dates; a picked cell is read as
 * that calendar day and used as a UTC day, which is what the page means.
 */
export function OverviewDateRangePicker({
  value,
  today,
  onApply,
}: {
  value: OverviewRangeState;
  today: string;
  onApply: (next: OverviewRangeState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OverviewRangeState>(value);

  const openWith = (next: boolean) => {
    if (next) setDraft(value);
    setOpen(next);
  };

  const error =
    draft.from && draft.to ? rangeError(draft.from, draft.to, today) : "Pick the end day";
  const days = draft.from && draft.to ? rangeDays(draft.from, draft.to) : 0;

  const pickPreset = (preset: OverviewPreset) => {
    if (preset === "custom") {
      setDraft({ ...draft, preset });
      return;
    }
    setDraft({ ...draft, ...presetRange(preset, today), preset });
  };

  const pickDays = (range: DateRange | undefined) => {
    const from = range?.from ? toDay(range.from) : "";
    const to = range?.to ? toDay(range.to) : "";
    setDraft({
      ...draft,
      from,
      to,
      preset: from && to ? matchPreset(from, to, today) : "custom",
    });
  };

  const typeDay = (field: "from" | "to", day: string) => {
    const next = { ...draft, [field]: day };
    setDraft({
      ...next,
      preset: next.from && next.to ? matchPreset(next.from, next.to, today) : "custom",
    });
  };

  return (
    <Popover open={open} onOpenChange={openWith}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-[7px] rounded-lg border border-[#e6e8ee] bg-white px-2.5 py-1.5 text-[12.5px] whitespace-nowrap hover:border-gray-300"
        >
          <CalendarDays className="size-[15px] text-gray-500" />
          <span className="font-semibold text-gray-900">
            {value.preset === "custom" ? "Custom" : presetLabel(value.preset)}
          </span>
          <span className="hidden text-gray-600 sm:inline">· {spanLabel(value.from, value.to, today)}</span>
          <ChevronDown className="size-3.5 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[calc(100vw-32px)] p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-row flex-wrap gap-1 border-b border-[#eef0f4] p-3 sm:w-[150px] sm:flex-col sm:border-r sm:border-b-0">
            {OVERVIEW_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => pickPreset(preset.id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-left text-[13px]",
                  draft.preset === preset.id
                    ? "bg-[#eef0fd] font-semibold text-[#3b3bd6]"
                    : "text-gray-700 hover:bg-gray-50",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* The calendar's selection in the page accent rather than black. */}
          <div className="p-3 [--accent:#eef0fd] [--accent-foreground:#3b3bd6] [--primary:#3b3bd6] [--primary-foreground:#ffffff]">
            <Calendar
              mode="range"
              numberOfMonths={2}
              weekStartsOn={1}
              defaultMonth={fromDay(addMonths(draft.to || today, -1))}
              selected={{
                from: draft.from ? fromDay(draft.from) : undefined,
                to: draft.to ? fromDay(draft.to) : undefined,
              }}
              onSelect={pickDays}
              disabled={{ after: fromDay(today) }}
              showOutsideDays={false}
              className="p-0"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="Start day"
                value={draft.from}
                max={today}
                onChange={(e) => typeDay("from", e.target.value)}
                className="rounded-md border border-[#e6e8ee] px-2.5 py-1.5 text-[13px]"
              />
              <ArrowRight className="size-4 text-gray-400" />
              <input
                type="date"
                aria-label="End day"
                value={draft.to}
                max={today}
                onChange={(e) => typeDay("to", e.target.value)}
                className="rounded-md border border-[#e6e8ee] px-2.5 py-1.5 text-[13px]"
              />
              <label className="ml-auto inline-flex items-center gap-2 text-[13px] text-gray-700">
                <Checkbox
                  checked={draft.compare}
                  onCheckedChange={(checked) => setDraft({ ...draft, compare: checked === true })}
                />
                Compare with previous {days > 1 ? `${days} days` : "day"}
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#eef0f4] pt-3">
              <span className={cn("text-[12px]", error ? "text-[#b91c1c]" : "text-gray-400")}>
                {error ?? "Applies to the whole page · days in UTC"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-[#e6e8ee] px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={error !== null}
                  onClick={() => {
                    onApply(draft);
                    setOpen(false);
                  }}
                  className="rounded-md bg-[#3b3bd6] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A local calendar cell as the day it shows. */
function toDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** A day as a local date, so the calendar highlights that cell. */
function fromDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addMonths(day: string, months: number): string {
  const [y, m] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  return date.toISOString().slice(0, 10);
}
