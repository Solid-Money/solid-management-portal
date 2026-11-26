/**
 * Growth → Push notifications. Mirrors the payloads of admins-service's
 * `/admin/v1/push-campaigns` (accounts-service `PushCampaignService`).
 */

export type PushCampaignVariantKey = "a" | "b" | "c";

/** A tier a campaign can be narrowed to, read when it goes out. */
export type PushCampaignTier = "core" | "prime" | "ultra";

/**
 * Who of the uploaded list is left out when the campaign goes out (or now, for
 * a preview). Absent fields leave nobody out.
 */
export interface PushCampaignAudienceFilters {
  /** Only people whose tier, at send time, is one of these. */
  tiers?: PushCampaignTier[];
  /** Read the tier without a free trial: someone on a trial has not bought it. */
  ignoreTrials?: boolean;
  /** Leave out the control groups of these campaigns (ids). */
  excludeControlOf?: string[];
}

/** Who the filters left out (or would leave out, in a preview). */
export interface PushCampaignExcluded {
  /** In the control group of a campaign named in `excludeControlOf`. */
  control: number;
  /** Holding a tier the campaign is not for. */
  tier: number;
  /** Whose tier could not be read: left out rather than guessed. */
  tierUnknown: number;
}

export type PushDestinationGroup =
  | "Home"
  | "Card"
  | "Savings"
  | "Deposit"
  | "Rewards"
  | "Announcements";

/** Somewhere in the app a campaign push can open. */
export interface PushDestination {
  id: string;
  label: string;
  /** What the user sees on tap. */
  description: string;
  /** Path (and query) on the app's link host. */
  path: string;
  group: PushDestinationGroup;
  /** Needs a page of the active What's New announcement to be chosen. */
  needsWhatsNewStep?: true;
  /** Opens Home on app builds from before the push campaigns release. */
  needsNewApp?: true;
}

export interface PushCampaignLimits {
  maxRecipients: number;
  maxVariants: number;
  maxControlPercent: number;
  maxTestRecipients: number;
  titleMaxLength: number;
  bodyMaxLength: number;
  nameMaxLength: number;
  /** Absent from backends before scheduling. */
  scheduleMinLeadMinutes?: number;
  scheduleMaxAheadDays?: number;
  maxExcludedControls?: number;
}

export interface PushCampaignDestinations {
  destinations: PushDestination[];
  /** The active What's New announcement, whose pages a push can open on. */
  whatsNew: {
    id: string;
    /**
     * A single image or video has no pages: a push opens it as it is. Absent
     * from backends before that format, which only had carousels.
     */
    format?: "carousel" | "single";
    steps: { index: number; title: string }[];
  } | null;
  /** Whether the signed-in admin may send (otherwise: preview only). */
  canSend: boolean;
  /**
   * Whether the server sends scheduled campaigns. Absent from backends before
   * scheduling, which cannot schedule at all.
   */
  schedulerEnabled?: boolean;
  /** Tiers a campaign can be narrowed to. Absent before send-time filters. */
  tiers?: PushCampaignTier[];
  limits: PushCampaignLimits;
}

export interface PushCampaignPreview {
  /** Distinct ids that look like ids. */
  requested: number;
  duplicates: number;
  invalidCount: number;
  invalid: string[];
  /** Ids that are not an open account. */
  notFoundCount: number;
  notFound: string[];
  /** Open accounts without a device registered for push. */
  unreachable: number;
  /** Open accounts with a device that the filters would leave out, as of now. */
  excluded?: PushCampaignExcluded;
  /** Open accounts with one, after the filters: who the campaign splits into its groups. */
  reachable: number;
}

/** One variant as the form sends it. */
export interface PushCampaignVariantInput {
  title: string;
  body?: string;
  destinationId: string;
  /** For What's New: the announcement the page was picked from. */
  whatsNewId?: string;
  whatsNewStep?: number;
}

export interface PushCampaignTestInput {
  /** User ids or usernames. */
  recipients: string[];
  variants: PushCampaignVariantInput[];
}

export interface PushCampaignTestResult {
  sentTo: { userId: string; username: string }[];
  /** Of those, users with no device registered: the test cannot reach them. */
  withoutDevice: string[];
  unresolved: string[];
  variants: number;
}

export interface SendPushCampaignInput {
  name: string;
  userIds: string[];
  variants: PushCampaignVariantInput[];
  controlPercent: number;
  reason?: string;
  filters?: PushCampaignAudienceFilters;
}

/** A campaign to go out later, or the new version of a scheduled one. */
export interface SchedulePushCampaignInput extends SendPushCampaignInput {
  /** ISO 8601, UTC. */
  sendAt: string;
}

/**
 * `scheduled` waits for `sendAt` and can still be changed or cancelled;
 * `cancelled` was called off before it went out.
 */
export type PushCampaignStatus =
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export interface PushCampaignSummary {
  id: string;
  name: string;
  slug: string;
  status: PushCampaignStatus;
  variants: {
    key: PushCampaignVariantKey;
    title: string;
    body?: string;
    destinationId: string;
    path: string;
    /** `data.type` and FCM analytics label of this variant's pushes. */
    type: string;
    /** The What's New announcement a `whats_new` variant opens. */
    whatsNewId?: string;
    whatsNewStep?: number;
    recipients: number;
    /** Handed to the notifications service (not necessarily delivered). */
    handedOff: number;
  }[];
  controlPercent: number;
  controlCount: number;
  requested: number;
  notFound: number;
  unreachable: number;
  reachable: number;
  audienceFilters?: PushCampaignAudienceFilters;
  /** Who the filters left out when it went out. */
  excluded?: PushCampaignExcluded;
  createdBy: string;
  /** Who last changed a scheduled campaign; it goes out in their name. */
  updatedBy?: string;
  reason?: string;
  /** When a scheduled campaign goes (or went) out. */
  sendAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt: string;
  sentAt?: string;
  error?: string;
}

/** A campaign with a scheduled one's uploaded list, for the editor. */
export interface PushCampaignDetail extends PushCampaignSummary {
  userIds: string[];
}
