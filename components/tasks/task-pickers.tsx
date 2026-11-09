"use client";

import { useState, type ReactNode } from "react";
import { Check, Inbox, LayoutGrid, Timer, UserX } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Avatar,
  OPEN_STATUS_ORDER,
  PRIORITY_META,
  STATUS_META,
  personName,
} from "@/components/tasks/task-format";
import { shiftSprint, sprintLabel, sprintStart } from "@/lib/task-format";
import {
  TASK_PRIORITIES,
  type TaskBoard,
  type TaskPerson,
  type TaskPriority,
  type TaskStatus,
} from "@/types/tasks";

/** Pick one admin (or nobody). */
export function PersonPicker({
  people,
  value,
  onChange,
  allowNone = true,
  children,
  align = "start",
}: {
  people: TaskPerson[];
  value: string | null;
  onChange: (email: string | null) => void;
  allowNone?: boolean;
  children: ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Find someone…" />
          <CommandList>
            <CommandEmpty>No admin by that name.</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="nobody unassigned"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <UserX className="text-gray-400" />
                  Nobody
                  {value === null && <Check className="ml-auto" />}
                </CommandItem>
              )}
              {people.map((person) => (
                <CommandItem
                  key={person.email}
                  value={`${personName(person.email, people)} ${person.email}`}
                  onSelect={() => {
                    onChange(person.email);
                    setOpen(false);
                  }}
                >
                  <Avatar email={person.email} people={people} size={20} />
                  <span className="truncate">{personName(person.email, people)}</span>
                  {value === person.email && <Check className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Pick several admins (helpers). */
export function PeoplePicker({
  people,
  value,
  onChange,
  children,
}: {
  people: TaskPerson[];
  value: string[];
  onChange: (emails: string[]) => void;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Find someone…" />
          <CommandList>
            <CommandEmpty>No admin by that name.</CommandEmpty>
            <CommandGroup>
              {people.map((person) => {
                const on = value.includes(person.email);
                return (
                  <CommandItem
                    key={person.email}
                    value={`${personName(person.email, people)} ${person.email}`}
                    onSelect={() =>
                      onChange(on ? value.filter((e) => e !== person.email) : [...value, person.email])
                    }
                  >
                    <Avatar email={person.email} people={people} size={20} />
                    <span className="truncate">{personName(person.email, people)}</span>
                    {on && <Check className="ml-auto" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function StatusPicker({
  value,
  onChange,
  children,
}: {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const options: TaskStatus[] = [...OPEN_STATUS_ORDER, "done", "cancelled"];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        {options.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              onChange(status);
              setOpen(false);
            }}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100",
              status === value && "bg-gray-50 font-medium",
            )}
          >
            <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[status].swatch)} />
            {STATUS_META[status].label}
            {status === value && <Check className="ml-auto size-4" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Put a task on a board, or on none. */
export function BoardPicker({
  boards,
  value,
  onChange,
  children,
}: {
  boards: TaskBoard[];
  value: string | null;
  onChange: (board: string | null) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const options: Array<{ key: string | null; name: string }> = [
    ...boards.map((board) => ({ key: board.key, name: board.name })),
    { key: null, name: "No board" },
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-52 overflow-y-auto p-1">
        {options.map((option) => (
          <button
            key={option.key ?? "none"}
            type="button"
            onClick={() => {
              onChange(option.key);
              setOpen(false);
            }}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100",
              option.key === value && "bg-gray-50 font-medium",
              option.key === null && "text-gray-500",
            )}
          >
            <LayoutGrid className="size-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{option.name}</span>
            {option.key === value && <Check className="ml-auto size-4 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Pick a sprint: this week's, the next two, or the backlog. A task already
 * planned further out keeps its sprint in the list.
 */
export function SprintPicker({
  value,
  onChange,
  children,
}: {
  /** The sprint's Monday, or null for the backlog. */
  value: string | null;
  onChange: (sprint: string | null) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const current = sprintStart();
  const starts = [current, shiftSprint(current, 1), shiftSprint(current, 2)];
  if (value && value > current && !starts.includes(value)) starts.push(value);
  const names = ["This sprint", "Next sprint", "In two weeks"];
  const options: Array<{ key: string | null; name: string; hint: string | null }> = [
    ...starts.map((start, index) => ({
      key: start,
      name: names[index] ?? "Later",
      hint: sprintLabel(start),
    })),
    { key: null, name: "Backlog", hint: "no sprint" },
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1">
        {options.map((option) => (
          <button
            key={option.key ?? "backlog"}
            type="button"
            onClick={() => {
              onChange(option.key);
              setOpen(false);
            }}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100",
              option.key === value && "bg-gray-50 font-medium",
            )}
          >
            {option.key ? (
              <Timer className="size-3.5 shrink-0 text-gray-400" />
            ) : (
              <Inbox className="size-3.5 shrink-0 text-gray-400" />
            )}
            <span className="truncate">{option.name}</span>
            {option.hint && <span className="text-xs text-gray-400">{option.hint}</span>}
            {option.key === value && <Check className="ml-auto size-4 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function PriorityPicker({
  value,
  onChange,
  children,
}: {
  value: TaskPriority | null;
  onChange: (priority: TaskPriority | null) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {[...TASK_PRIORITIES, null].map((priority) => (
          <button
            key={priority ?? "none"}
            type="button"
            onClick={() => {
              onChange(priority);
              setOpen(false);
            }}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100",
              priority === value && "bg-gray-50 font-medium",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                priority ? PRIORITY_META[priority].dot : "border border-gray-300",
              )}
            />
            {priority ? PRIORITY_META[priority].label : "No priority"}
            {priority === value && <Check className="ml-auto size-4" />}
          </button>
        ))}
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

export function DuePicker({
  value,
  onChange,
  children,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value ? fromDateOnly(value) : undefined}
          defaultMonth={value ? fromDateOnly(value) : undefined}
          onSelect={(date) => {
            onChange(date ? toDateOnly(date) : null);
            setOpen(false);
          }}
        />
        {value && (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100"
            >
              Clear due date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
