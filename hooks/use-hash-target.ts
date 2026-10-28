import { useSyncExternalStore } from "react";

/**
 * Bumped on every hash change, so picking the same section twice still
 * registers: the hash itself is unchanged the second time.
 */
let version = 0;
const listeners = new Set<() => void>();
let installed = false;

function subscribe(listener: () => void) {
  if (!installed) {
    installed = true;
    const bump = () => {
      version += 1;
      listeners.forEach((notify) => notify());
    };
    window.addEventListener("hashchange", bump);
    window.addEventListener("popstate", bump);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => `${version}${window.location.hash}`;

/**
 * A token that changes each time the URL hash points at `id`, and null while
 * it points elsewhere.
 *
 * For sections that hide their content until asked — a collapsed config
 * card — so a search result linking to one can open it. Compare the token with
 * the last one acted on rather than testing it for truthiness: the token
 * changes when the same section is picked again after the reader collapsed it.
 */
export function useHashTarget(id: string | undefined): string | null {
  const current = useSyncExternalStore(subscribe, snapshot, () => "");
  if (!id) return null;
  return current.endsWith(`#${id}`) ? current : null;
}
