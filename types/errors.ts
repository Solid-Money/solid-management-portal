/**
 * The Errors page's wire shapes.
 *
 * Copied verbatim from the contract shared between solid-backend,
 * solid-management-portal and solid-ui — the backend's copy is the source of
 * truth — so a diff against it stays empty; single quotes and all. The app's
 * ingest-only `ClientErrorEvent` is left out: the portal only reads.
 *
 * The envelopes at the bottom are the portal's names for the responses the
 * contract describes in its endpoint comments.
 */

export type ErrorSource = 'app' | 'backend' | 'mongo' | 'temporal' | 'glitchtip' | 'amplitude' | 'loki';
export type WhoActs = 'user' | 'support' | 'ops' | 'engineering' | 'provider';
export type Severity = 'info' | 'warning' | 'error' | 'critical';
export type ErrorGroupStatus = 'open' | 'acknowledged' | 'resolved' | 'muted';
export type ErrorFlow =
  | 'deposit' | 'withdraw' | 'send' | 'swap' | 'bridge' | 'card' | 'card_deposit'
  | 'kyc' | 'signup' | 'login' | 'buy_crypto' | 'cash_out' | 'savings' | 'rewards'
  | 'tier' | 'app' | 'other';

// ───────────────────────────── Backend → portal rows
export interface ErrorEventRefs {
  activityId?: string;
  clientTxId?: string;
  temporalWorkflowId?: string;
  temporalRunId?: string;
  glitchtipEventId?: string;
  glitchtipIssueId?: string;
  lokiQuery?: string;         // LogQL that reproduces this line in Grafana Explore
}

export interface ErrorEventRow {
  id: string;
  ts: string;                 // ISO
  source: ErrorSource;
  kind?: string;
  flow: ErrorFlow;
  step?: string;
  fingerprint: string;
  code?: string;
  title: string;              // plain English, ≤ 8 words
  action: string;             // plain English, ≤ 15 words
  whoActs: WhoActs;
  severity: Severity;
  labelled: boolean;          // false = no catalog entry yet ("New error, not yet explained")
  userId?: string;            // Mongo users._id
  username?: string;
  claimedUsername?: string;
  platform?: string;          // ios | android | web | server
  appVersion?: string;
  service?: string;           // backend service name
  message?: string;           // redacted technical text
  userMessage?: string;
  httpStatus?: number;
  endpoint?: string;
  screen?: string;
  amountUsd?: number;
  chainId?: number;
  refs?: ErrorEventRefs;
  alsoSeenIn?: ErrorSource[];
  repeat?: number;            // extra identical occurrences folded into this row (burst de-dupe)
}

export interface ErrorGroupRow {
  fingerprint: string;
  title: string;
  action: string;
  whoActs: WhoActs;
  severity: Severity;
  labelled: boolean;
  flow: ErrorFlow;
  code?: string;
  sources: ErrorSource[];
  sampleMessage?: string;
  count: number;              // all-time occurrences
  usersAffected: number;      // all-time distinct users
  countInRange: number;       // occurrences inside [from, to]
  usersInRange: number;       // distinct users inside [from, to]
  firstSeen: string;
  lastSeen: string;
  status: ErrorGroupStatus;
  mutedUntil?: string | null;
  owner?: string | null;
  note?: string | null;
  updatedBy?: string | null;
}

export interface ErrorGroupDetail extends ErrorGroupRow {
  topUsers: { userId: string; username?: string; count: number; lastSeen: string }[];
  byPlatform: { platform: string; count: number }[];
  byAppVersion: { appVersion: string; count: number }[];
}

export interface ErrorStats {
  from: string;
  to: string;
  total: number;
  usersAffected: number;
  groups: number;
  needEngineering: number;    // distinct groups with whoActs=engineering in range
  newGroups: number;          // groups whose firstSeen is inside range
  moneyFlowFailures: number;  // events with source=mongo in range
  previous: { total: number; usersAffected: number; moneyFlowFailures: number };
  bySource: Partial<Record<ErrorSource, number>>;
  bySeverity: Partial<Record<Severity, number>>;
}

export interface UpdateErrorGroupBody {
  status?: ErrorGroupStatus;
  mutedUntil?: string | null; // ISO; server defaults to now+24h when status=muted and absent
  owner?: string | null;
  note?: string | null;
  // labelling (the "Needs a label" queue); setting any of these marks the group labelled
  title?: string;             // ≤ 80 chars
  action?: string;            // ≤ 160 chars
  whoActs?: WhoActs;
  severity?: Severity;
}

// ───────────────────────────── Admin REST (flash-admins-service, Firebase bearer)
// GET   /admin/v1/errors/stats?from&to                                   → ErrorStats
// GET   /admin/v1/errors/groups?from&to&source&flow&whoActs&severity&platform&status&labelled&user&q&sort&order&page&limit
//         sort: 'count' | 'lastSeen' | 'users' (default 'lastSeen'), order 'asc'|'desc' (default desc), limit ≤ 100 (default 25)
//         labelled: 'true' | 'false'; user: username | email | userId (server resolves); q: text in title/message/code
//       → { data: ErrorGroupRow[]; meta: { total; page; limit; totalPages } }
// GET   /admin/v1/errors/groups/:fingerprint?from&to                       → ErrorGroupDetail
// PATCH /admin/v1/errors/groups/:fingerprint   body UpdateErrorGroupBody   → ErrorGroupRow
// GET   /admin/v1/errors/events?from&to&source&flow&whoActs&severity&platform&fingerprint&user&q&cursor&limit
//         limit ≤ 200 (default 50); cursor is opaque
//       → { data: ErrorEventRow[]; nextCursor: string | null }
// GET   /admin/v1/users/:id/errors?from&to&cursor&limit                    → { data: ErrorEventRow[]; nextCursor: string | null }
// Default range when from/to omitted: last 24 hours.

// ───────────────────────────── Admin socket (existing /admin/v1/socket.io, Firebase token in auth.token)
// client → server:  'errors:subscribe'   (payload: {} , ack: (res: { ok: boolean; error?: string }) => void)
//                   'errors:unsubscribe' (payload: {} , ack optional)
//   Re-emit 'errors:subscribe' after every reconnect (rooms do not survive reconnects).
// server → client:  'error_event'        ErrorEventRow
//                   'error_group_update' ErrorGroupUpdate
//                   'error_burst'        { dropped: number; windowSec: number }   (rate guard summary)
export interface ErrorGroupUpdate {
  fingerprint: string;
  title: string;
  severity: Severity;
  whoActs: WhoActs;
  count: number;
  usersAffected: number;
  lastSeen: string;
  status: ErrorGroupStatus;
}

// ───────────────────────────── Response envelopes (portal names for the shapes above)
export interface ErrorGroupsResponse {
  data: ErrorGroupRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ErrorEventsResponse {
  data: ErrorEventRow[];
  nextCursor: string | null;
}

/** The `error_burst` socket payload. */
export interface ErrorBurst {
  dropped: number;
  windowSec: number;
}
