/**
 * Growth → Automated nudges: the automated pushes and emails, configured here
 * instead of in code. Mirrors `libs/common/src/types/nudges.types.ts` in
 * solid-backend (the payloads of admins-service's `/admin/v1/nudges*`,
 * answered by accounts-service).
 */

export const NUDGE_STATUSES = ["live", "paused", "draft", "archived"] as const;
/**
 * - live: sends.
 * - paused: kept, sends nothing.
 * - draft: never sent yet (a new nudge, or one whose trigger is not built).
 * - archived: removed from the board; restorable from its history.
 */
export type NudgeStatus = (typeof NUDGE_STATUSES)[number];

export const NUDGE_CATEGORIES = ["transactional", "marketing"] as const;
/**
 * Transactional nudges skip the marketing rules (frequency cap, quiet hours,
 * consent, the marketing switch); marketing nudges are subject to all of them.
 */
export type NudgeCategory = (typeof NUDGE_CATEGORIES)[number];

export const NUDGE_EDGE_KINDS = [
  "then",
  "stops",
  "replaces",
  "suppresses",
  "excludes",
] as const;
/**
 * - then: the target follows this one (a sequence step or a later stage).
 * - stops: this one firing ends the target's sequence.
 * - replaces: the target is sent instead of this one for some users.
 * - suppresses: while this one was sent recently, the target is skipped.
 * - excludes: the two never go to the same user.
 */
export type NudgeEdgeKind = (typeof NUDGE_EDGE_KINDS)[number];

/** A journey stage id, from `catalog.flows`. */
export type NudgeFlowId = string;

export interface NudgeEdge {
  to: string;
  kind: NudgeEdgeKind;
  /** Shown on the edge, e.g. "+24h, no deposit". */
  label?: string;
}

export interface NudgeVariable {
  /** Used in copy as `{name}`. */
  name: string;
  description: string;
  /** Rendered in previews and test sends. */
  example: string;
}

export interface NudgeTriggerView {
  /** Plain-words description, e.g. "+24h after signup, no deposit yet". */
  label: string;
  /** Set for nudges built from an event. */
  event?: string;
  /** Minutes after the trigger, when the trigger has a delay. */
  delayMinutes?: number | null;
  /** Whether `delayMinutes` can be changed from the portal. */
  delayEditable: boolean;
}

export interface NudgePushView {
  enabled: boolean;
  title: string;
  body: string;
  /** In-app path the tap opens, with its query. */
  path: string;
  /** The destination picked from the catalog, when the path is one of them. */
  destinationId: string | null;
  imageUrl: string | null;
  utmSource: string;
  utmCampaign: string;
}

export interface NudgeEmailView {
  enabled: boolean;
  /** Brevo transactional template id; null when there is no template yet. */
  templateId: number | null;
}

export interface NudgeStats {
  since: string;
  sent: number;
  skipped: number;
  deferred: number;
  pushSent: number;
  emailSent: number;
  byReason: Record<string, number>;
}

export interface NudgeView {
  key: string;
  name: string;
  flow: NudgeFlowId;
  description: string;
  /** config: in the database, editable. code: not moved yet, read-only. */
  source: "config" | "code";
  status: NudgeStatus;
  /** False when the trigger is not built yet: cannot go live. */
  implemented: boolean;
  /** False for code-owned transactional pushes: read-only. */
  managed: boolean;
  /** False for nudges that must always send. */
  canPause: boolean;
  category: NudgeCategory;
  /** 1 = highest. */
  priority: number;
  trigger: NudgeTriggerView;
  audience: string;
  stopWhen: string | null;
  cooldownDays: number | null;
  suppressionGroup: string | null;
  /** Condition ids checked at send time, for event nudges. */
  conditions: string[];
  push: NudgePushView | null;
  email: NudgeEmailView | null;
  variables: NudgeVariable[];
  edges: NudgeEdge[];
  note: string | null;
  /** 0 while source is code. */
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  stats: NudgeStats | null;
}

export interface NudgeSuppressionGroup {
  id: string;
  label: string;
  /** One nudge of the group per user per this many days. */
  days: number;
}

