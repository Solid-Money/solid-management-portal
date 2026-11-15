"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskBoards, useTaskPeople, useTaskSearch } from "@/hooks/use-tasks";
import { searchWords, splitMatches } from "@/lib/task-format";
import {
  Avatar,
  AuthorAvatar,
  LastUpdateLine,
  StatusPill,
  authorName,
  formatAgo,
} from "@/components/tasks/task-format";
import type { TaskPerson, TaskSearchMatch, TaskSearchResult } from "@/types/tasks";

const FIELD_LABELS: Partial<Record<TaskSearchMatch["field"], string>> = {
  description: "Description",
  checklist: "Checklist",
  label: "Label",
  brief: "Brief",
  person: "People",
  link: "Link",
};

function Marked({ text, words }: { text: string; words: string[] }) {
  return (
    <>
      {splitMatches(text, words).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-sm bg-amber-100 px-0.5 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Why a task came up: where the words were, or (for a title match) its last update. */
function MatchLine({ result, words, people }: { result: TaskSearchResult; words: string[]; people: TaskPerson[] }) {
  const { match, task } = result;
  if (match.field === "title" || match.field === "number" || !match.text)
    return <LastUpdateLine update={task.lastUpdate} people={people} />;
  let lead: ReactNode;
  if (match.field === "update" && match.author) {
    lead = (
      <>
        <AuthorAvatar author={match.author} people={people} size={16} />
        <span className="shrink-0 font-medium text-gray-700">
          {authorName(match.author, people).split(" ")[0]}
          {match.at && <span className="font-normal text-gray-400"> · {formatAgo(match.at)}</span>}
        </span>
      </>
    );
  } else {
    lead = <span className="shrink-0 font-medium text-gray-700">{FIELD_LABELS[match.field] ?? "Match"}</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
      {lead}
      <span className="min-w-0 truncate">
        <Marked text={match.text} words={words} />
      </span>
    </span>
  );
}

/**
 * One search for every task: every board, open and closed. It looks in
 * titles, descriptions, updates, checklists, labels, briefs and the people
 * on a task. ⌘K (or Ctrl+K, or /) jumps to it; arrows and Enter pick a
 * result, which opens the task.
 */
export default function TaskSearch({ onOpen, className }: { onOpen: (id: string) => void; className?: string }) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const { data: people = [] } = useTaskPeople();
  const { data: boardList } = useTaskBoards();
  const boardNames = useMemo(
    () => new Map((boardList?.boards ?? []).map((board) => [board.key, board.name])),
    [boardList],
  );

  // Ask once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [text]);
  const searching = query.length >= 2 || /^\d+$/.test(query);
  const { data, isFetching, isError } = useTaskSearch(query);
  const fresh = data && data.q === query ? data : undefined;
  const results = searching ? (data?.results ?? []) : [];
  const words = useMemo(() => searchWords(data?.q ?? query), [data?.q, query]);

  // ⌘K, Ctrl+K, or / (when not typing elsewhere) to search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A click anywhere else closes the results.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (result: TaskSearchResult | undefined) => {
    if (!result) return;
    onOpen(result.task.id);
    setOpen(false);
    input.current?.blur();
  };

  const showPanel = open && searching;
  const current = Math.min(active, Math.max(results.length - 1, 0));

  return (
    <div ref={box} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
      <input
        ref={input}
        value={text}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && results.length ? `${listId}-${current}` : undefined}
        aria-label="Search all tasks"
        placeholder="Search all tasks"
        onChange={(event) => {
          setText(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive(results.length ? (current + 1) % results.length : 0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(results.length ? (current - 1 + results.length) % results.length : 0);
          } else if (event.key === "Enter") {
            event.preventDefault();
            pick(results[current]);
          } else if (event.key === "Escape") {
            if (text && !showPanel) setText("");
            setOpen(false);
          }
        }}
        className="h-9 w-full rounded-md border border-gray-200 bg-white pl-8 pr-16 text-sm outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
      <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {searching && isFetching && <Loader2 className="size-3.5 animate-spin text-gray-400" />}
        {text ? (
          <button
            type="button"
            aria-label="Clear the search"
            onClick={() => {
              setText("");
              setQuery("");
              input.current?.focus();
            }}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="hidden rounded border border-gray-200 px-1 font-sans text-[10px] text-gray-400 sm:inline">⌘K</kbd>
        )}
      </span>

      {showPanel && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {isError && !fresh ? (
            <p className="px-4 py-6 text-center text-sm text-red-700">The search didn&apos;t work. Try again in a moment.</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              {fresh ? <>Nothing matches &ldquo;{query}&rdquo;.</> : "Searching…"}
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Tasks found" className="max-h-[min(70vh,34rem)] overflow-y-auto py-1">
              {results.map((result, index) => {
                const { task } = result;
                const closed = task.status === "done" || task.status === "cancelled";
                const board = task.board ? (boardNames.get(task.board) ?? null) : null;
                return (
                  <li
                    key={task.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === current}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(result)}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 px-3 py-2",
                      index === current ? "bg-indigo-50/70" : "hover:bg-gray-50",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("min-w-0 truncate text-sm", closed ? "text-gray-500" : "text-gray-900")}>
                        <Marked text={task.title} words={words} />
                      </span>
                      {board && (
                        <span className="shrink-0 rounded border border-gray-200 px-1.5 py-px text-[11px] text-gray-500">
                          {board}
                        </span>
                      )}
                      <span className="ml-auto flex shrink-0 items-center gap-2">
                        <StatusPill status={task.status} className="h-5 px-2 text-[11px]" />
                        {task.ownerEmail ? (
                          <Avatar email={task.ownerEmail} people={people} size={18} />
                        ) : (
                          <span className="size-[18px]" />
                        )}
                      </span>
                    </span>
                    <MatchLine result={result} words={words} people={people} />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-gray-100 bg-gray-50/70 px-3 py-1.5 text-[11px] text-gray-500">
            {fresh?.hasMore ? "The best 30. Add a word to narrow it. " : ""}
            Every board, open and closed: titles, descriptions, updates, checklists, labels and people. &ldquo;Quotes&rdquo;
            for a phrase.
          </p>
        </div>
      )}
    </div>
  );
}
