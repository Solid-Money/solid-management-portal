import { io, type Socket } from "socket.io-client";
import { auth } from "@/lib/firebase";

/** Where admins-service serves the portal's socket (`AdminRealtimeGateway`). */
export const ADMIN_REALTIME_SOCKET_PATH = "/admin/v1/socket.io";

/**
 * What the portal is told when Rain or Wirex reports a card transaction.
 *
 * A notification rather than the row: the tables are built from an aggregate
 * (cashback, fees, the cardholder's username) the write path does not have, so
 * the portal re-reads the page it is showing instead of patching a partial row.
 */
export interface AdminCardTransactionChange {
  transactionId: string;
  /** Null when the issuer's customer id resolves to no user. */
  userId: string | null;
  provider: "rain" | "wirex" | "bridge";
  action: "created" | "updated";
  status: string;
  timestamp: number;
}

export function isAdminCardTransactionChange(
  value: unknown,
): value is AdminCardTransactionChange {
  if (!value || typeof value !== "object") return false;
  const change = value as Record<string, unknown>;
  return (
    typeof change.transactionId === "string" &&
    (change.userId === null || typeof change.userId === "string") &&
    (change.action === "created" || change.action === "updated")
  );
}

/**
 * The socket's origin and path, from the same base URL the API client uses.
 * Socket.IO reads a path in the URL as a namespace, so any path the API is
 * mounted under goes on the Engine.IO path instead.
 */
export function getAdminRealtimeEndpoint(
  baseUrl: string = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ||
    "http://localhost:5009",
): { url: string; path: string } | null {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    const basePath = parsed.pathname.replace(/\/+$/, "");
    return {
      url: parsed.origin,
      path: `${basePath}${ADMIN_REALTIME_SOCKET_PATH}`,
    };
  } catch {
    return null;
  }
}

/**
 * An unconnected socket to admins-service, authenticated as the REST API is:
 * the signed-in admin's Firebase ID token, fetched fresh on every attempt (the
 * SDK hands back a cached one until it is close to expiring).
 *
 * WebSocket only — the server serves no long-polling transport.
 */
export function createAdminSocket(): Socket | null {
  const endpoint = getAdminRealtimeEndpoint();
  if (!endpoint) return null;

  return io(endpoint.url, {
    path: endpoint.path,
    transports: ["websocket"],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
    timeout: 20_000,
    auth: (callback) => {
      const user = auth?.currentUser;
      if (!user) {
        callback({});
        return;
      }
      user.getIdToken().then(
        (token) => callback({ token }),
        () => callback({}),
      );
    },
  });
}

// --- Live status, for the badges --------------------------------------------

/**
 * Whether one live feed is connected, readable with `useSyncExternalStore`.
 *
 * One store per feed rather than one for the portal: the card feed listens for
 * as long as an admin is signed in and the errors feed only while its page is
 * open with Live on, so a single shared status would have each one report the
 * other's connection.
 */
export interface LiveStatusStore<S extends string> {
  get: () => S;
  set: (next: S) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createLiveStatusStore<S extends string>(
  initial: S,
): LiveStatusStore<S> {
  let status = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => status,
    set: (next) => {
      if (next === status) return;
      status = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type LiveStatus = "live" | "offline";

/** The card-transaction feed, which `<LiveBadge/>` reports. */
const cardLiveStatus = createLiveStatusStore<LiveStatus>("offline");

export const setLiveStatus = cardLiveStatus.set;
export const getLiveStatus = cardLiveStatus.get;
export const subscribeLiveStatus = cardLiveStatus.subscribe;

/**
 * The errors feed. "reconnecting" is a feed that was live and dropped, which
 * Socket.IO is bringing back; "offline" is one that never connected.
 */
export type ErrorsLiveStatus = "live" | "reconnecting" | "offline";

export const errorsLiveStatus =
  createLiveStatusStore<ErrorsLiveStatus>("offline");
