/**
 * Error Refs: the short code users see on a failure in the app ("Ref
 * 9C1B-4F2A") and paste into support chats.
 *
 * A Ref is the first 8 hex characters of the GlitchTip event ID. When the
 * failure came from one of our endpoints, that event ID is the request's
 * `X-Request-Id`, so the Ref is also the start of every backend log line the
 * request wrote (`rid=9c1b4f2a…`). The backend keeps a record of each one in
 * `clientErrors`; the Error lookup page reads it.
 */

const HEX_32 = /^[0-9a-f]{32}$/i;

/** `9c1b4f2a…` → `9C1B-4F2A`. */
export function formatErrorRef(id: string): string {
  const head = id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${head.slice(0, 4)}-${head.slice(4, 8)}`;
}

/**
 * Whether a search box input is an error lookup rather than a user search:
 * a Ref written the way the app shows it (with the hyphen, optionally after
 * "Ref"), or a full 32-hex event / request ID. A bare 8-character string could
 * just as well be a username, so it is left to the user search.
 */
export function isErrorLookupQuery(input: string): boolean {
  const value = input.trim();
  if (HEX_32.test(value.replace(/-/g, ""))) return true;
  return /^(ref[\s:#]*)?[0-9a-f]{4}-[0-9a-f]{4}$/i.test(value);
}

/** The request ID an admin API failure came back with, from the body or the header. */
export function requestIdOf(error: unknown): string | undefined {
  const response = (
    error as {
      response?: { data?: { requestId?: unknown }; headers?: Record<string, unknown> };
    }
  )?.response;
  const candidate = response?.data?.requestId ?? response?.headers?.["x-request-id"];
  return typeof candidate === "string" && HEX_32.test(candidate)
    ? candidate.toLowerCase()
    : undefined;
}

/**
 * GlitchTip issue search, e.g. `https://glitchtip.fuse.io/solid-money/issues`.
 * GlitchTip resolves a full event ID straight to its issue and filters by tag
 * with `error_ref:9C1B-4F2A`. Null when unset, so the UI shows plain text
 * instead of a link that goes nowhere.
 */
const GLITCHTIP_ISSUES_URL = process.env.NEXT_PUBLIC_GLITCHTIP_ISSUES_URL?.replace(/\/$/, "");

export function glitchTipSearchUrl(query: string): string | null {
  if (!GLITCHTIP_ISSUES_URL) return null;
  return `${GLITCHTIP_ISSUES_URL}?query=${encodeURIComponent(query)}`;
}

/** Grafana base URL and the Loki datasource UID backend logs live in. */
const GRAFANA_URL = process.env.NEXT_PUBLIC_GRAFANA_URL?.replace(/\/$/, "");
const GRAFANA_LOKI_UID = process.env.NEXT_PUBLIC_GRAFANA_LOKI_UID;

/**
 * Grafana Explore on the backend's logs, filtered to one line fragment: the
 * failing request (`rid=<id>`) or, when the failure never reached the backend,
 * the line accounts-service wrote when the app reported it (`ref=9C1B-4F2A`).
 */
export function grafanaLogsUrl(needle: string, around?: string): string | null {
  if (!GRAFANA_URL || !GRAFANA_LOKI_UID) return null;
  const at = around ? new Date(around).getTime() : NaN;
  const range = Number.isNaN(at)
    ? { from: "now-7d", to: "now" }
    : { from: String(at - 15 * 60_000), to: String(at + 15 * 60_000) };
  const panes = {
    a: {
      datasource: GRAFANA_LOKI_UID,
      queries: [
        {
          refId: "A",
          expr: `{namespace="solid-backend"} |= ${JSON.stringify(needle)}`,
          queryType: "range",
          datasource: { type: "loki", uid: GRAFANA_LOKI_UID },
        },
      ],
      range,
    },
  };
  return `${GRAFANA_URL}/explore?schemaVersion=1&orgId=1&panes=${encodeURIComponent(
    JSON.stringify(panes),
  )}`;
}
