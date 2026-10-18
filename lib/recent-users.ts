import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";

/**
 * The user profiles an admin opened most recently, newest first.
 *
 * Support works a handful of users at a time — the one in the chat, the one
 * who referred them, the one whose card is in the ticket — and goes back to
 * each several times. Searching for them again every time is most of the
 * friction, so the search opens on this list.
 *
 * Recorded when a profile is opened rather than when a search result is
 * picked, so a user reached from a referral link, the activity feed or a
 * pasted URL is just as easy to get back to.
 *
 * Kept in localStorage, per admin: it is a convenience on this browser, and an
 * admin signing in on a shared machine should not open on someone else's
 * caseload. Nothing here is authoritative — the profile is always re-read.
 */
export interface RecentUser {
  id: string;
  username?: string;
  email?: string;
  /** Issuer of their card, when they had one, e.g. "wirex". */
  cardProvider?: string;
  isDeleted?: boolean;
  /** Epoch ms of the last visit. */
  viewedAt: number;
}

const MAX_RECENT_USERS = 8;
const KEY_PREFIX = "solid-admin.recent-users.v1";
const EMPTY: RecentUser[] = [];

const keyFor = (scope: string) => `${KEY_PREFIX}:${scope}`;

/** Parsed lists by key, so `useSyncExternalStore` sees a stable snapshot. */
const cache = new Map<string, { raw: string | null; users: RecentUser[] }>();
const listeners = new Set<() => void>();

function read(scope: string): RecentUser[] {
  const key = keyFor(scope);
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    // Storage blocked (private mode, policy): the list is simply empty.
  }
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.users;

  let users: RecentUser[] = EMPTY;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        users = parsed
          .filter(
            (entry): entry is RecentUser =>
              !!entry &&
              typeof entry === "object" &&
              typeof (entry as RecentUser).id === "string" &&
              typeof (entry as RecentUser).viewedAt === "number"
          )
          .slice(0, MAX_RECENT_USERS);
      }
    } catch {
      users = EMPTY;
    }
  }
  cache.set(key, { raw, users });
  return users;
}

function write(scope: string, users: RecentUser[]) {
  try {
    window.localStorage.setItem(keyFor(scope), JSON.stringify(users));
  } catch {
    // Quota or blocked storage: losing the history is harmless.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab opening a profile updates this one's list too.
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(KEY_PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The signed-in admin's recent users, plus the calls that change the list. */
export function useRecentUsers() {
  const { user } = useAuth();
  const scope = user?.uid ?? "anonymous";

  const users = useSyncExternalStore(
    subscribe,
    () => read(scope),
    () => EMPTY
  );

  const remember = useCallback(
    (entry: Omit<RecentUser, "viewedAt">) => {
      const rest = read(scope).filter((existing) => existing.id !== entry.id);
      write(
        scope,
        [{ ...entry, viewedAt: Date.now() }, ...rest].slice(0, MAX_RECENT_USERS)
      );
    },
    [scope]
  );

  const forget = useCallback(
    (id: string) =>
      write(
        scope,
        read(scope).filter((existing) => existing.id !== id)
      ),
    [scope]
  );

  const clear = useCallback(() => write(scope, []), [scope]);

  return { users, remember, forget, clear };
}
