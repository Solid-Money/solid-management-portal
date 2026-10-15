"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CommandPaletteBody from "@/components/command-palette/command-palette";

interface CommandPaletteContextValue {
  /** Open the search, optionally with text already in it. */
  openPalette: (query?: string) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  openPalette: () => {},
});

export const useCommandPalette = () => useContext(CommandPaletteContext);

/** Whether a key press belongs to a field the admin is typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * The dashboard-wide search: users, cards, pages, sections and actions.
 *
 * Opened from the search box in the top bar, the one on the Users page, with
 * ⌘K / Ctrl+K from anywhere, or with "/" when no field has focus.
 */
export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");

  const openPalette = useCallback((query = "") => {
    setInitialQuery(query);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setInitialQuery("");
        setOpen((current) => !current);
        return;
      }
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        setInitialQuery("");
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(() => ({ openPalette }), [openPalette]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          // Pinned near the top rather than centred, so the box does not jump
          // as results come and go below it.
          className="top-[10vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>
              Find a user by name, email, wallet, card ID or Ref, or jump to
              any page, section or action.
            </DialogDescription>
          </DialogHeader>
          {/* Mounted only while open, so every opening starts fresh. */}
          <CommandPaletteBody
            initialQuery={initialQuery}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </CommandPaletteContext.Provider>
  );
}
