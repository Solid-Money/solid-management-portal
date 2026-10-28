import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * A page's tab, kept in the URL (`?tab=card`) rather than in component state.
 *
 * So a search result, a Slack link or a reload lands on the tab the section
 * lives in: a section inside an unselected tab is not in the DOM at all, and
 * there would be nothing to scroll to. The default tab is left out of the URL.
 *
 * Switching uses native `history.replaceState`, which Next keeps
 * `useSearchParams` in step with, so a tab click costs no server round trip
 * and does not stack history entries. Callers need a `Suspense` boundary above
 * them on a statically rendered route, as for any `useSearchParams`.
 */
export function useUrlTab<T extends string>(
  tabs: readonly T[],
  fallback: T,
  param = "tab"
): [T, (next: string) => void] {
  const searchParams = useSearchParams();
  const requested = searchParams.get(param);
  const tab = tabs.find((candidate) => candidate === requested) ?? fallback;

  const setTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(window.location.search);
      if (next === fallback) params.delete(param);
      else params.set(param, next);
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`
      );
    },
    [fallback, param]
  );

  return [tab, setTab];
}