export interface NudgeSettingsView {
  version: number;
  marketingEnabled: boolean;
  respectMarketingConsent: boolean;
  frequencyCap: { enabled: boolean; perDay: number; perWeek: number };
  quietHours: {
    enabled: boolean;
    /** "HH:mm" */
    start: string;
    /** "HH:mm" */
    end: string;
    /** IANA zone used for users whose zone is unknown. */
    fallbackTimezone: string;
  };
  suppressionGroups: NudgeSuppressionGroup[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface NudgeDestinationView {
  id: string;
  label: string;
  description: string;
  path: string;
  group: string;
  needsNewApp?: boolean;
}

export interface NudgeEventView {
  id: string;
  label: string;
  description: string;
  variables: NudgeVariable[];
}

export interface NudgeConditionView {
  id: string;
  label: string;
}

export interface NudgeCopyRule {
  /** Case-insensitive regular expression source. */
  pattern: string;
  message: string;
}

export interface NudgeCatalogView {
  flows: { id: NudgeFlowId; label: string }[];
  destinations: NudgeDestinationView[];
  events: NudgeEventView[];
  conditions: NudgeConditionView[];
  copyRules: NudgeCopyRule[];
  limits: {
    pushTitleMax: number;
    pushBodyMax: number;
    /** Where Android and iOS cut a collapsed push body. */
    pushBodyCollapsed: number;
    reasonMin: number;
    reasonMax: number;
  };
}

export interface NudgeBoard {
  canEdit: boolean;
  migrated: boolean;
  nudges: NudgeView[];
  settings: NudgeSettingsView;
  catalog: NudgeCatalogView;
  generatedAt: string;
}

export interface NudgeFieldChange {
  /** Dotted path, e.g. "push.title". */
  field: string;
  from: unknown;
  to: unknown;
}

export type NudgeChangeSource = "portal" | "claude" | "migration";

export interface NudgeVersionView {
  /** A nudge key, or "settings" for the global rules. */
  key: string;
  version: number;
  at: string;
  by: string;
  source: NudgeChangeSource;
  reason: string;
  changes: NudgeFieldChange[];
}

export interface NudgeDetail {
  nudge: NudgeView;
  versions: NudgeVersionView[];
}

export type NudgePushPatch = Partial<
  Pick<
    NudgePushView,
    "enabled" | "title" | "body" | "path" | "destinationId" | "imageUrl"
  >
>;

export type NudgeEmailPatch = Partial<
  Pick<NudgeEmailView, "enabled" | "templateId">
>;

/** Only the fields present change. */
export interface NudgePatch {
  name?: string;
  description?: string;
  status?: NudgeStatus;
  category?: NudgeCategory;
  priority?: number;
  delayMinutes?: number | null;
  cooldownDays?: number | null;
  suppressionGroup?: string | null;
  conditions?: string[];
  edges?: NudgeEdge[];
  push?: NudgePushPatch;
  email?: NudgeEmailPatch;
}

export interface NudgeUpdateRequest {
  expectedVersion: number;
  reason: string;
  changes: NudgePatch;
}

export interface NudgeCreateRequest {
  reason: string;
  nudge: {
    key: string;
    name: string;
    flow: NudgeFlowId;
    description?: string;
    event: string;
    delayMinutes: number;
    conditions?: string[];
    category: NudgeCategory;
    priority?: number;
    cooldownDays?: number | null;
    suppressionGroup?: string | null;
    push?: {
      title: string;
      body: string;
      path: string;
      destinationId?: string | null;
      imageUrl?: string | null;
    } | null;
    email?: { templateId: number } | null;
  };
}

export interface NudgeRestoreVersionRequest {
  expectedVersion: number;
  reason: string;
}

export interface NudgeSettingsPatch {
  marketingEnabled?: boolean;
  respectMarketingConsent?: boolean;
  frequencyCap?: Partial<NudgeSettingsView["frequencyCap"]>;
  quietHours?: Partial<NudgeSettingsView["quietHours"]>;
  suppressionGroups?: NudgeSuppressionGroup[];
}

export interface NudgeSettingsUpdateRequest {
  expectedVersion: number;
  reason: string;
  changes: NudgeSettingsPatch;
}

export type NudgeTestChannel = "push" | "email" | "both";

export interface NudgeTestRequest {
  channel: NudgeTestChannel;
  /** User ids or emails, at most 5; left out = the admin's own account. */
  recipients?: string[];
  /** Unsaved edits to test instead of the saved copy. */
  draft?: Pick<NudgePatch, "push" | "email">;
}

export interface NudgeTestResult {
  recipients: Array<{
    recipient: string;
    found: boolean;
    push?: { sent: boolean; reason?: string };
    email?: { sent: boolean; reason?: string };
  }>;
}

export interface NudgeBrevoTemplateView {
  id: number;
  name: string;
  subject: string;
  isActive: boolean;
  tag: string | null;
  /** Every `params.x` the template uses. */
  params: string[];
  htmlContent: string;
  modifiedAt: string | null;
}

export type NudgeMigrationId =
  | "nudges-seed-from-code"
  | "nudges-map-2026-11-24";

export interface NudgeMigrationView {
  id: NudgeMigrationId;
  title: string;
  description: string;
  requires: NudgeMigrationId[];
  appliedAt: string | null;
  appliedBy: string | null;
}

export type NudgeMigrationAction = "create" | "update" | "unchanged" | "skip";

export interface NudgeMigrationItem {
  /** A nudge key, or "settings". */
  key: string;
  name: string;
  action: NudgeMigrationAction;
  note: string | null;
  changes: NudgeFieldChange[];
}

export interface NudgeMigrationPlan {
  id: NudgeMigrationId;
  title: string;
  /** Apply refuses a different hash (the data moved since the dry run). */
  planHash: string;
  generatedAt: string;
  summary: Record<NudgeMigrationAction, number>;
  items: NudgeMigrationItem[];
  warnings: string[];
}

export interface NudgeMigrationApplyRequest {
  planHash: string;
  reason: string;
}

export interface NudgeMigrationResult {
  id: NudgeMigrationId;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  appliedAt: string;
  appliedBy: string;
}
