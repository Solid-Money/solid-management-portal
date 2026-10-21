"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared clock that ticks once a minute.
 *
 * "How old is this" means reading the clock — an external mutable source, not
 * a pure input. `useSyncExternalStore` is the sanctioned way to read one: the
 * snapshot is stable between ticks (so renders are idempotent), the server
 * snapshot is null (so nothing is rendered against the build machine's clock),
 * and one interval is shared by every reader on the page rather than one each.
 */
const clock = (() => {
  let tick = Date.now();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      // A clock nobody read for a while is stale on its first new reader.
      if (!timer) tick = Date.now();
      timer ??= setInterval(() => {
        tick = Date.now();
        for (const notify of listeners) notify();
      }, 60_000);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    getSnapshot: () => tick,
    /** No clock on the server: anything relative resolves after hydration. */
    getServerSnapshot: () => null,
  };
})();

/** Now, to the minute; null until hydrated. */
export function useMinuteClock(): number | null {
  return useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot
  );
}
