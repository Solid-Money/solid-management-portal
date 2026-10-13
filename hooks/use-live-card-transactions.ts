"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
import {
  createAdminSocket,
  getLiveStatus,
  isAdminCardTransactionChange,
  isSupportQueueChange,
  setLiveStatus,
  subscribeLiveStatus,
  type LiveStatus,
} from "@/lib/realtime";
import { notifySupportAgent, playSupportChime } from "@/lib/support-alerts";

/** Card views re-read once a burst of changes settles, not once per change. */
const REFRESH_DEBOUNCE_MS = 1_500;

/** The inbox re-reads quickly: an agent is often looking at the thread that changed. */
const SUPPORT_REFRESH_DEBOUNCE_MS = 300;

/**
 * Backoff for a handshake the server refused, which Socket.IO never retries on
 * its own. A dropped connection it does retry, with its own backoff.
 */
const REFUSED_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000];

/**
 * Keep the portal's card views current as Rain and Wirex report transactions,
 * and the support inbox current as conversations change.
 *
 * Mount once, for the signed-in admin (the dashboard layout). Every change
 * re-reads the card-transaction tables on screen — the all-users list and a
 * user page's compact one — and that user's cashback, which settles with the
 * purchase. Only queries something is showing are fetched; the rest are just
 * marked stale for their next mount.
 *
 * Nothing depends on the socket: without it the views refresh on focus and
 * navigation as they always have. Each reconnect re-reads them once, so
 * whatever happened while it was away is not missed.
 */
export function useLiveCardTransactions(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const socket = createAdminSocket();
    if (!socket) return;

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let supportTimer: ReturnType<typeof setTimeout> | undefined;
    const changedConversations = new Set<string>();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempt = 0;
    let tokenRefreshed = false;
    let sessionExpired = false;
    let hasBeenLive = false;
    const changedUsers = new Set<string>();

    const refreshViews = () => {
      refreshTimer = undefined;
      void queryClient.invalidateQueries({ queryKey: ["card-transactions"] });
      for (const userId of changedUsers) {
        void queryClient.invalidateQueries({
          queryKey: ["user-cashback", userId],
        });
      }
      changedUsers.clear();
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refreshViews, REFRESH_DEBOUNCE_MS);
    };

    // The support inbox: the queue, the badge and any open thread that changed.
    const refreshSupport = () => {
      supportTimer = undefined;
      void queryClient.invalidateQueries({ queryKey: ["support", "counts"] });
      void queryClient.invalidateQueries({ queryKey: ["support", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["support", "queue"] });
      for (const id of changedConversations) {
        void queryClient.invalidateQueries({ queryKey: ["support", "conversation", id] });
      }
      changedConversations.clear();
      void queryClient.invalidateQueries({ queryKey: ["support", "user-cases"] });
    };

    const scheduleSupportRefresh = () => {
      if (supportTimer) clearTimeout(supportTimer);
      supportTimer = setTimeout(refreshSupport, SUPPORT_REFRESH_DEBOUNCE_MS);
    };

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
      setLiveStatus("live");
      // Anything that changed while the socket was away.
      if (hasBeenLive) {
        scheduleRefresh();
        void queryClient.invalidateQueries({ queryKey: ["support"] });
      }
      hasBeenLive = true;
    });

    socket.on("support_queue_updated", (change: unknown) => {
      if (!isSupportQueueChange(change)) return;
      changedConversations.add(change.conversationId);
      scheduleSupportRefresh();
      if (change.reason === "handoff" || change.reason === "ai_draft" || change.urgent) {
        playSupportChime();
        notifySupportAgent({
          title: change.urgent ? "Urgent support case" : "A case needs a human",
          body: change.reason === "ai_draft" ? "Solid AI drafted a reply to review." : "Open the inbox to pick it up.",
          conversationId: change.conversationId,
        });
      }
    });

    socket.on("card_transaction", (change: unknown) => {
      if (!isAdminCardTransactionChange(change)) return;
      if (change.userId) changedUsers.add(change.userId);
      scheduleRefresh();
    });

    socket.on("session_expired", () => {
      sessionExpired = true;
    });

    socket.on("disconnect", (reason) => {
      setLiveStatus("offline");
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
      setLiveStatus("offline");
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
            if (!socket.connected && !socket.active) socket.connect();
          });
        return;
      }
      scheduleRetry();
    });

    socket.connect();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (supportTimer) clearTimeout(supportTimer);
      if (retryTimer) clearTimeout(retryTimer);
      socket.removeAllListeners();
      socket.disconnect();
      setLiveStatus("offline");
    };
  }, [enabled, queryClient]);
}

/** Whether card views are updating on their own right now. */
export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(
    subscribeLiveStatus,
    getLiveStatus,
    () => "offline",
  );
}
