"use client";

import { useCallback, useMemo, useReducer } from "react";
import type { ErrorBurst, ErrorEventRow } from "@/types/errors";

/** Rows the live feed keeps; past this the oldest are let go. */
export const MAX_LIVE_ROWS = 500;

/** How long a new row stays highlighted. */
const FRESH_MS = 2_500;

/**
 * What the socket has added to the feed since it was last read.
 *
 * Kept per set of filters (`key`): the server re-reads the feed when they
 * change, and rows collected under the old ones would not belong in it.
 */
export interface LiveFeedState {
  key: string;
  /** Inserted at the top of the feed, newest first. */
  rows: ErrorEventRow[];
  /** Arrived while the reader was scrolled down, held behind the "new" bar. */
  pending: ErrorEventRow[];
  /** Rows highlighted so a new one is noticed, with when each went in. */
  fresh: ReadonlyMap<string, number>;
  /** The latest rate-limit summary: errors the server did not send. */
  burst: ErrorBurst | null;
}

type LiveFeedAction =
  | {
      type: "event";
      key: string;
      row: ErrorEventRow;
      insert: boolean;
      at: number;
    }
  | { type: "show-pending"; key: string; at: number }
  | { type: "burst"; key: string; info: ErrorBurst }
  | { type: "refreshed"; key: string }
  | { type: "settle"; at: number };

const NONE_FRESH: ReadonlyMap<string, number> = new Map();

const emptyFeed = (key: string): LiveFeedState => ({
  key,
  rows: [],
  pending: [],
  fresh: NONE_FRESH,
  burst: null,
});

/** Move `incoming` and everything pending onto the feed, highlighted. */
function release(
  state: LiveFeedState,
  incoming: ErrorEventRow[],
  at: number
): LiveFeedState {
  const added = [...incoming, ...state.pending];
  const fresh = new Map(state.fresh);
  added.forEach((row) => fresh.set(row.id, at));
  return {
    ...state,
    rows: [...added, ...state.rows].slice(0, MAX_LIVE_ROWS),
    pending: [],
    fresh,
  };
}

function reducer(state: LiveFeedState, action: LiveFeedAction): LiveFeedState {
  if (action.type === "settle") {
    // Every highlight that has had its time, however many timers fired.
    const fresh = new Map(
      [...state.fresh].filter(([, at]) => action.at - at < FRESH_MS)
    );
    return fresh.size === state.fresh.size ? state : { ...state, fresh };
  }

  const current = action.key === state.key ? state : emptyFeed(action.key);

  switch (action.type) {
    case "event": {
      const { row } = action;
      // The same error can reach us twice across a reconnect.
      if (
        current.rows.some((existing) => existing.id === row.id) ||
        current.pending.some((existing) => existing.id === row.id)
      ) {
        return current;
      }
      return action.insert
        ? // Back at the top: anything held back goes in with it, so the
          // feed never shows a new row above an older one still hidden.
          release(current, [row], action.at)
        : {
            ...current,
            pending: [row, ...current.pending].slice(0, MAX_LIVE_ROWS),
          };
    }
    case "show-pending":
      return release(current, [], action.at);
    case "burst":
      return { ...current, burst: action.info };
    case "refreshed":
      // The re-read brings in what was held back and what was rate-limited.
      return { ...current, pending: [], burst: null };
  }
}

/**
 * The live feed's state for the filters in `key`. Dispatches are stamped with
 * it, so an event that lands just as the filters change starts the new feed
 * rather than polluting it with a row from the old one.
 */
export function useLiveFeedState(key: string) {
  const [state, dispatch] = useReducer(reducer, key, emptyFeed);
  const empty = useMemo(() => emptyFeed(key), [key]);
  const live = state.key === key ? state : empty;

  /** Let highlights fade once they have been on screen long enough. */
  const settleLater = useCallback(() => {
    setTimeout(() => dispatch({ type: "settle", at: Date.now() }), FRESH_MS);
  }, []);

  const addEvent = useCallback(
    (row: ErrorEventRow, insert: boolean) => {
      dispatch({ type: "event", key, row, insert, at: Date.now() });
      if (insert) settleLater();
    },
    [key, settleLater]
  );

  const showPending = useCallback(() => {
    dispatch({ type: "show-pending", key, at: Date.now() });
    settleLater();
  }, [key, settleLater]);

  const setBurst = useCallback(
    (info: ErrorBurst) => dispatch({ type: "burst", key, info }),
    [key]
  );

  const markRefreshed = useCallback(
    () => dispatch({ type: "refreshed", key }),
    [key]
  );

  return { live, addEvent, showPending, setBurst, markRefreshed };
}

/**
 * The feed as shown: live rows and the server's pages, once each, newest
 * first. A row the socket delivered and a re-read then returned is the same
 * row, so the live copy (already on screen) wins.
 */
export function mergeFeedRows(
  liveRows: ErrorEventRow[],
  serverRows: ErrorEventRow[]
): ErrorEventRow[] {
  const seen = new Set<string>();
  const merged: ErrorEventRow[] = [];
  for (const row of [...liveRows, ...serverRows]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
}
