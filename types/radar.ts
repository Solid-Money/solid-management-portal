/**
 * The incident radar behind "Needs your attention", `GET /admin/v1/attention`.
 *
 * Mirrors `libs/common/src/types/radar.types.ts` in solid-backend; keep the
 * two in step.
 */

export const RADAR_LEVELS = ["watch", "escalate", "incident"] as const;
export type RadarLevel = (typeof RADAR_LEVELS)[number];

export const RADAR_STATUSES = [
  "new",
  "watching",
  "in_solid",
  "live_in_app",
  "needs_check",
  "resolved",
] as const;
export type RadarStatus = (typeof RADAR_STATUSES)[number];

export const RADAR_CATEGORIES = [
  "incident",
  "abuse",
  "security",
  "reliability",
  "money",
] as const;
export type RadarCategory = (typeof RADAR_CATEGORIES)[number];

export const RADAR_SEVERITIES = ["high", "medium", "low", "watch"] as const;
export type RadarSeverity = (typeof RADAR_SEVERITIES)[number];

/** The card's tabs: everything open, each category, and recently resolved. */
export const RADAR_TABS = [
  "all",
  "incidents",
  "abuse",
  "security",
  "reliability",
  "money",
  "resolved",
] as const;
export type RadarTab = (typeof RADAR_TABS)[number];

export const RADAR_DETECTORS = [
  "referral_burst",
  "flagged_referrer_recruiting",
  "support_ai_off_model",
  "error_spike",
  "known_bad_error",
  "flow_failure",
  "deposits_pending",
  "deposit_method_stopped",
  "signup_spike",
  "passkey_many_accounts",
  "shared_cashout_wallet",
  "same_ip_signups",
  "cashback_cash_like",
  "spend_drop",
  "card_decline_spike",
  "support_cluster",
  "rewards_above_revenue",
] as const;
export type RadarDetector = (typeof RADAR_DETECTORS)[number];

/** The flows whose failures the radar watches, named as people say them. */
export const RADAR_FLOWS = [
  "send",
  "withdraw",
  "swap",
  "bridge",
  "card_topup",
  "card_activation",
  "deposit",
] as const;
export type RadarFlow = (typeof RADAR_FLOWS)[number];

export interface RadarTimelineEntry {
  at: string;
  kind:
    | "opened"
    | "signal"
    | "level"
    | "new_flow"
    | "people_doubled"
    | "errors_stopped"
    | "fixed_offered"
    | "assigned"
    | "snoozed"
    | "dismissed"
    | "resolved"
    | "auto_resolved"
    | "slack"
    | "notice";
  text: string;
  /** The admin who did it, for a person's action. */
  by?: string;
}

export interface RadarSignalView {
  detector: RadarDetector;
  key: string;
  severity: RadarSeverity;
  title: string;
  metaLine: string;
  firstAt: string;
  lastAt: string;
  evidence: Record<string, unknown>;
}

export interface RadarOwner {
  email: string;
  name?: string;
}

/** Where the row's main button goes, when it is a link. */
export interface RadarAction {
  label: string;
  href: string;
}

export interface AttentionItemView {
  id: string;
  level: RadarLevel;
  severity: RadarSeverity;
  status: RadarStatus;
  category: RadarCategory;
  title: string;
  /** One line of numbers under the title. */
  metaLine: string;
  /** The short tag beside the title ("Security", "Abuse", …). */
  tag: string;
  flows: RadarFlow[];
  codes: string[];
  affectedCount: number;
  owner: RadarOwner | null;
  mainAction: RadarAction | null;
  signals: RadarSignalView[];
  timeline: RadarTimelineEntry[];
  slackThreadTs: string | null;
  incidentId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolution: "fixed" | "dismissed" | "quiet" | null;
  resolutionReason: string | null;
  snoozedUntil: string | null;
  /** Set once an hour passed with no new errors: "Mark fixed" can be offered. */
  fixedOfferedAt: string | null;
  /** Failed actions in the item, all flows. */
  failures: number;
  /** Failed actions per flow, for the incident view. */
  flowCounts: Partial<Record<RadarFlow, number>>;
  /** Failures a normal day has on these flows. */
  normalPerDay: number | null;
  /** One error's text, with keys and URLs stripped. */
  sampleError: string | null;
  /** From the error text by fixed rules, when one matches. */
  likelyCause: { cause: string; fix: string } | null;
}

export interface AttentionListResponse {
  items: AttentionItemView[];
  /** Items resolved in the last 7 days ("Resolved this week"). */
  resolved: AttentionItemView[];
  counts: Record<RadarTab, number>;
  summary: {
    liveIncidents: number;
    new: number;
    toCheck: number;
    watching: number;
  };
  /** Detectors that ran clean for the last 7 days, for the footer line. */
  quiet: string[];
  lastCheckAt: string | null;
  generatedAt: string;
}

export const ATTENTION_QUERY_KEYS = {
  all: ["attention"] as const,
  list: (tab: RadarTab) => ["attention", "list", tab] as const,
  item: (id: string) => ["attention", "item", id] as const,
};

/** The radar checks every five minutes; the card looks every minute. */
export const ATTENTION_REFRESH_MS = 60_000;
