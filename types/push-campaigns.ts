/**
 * Growth → Push notifications. Mirrors the payloads of admins-service's
 * `/admin/v1/push-campaigns` (accounts-service `PushCampaignService`).
 */

export type PushCampaignVariantKey = "a" | "b" | "c";

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
}

export interface PushCampaignDestinations {
  destinations: PushDestination[];
  /** The active What's New announcement, whose pages a push can open on. */
  whatsNew: { id: string; steps: { index: number; title: string }[] } | null;
  /** Whether the signed-in admin may send (otherwise: preview only). */
  canSend: boolean;
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
  /** Open accounts with one: who the campaign splits into its groups. */
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
}

export type PushCampaignStatus = "sending" | "sent" | "failed";

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
  createdBy: string;
  reason?: string;
  createdAt: string;
  sentAt?: string;
  error?: string;
}
