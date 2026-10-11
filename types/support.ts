/**
 * The support inbox's API shapes, as flash-support-service returns them
 * through admins-service (`/admin/v1/support/*`).
 * Backend: apps/flash-support-service/src/inbox in solid-backend.
 */

export const SUPPORT_QUEUE_VIEWS = [
  "needs_human",
  "mine",
  "ai_handling",
  "waiting_customer",
  "escalated",
  "snoozed",
  "resolved",
] as const;

export type SupportQueueView = (typeof SUPPORT_QUEUE_VIEWS)[number];

export type SupportCaseStatus =
  | "ai_handling"
  | "needs_human"
  | "assigned"
  | "waiting_customer"
  | "snoozed"
  | "escalated"
  | "resolved";

export type SupportQueueCounts = Record<SupportQueueView, number> & {
  overdueFollowUps: number;
  urgent: number;
};

/** The signed-in admin. Every admin is a support agent. */
export interface SupportMe {
  email: string;
  name: string | null;
  /** Admins who opened the portal in the last 90 days: the assignee and @mention lists. */
  agents: string[];
  /** Null when the support service did not answer. */
  counts: SupportQueueCounts | null;
}

export interface SupportAttachment {
  key: string;
  mime: string;
  size: number;
  fileName: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  status: "pending" | "clean" | "rejected" | "redacted";
  url: string | null;
}

export interface SupportAgentMessage {
  id: string;
  seq: number;
  caseId: string | null;
  author: {
    type: "user" | "guest" | "ai" | "agent" | "system";
    name: string | null;
    id: string | null;
  };
  visibility: "public" | "internal";
  body: string | null;
  english: string | null;
  lang: string | null;
  delivered: { text: string; lang: string | null } | null;
  attachments: SupportAttachment[];
  context: { kind: string; id: string | null } | null;
  redacted: boolean;
  aiRunId: string | null;
  createdAt: string;
}

export interface SupportAgentCase {
  id: string;
  conversationId: string;
  number: number;
  status: SupportCaseStatus;
  intent: string | null;
  title: string | null;
  assigneeEmail: string | null;
  urgent: boolean;
  complaint: { type: string; noticeReceivedAt: string; flaggedBy: string } | null;
  escalation: {
    target: string;
    reason: string;
    externalRef: string | null;
    followUpAt: string;
    by: string;
    at: string;
    overdue: boolean;
  } | null;
  snoozeUntil: string | null;
  handoffSummary: string | null;
  hasDraft: boolean;
  csat: { score: number; comment: string | null; at: string } | null;
  resolution: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  autoResolved: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  firstHumanReplyAt: string | null;
  handedOffAt: string | null;
  lastCustomerMessageAt: string | null;
  lastAgentReplyAt: string | null;
}

export interface SupportQueueRow {
  case: SupportAgentCase;
  userId: string | null;
  userLabel: string | null;
  language: string | null;
  unread: number;
  lastMessage: {
    authorType: string;
    snippet: string;
    internal: boolean;
    at: string;
  } | null;
}

export interface SupportQueuePage {
  rows: SupportQueueRow[];
  page: number;
  hasMore: boolean;
}

export interface SupportDraft {
  runId: string;
  caseId: string;
  body: string;
  english: string | null;
  lang: string | null;
  intent: string | null;
  confidence: number | null;
  mode: string;
  createdAt: string;
}

export interface SupportConversationView {
  conversation: {
    id: string;
    userId: string | null;
    guestId: string | null;
    userLabel: string | null;
    language: string | null;
    lastReadSeqAgent: number;
    lastSeq: number;
    createdAt: string;
  };
  currentCaseId: string | null;
  cases: SupportAgentCase[];
  messages: SupportAgentMessage[];
  hasOlder: boolean;
  draft: SupportDraft | null;
  translation: { available: boolean; customerLanguage: string | null };
}

export interface SupportTranslationPreview {
  needed: boolean;
  lang: string;
  text: string | null;
  token: string | null;
  error: string | null;
}

export interface SupportReplyInput {
  clientMessageId: string;
  body: string;
  internal?: boolean;
  mentions?: string[];
  translation?: { text: string; lang: string; token: string };
  sendUntranslated?: boolean;
  draftRunId?: string;
}

export interface SupportIncident {
  id: string;
  title: string;
  customerMessage: string;
  active: boolean;
  startedAt: string | null;
}

export interface SupportAgentProfile {
  email: string;
  name: string;
  slackUserId?: string;
}

export interface SupportSettings {
  aiMode: "off" | "shadow" | "on";
  intentAllowlist: string[];
  guidance: string;
  glossary: string;
  coreFacts: string;
  expectedReplyText: string | null;
  missingFundsThresholdUsd: number | null;
  incidents: SupportIncident[];
  businessHours: string | null;
  onCall: { name: string; slackUserId: string } | null;
  agentProfiles: SupportAgentProfile[];
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface SupportSettingsHistoryEntry {
  version: number;
  changed: string[];
  updatedBy: string;
  createdAt: string;
}

export interface SupportMacro {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  usageCount: number;
  updatedBy: string;
  updatedAt: string;
}

export interface SupportDurationStats {
  count: number;
  median: number | null;
  p90: number | null;
}

export interface SupportReport {
  from: string;
  to: string;
  cases: number;
  daily: Array<{ date: string; total: number; byIntent: Record<string, number> }>;
  byIntent: Array<{ intent: string; count: number }>;
  byLanguage: Array<{ language: string; count: number }>;
  firstResponse: SupportDurationStats;
  firstHumanReplyAfterHandoff: SupportDurationStats;
  timeToResolve: SupportDurationStats;
  handoffRate: number | null;
  ai: { resolved: number; confirmed: number; assumed: number; resolutionRate: number | null };
  reopenRate: number | null;
  csat: {
    responses: number;
    average: number | null;
    distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  };
  withoutReply: {
    count: number;
    cases: Array<{ caseId: string; conversationId: string; number: number }>;
  };
  cost: { aiRuns: number; totalUsd: number; perCaseUsd: number | null };
  contentGaps: Array<{ intent: string; count: number }>;
}

export interface SupportAuditEntry {
  id: string;
  actor: string;
  action: string;
  conversationId: string | null;
  caseId: string | null;
  messageId: string | null;
  details: Record<string, unknown> | null;
  at: string;
}

/** What the support service puts on the portal's socket: ids only. */
export interface SupportQueueChange {
  conversationId: string;
  caseId?: string;
  seq?: number;
  reason: "message" | "case" | "handoff" | "ai_draft";
  urgent?: boolean;
}

/** The intents the AI labels cases with (flash-support-service `SUPPORT_INTENTS`). */
export const SUPPORT_INTENTS = [
  "kyc",
  "deposit",
  "card_declined",
  "cashback_rewards",
  "withdrawal",
  "wallet_pay",
  "card_issuance",
  "referral",
  "how_to",
  "virtual_account",
  "add_money",
  "login_recovery",
  "fees_limits",
  "credit_mode",
  "account_closure",
  "fraud_unauthorized",
  "dispute",
  "complaint",
  "other",
] as const;

/** Never answered by the AI, whatever the allowlist says. */
export const ALWAYS_HUMAN_INTENTS = new Set<string>([
  "fraud_unauthorized",
  "dispute",
  "complaint",
  "account_closure",
]);
