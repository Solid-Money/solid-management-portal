/**
 * Claude artifacts embedded in the admin dashboard.
 *
 * An "artifact" is a page published from Claude (claude.ai) — a dashboard,
 * report, calculator or similar — that the team wants visible inside the
 * admin portal instead of in a separate browser tab.
 *
 * The list is stored in localStorage for now: the portal's backend has no
 * endpoint for it yet, and per-browser persistence is enough for a v1 where
 * each admin curates their own set. Moving it to solid-backend later only
 * means swapping loadArtifacts/saveArtifacts for API calls.
 */

export interface EmbeddedArtifact {
  id: string;
  title: string;
  url: string;
  /** ISO timestamp, shown so stale embeds are easy to spot. */
  addedAt: string;
}

const STORAGE_KEY = "solid-admin-claude-artifacts";

/**
 * Hosts an embed is allowed to point at. Restricting to Claude's own domains
 * keeps this page from becoming a way to iframe arbitrary sites into an
 * admin-authenticated context.
 */
const ALLOWED_HOSTS = new Set(["claude.ai", "www.claude.ai", "claude.site"]);

export const isValidArtifactUrl = (value: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname);
};

export const normalizeArtifactUrl = (value: string): string => value.trim();

const loadArtifacts = (): EmbeddedArtifact[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop anything malformed or no longer on an allowed host rather than
    // rendering it — localStorage contents are not trusted input.
    return parsed.filter(
      (item): item is EmbeddedArtifact =>
        item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.url === "string" &&
        typeof item.addedAt === "string" &&
        isValidArtifactUrl(item.url)
    );
  } catch {
    return [];
  }
};

const saveArtifacts = (artifacts: EmbeddedArtifact[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(artifacts));
  } catch {
    // Storage full or blocked — the page still works for this visit.
  }
};

const createArtifact = (title: string, url: string): EmbeddedArtifact => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title: title.trim(),
  url: normalizeArtifactUrl(url),
  addedAt: new Date().toISOString(),
});

/**
 * A minimal external store so the page can read the list with
 * useSyncExternalStore: the server snapshot is always empty (localStorage
 * doesn't exist there) and the client snapshot is read once and then kept
 * in memory, so React always gets a stable reference between changes.
 */
const EMPTY: EmbeddedArtifact[] = [];

let cache: EmbeddedArtifact[] | null = null;
const listeners = new Set<() => void>();

const setArtifacts = (next: EmbeddedArtifact[]): void => {
  cache = next;
  saveArtifacts(next);
  listeners.forEach((listener) => listener());
};

export const artifactsStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): EmbeddedArtifact[] {
    if (cache === null) cache = loadArtifacts();
    return cache;
  },
  getServerSnapshot(): EmbeddedArtifact[] {
    return EMPTY;
  },
  add(title: string, url: string): EmbeddedArtifact {
    const artifact = createArtifact(title, url);
    setArtifacts([artifact, ...this.getSnapshot()]);
    return artifact;
  },
  remove(id: string): void {
    setArtifacts(this.getSnapshot().filter((a) => a.id !== id));
  },
  has(url: string): boolean {
    const normalized = normalizeArtifactUrl(url);
    return this.getSnapshot().some((a) => a.url === normalized);
  },
};
