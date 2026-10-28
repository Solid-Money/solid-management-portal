"use client";

import { useSyncExternalStore } from "react";
import { Search, X } from "lucide-react";

import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import { cn } from "@/lib/utils";

const subscribeNever = () => () => {};

/** "⌘K" on a Mac, "Ctrl K" elsewhere; nothing until the client knows which. */
function useShortcutLabel(): string | null {
  return useSyncExternalStore(
    subscribeNever,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => null
  );
}

/** The search box in the top bar. Looks like a field; opens the search. */
export function NavSearchTrigger() {
  const { openPalette } = useCommandPalette();
  const shortcut = useShortcutLabel();

  return (
    <>
      <button
        type="button"
        onClick={() => openPalette()}
        aria-label="Search users, card IDs, pages and settings"
        className="hidden h-9 w-64 cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-400 shadow-xs transition-colors hover:border-gray-300 hover:bg-gray-50 lg:flex xl:w-80"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          Search users, cards, pages…
        </span>
        {shortcut && (
          <kbd className="rounded border bg-gray-50 px-1.5 font-sans text-[10px] font-medium text-gray-500">
            {shortcut}
          </kbd>
        )}
      </button>
      <button
        type="button"
        onClick={() => openPalette()}
        aria-label="Search"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-xs hover:bg-gray-50 lg:hidden"
      >
        <Search className="h-4 w-4" />
      </button>
    </>
  );
}

/**
 * The Users page's search box. Shows the search the table is filtered by and
 * opens the search with it, so refining it gets live results — matched card
 * ids included — before committing to the table.
 */
export function UsersSearchTrigger({
  search,
  onClear,
  className,
}: {
  search: string;
  onClear: () => void;
  className?: string;
}) {
  const { openPalette } = useCommandPalette();
  const shortcut = useShortcutLabel();

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <button
        type="button"
        onClick={() => openPalette(search)}
        className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white pr-9 pl-3 text-left text-sm shadow-xs transition-colors hover:border-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      >
        <Search className="h-5 w-5 shrink-0 text-gray-400" />
        {search ? (
          <span className="flex-1 truncate text-gray-900">{search}</span>
        ) : (
          <span className="flex-1 truncate text-gray-500">
            Username, email, wallet, Safe, referral code or card ID…
          </span>
        )}
        {!search && shortcut && (
          <kbd className="rounded border bg-gray-50 px-1.5 font-sans text-[10px] font-medium text-gray-500">
            {shortcut}
          </kbd>
        )}
      </button>
      {search && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          title="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
