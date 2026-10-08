"use client";

import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { auth } from "@/lib/firebase";
import {
  createAdminSocket,
  errorsLiveStatus,
  type ErrorsLiveStatus,
} from "@/lib/realtime";
import { isErrorBurst, isErrorEventRow, isErrorGroupUpdate } from "@/lib/errors";
import type { ErrorBurst, ErrorEventRow, ErrorGroupUpdate } from "@/types/errors";

/**
 * Backoff for a handshake the server refused, which Socket.IO never retries on
 * its own. A dropped connection it does retry, with its own backoff.
 */
const REFUSED_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000];

/** How long to wait for the server to confirm a subscription. */
const SUBSCRIBE_ACK_TIMEOUT_MS = 10_000;

export interface LiveErrorHandlers {
  onEvent: (row: ErrorEventRow) => void;
  onGroupUpdate: (update: ErrorGroupUpdate) => void;
  onBurst: (info: ErrorBurst) => void;
  /** The feed is back after a drop: re-read whatever it missed. */
  onResync?: () => void;
}

/**
 * Stream errors into the Errors page as the backend records them.
 *
 * Mount on that page only, and only while its Live switch is on: unlike the
 * card feed this is a firehose, and nobody else wants it. The connection is
 * the same admins-service socket the card feed uses, joined to the errors
 * room with `errors:subscribe` — which has to be repeated on every session,
 * since rooms do not survive a reconnect.
 *
 * Handlers are read when an event arrives, not when the socket is opened, so
 * they always see the page's current filters without reconnecting.
 */
export function useLiveErrors(
  enabled: boolean,
  handlers: LiveErrorHandlers
): void {
  const onEvent = useEffectEvent((row: ErrorEventRow) => handlers.onEvent(row));
  const onGroupUpdate = useEffectEvent((update: ErrorGroupUpdate) =>
    handlers.onGroupUpdate(update)
  );
  const onBurst = useEffectEvent((info: ErrorBurst) => handlers.onBurst(info));
  const onResync = useEffectEvent(() => handlers.onResync?.());

  useEffect(() => {
    if (!enabled) return;
    const socket = createAdminSocket();
    if (!socket) return;

    const setStatus = errorsLiveStatus.set;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempt = 0;
    let tokenRefreshed = false;
    let sessionExpired = false;
    let hasBeenLive = false;
    let disposed = false;

    // A feed that was live and dropped is coming back; one that never
    // connected is offline.
    const markDown = () => setStatus(hasBeenLive ? "reconnecting" : "offline");

    const scheduleRetry = () => {
      if (retryTimer) clearTimeout(retryTimer);
      const delay =
        REFUSED_RETRY_DELAYS_MS[
          Math.min(retryAttempt, REFUSED_RETRY_DELAYS_MS.length - 1)
        ];
      retryAttempt++;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        if (!socket.connected && !socket.active) socket.connect();
      }, delay);
    };

    socket.on("session", () => {
      retryAttempt = 0;
      tokenRefreshed = false;
      socket
        .timeout(SUBSCRIBE_ACK_TIMEOUT_MS)
        .emit("errors:subscribe", {}, (error: Error | null, response: unknown) => {
          // Hanging up fails the pending ack; the page has moved on by then.
          if (disposed) return;
          const ok =
            !error &&
            !!response &&
            typeof response === "object" &&
            (response as { ok?: unknown }).ok === true;
          if (!ok) {
            // Connected but not in the room: nothing will arrive, so it must
            // not read as live.
            console.warn(
              "[errors] live subscription refused",
              error?.message ?? (response as { error?: string } | null)?.error
            );
            markDown();
            return;
          }
          setStatus("live");
          // Anything recorded while the feed was away.
          if (hasBeenLive) onResync();
          hasBeenLive = true;
        });
    });

    socket.on("error_event", (row: unknown) => {
      if (isErrorEventRow(row)) onEvent(row);
    });

    socket.on("error_group_update", (update: unknown) => {
      if (isErrorGroupUpdate(update)) onGroupUpdate(update);
    });

    socket.on("error_burst", (info: unknown) => {
      if (isErrorBurst(info)) onBurst(info);
    });

    socket.on("session_expired", () => {
      sessionExpired = true;
    });

    socket.on("disconnect", (reason) => {
      markDown();
      if (reason !== "io server disconnect") return;
      // The server let go — the token expired, or it could not take us. The
      // auth callback fetches a fresh ID token on the next attempt.
      if (sessionExpired) {
        sessionExpired = false;
        socket.connect();
        return;
      }
      scheduleRetry();
    });

    socket.on("connect_error", (error: Error) => {
      markDown();
      // A transport failure: Socket.IO is already retrying.
      if (socket.active) return;

      // Refused: once, force a new ID token, in case the cached one is the
      // problem; after that, back off.
      if (error.message === "unauthorized" && !tokenRefreshed) {
        tokenRefreshed = true;
        const user = auth?.currentUser;
        (user ? user.getIdToken(true) : Promise.resolve(""))
          .catch(() => "")
          .then(() => {
            // The page may have turned Live off while the token was minted.
            if (!disposed && !socket.connected && !socket.active) {
              socket.connect();
            }
          });
        return;
      }
      scheduleRetry();
    });

    socket.connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket.removeAllListeners();
      // Leave the room before hanging up, so the server stops fanning out to
      // us at once rather than when it notices the socket is gone.
      if (socket.connected) socket.emit("errors:unsubscribe", {});
      socket.disconnect();
      setStatus("offline");
    };
  }, [enabled]);
}

/** Whether the errors feed is streaming right now. */
export function useErrorsLiveStatus(): ErrorsLiveStatus {
  return useSyncExternalStore(
    errorsLiveStatus.subscribe,
    errorsLiveStatus.get,
    () => "offline"
  );
}

// --- The Live switch, remembered per browser --------------------------------

const LIVE_SWITCH_KEY = "solid.errors.live";

let liveSwitch: boolean | null = null;
const liveSwitchListeners = new Set<() => void>();

/** On unless this browser turned it off; storage that throws counts as unset. */
function readLiveSwitch(): boolean {
  try {
    return window.localStorage.getItem(LIVE_SWITCH_KEY) !== "false";
  } catch {
    return true;
  }
}

function setLiveSwitch(next: boolean): void {
  liveSwitch = next;
  try {
    window.localStorage.setItem(LIVE_SWITCH_KEY, String(next));
  } catch {
    // Storage full or blocked — the switch still works for this visit.
  }
  liveSwitchListeners.forEach((listener) => listener());
}

function subscribeLiveSwitch(listener: () => void): () => void {
  liveSwitchListeners.add(listener);
  return () => {
    liveSwitchListeners.delete(listener);
  };
}

function getLiveSwitch(): boolean {
  if (liveSwitch === null) liveSwitch = readLiveSwitch();
  return liveSwitch;
}

/**
 * The Errors page's Live switch. Read through `useSyncExternalStore` so the
 * server render (no storage there) and hydration agree on the default, on.
 */
export function useErrorsLiveSwitch(): [boolean, (next: boolean) => void] {
  const on = useSyncExternalStore(subscribeLiveSwitch, getLiveSwitch, () => true);
  return [on, setLiveSwitch];
}
