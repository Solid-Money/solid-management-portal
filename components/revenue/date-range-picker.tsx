"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onRangeChange: (start: Date, end: Date) => void;
  className?: string;
}

const presets = [
  {
    label: "Last 7 days",
    value: "7d",
    getRange: () => ({
      from: subDays(new Date(), 7),
      to: new Date(),
    }),
  },
  {
    label: "Last 30 days",
    value: "30d",
    getRange: () => ({
      from: subDays(new Date(), 30),
      to: new Date(),
    }),
  },
  {
    label: "Last 90 days",
    value: "90d",
    getRange: () => ({
      from: subDays(new Date(), 90),
      to: new Date(),
    }),
  },
  {
    label: "This month",
    value: "mtd",
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: new Date(),
    }),
  },
  {
    label: "Last month",
    value: "last_month",
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    label: "Year to date",
    value: "ytd",
    getRange: () => ({
      from: new Date(new Date().getFullYear(), 0, 1),
      to: new Date(),
    }),
  },
];

export function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  className,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: startDate,
    to: endDate,
  });
  const [open, setOpen] = React.useState(false);

  // Sync internal state with props
  React.useEffect(() => {
    setDate({ from: startDate, to: endDate });
  }, [startDate, endDate]);

  const handleSelect = (range: DateRange | undefined) => {
    setDate(range);
    if (range?.from && range?.to) {
      onRangeChange(range.from, range.to);
    }
  };

  const handlePresetClick = (preset: (typeof presets)[0]) => {
    const range = preset.getRange();
    setDate(range);
    onRangeChange(range.from, range.to);
    setOpen(false);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets sidebar */}
            <div className="border-r p-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                Quick select
              </p>
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {/* Calendar */}
            <div className="p-2">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={handleSelect}
                numberOfMonths={2}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DateRangePicker;
