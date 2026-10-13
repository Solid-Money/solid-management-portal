/** The help center editor's shapes, as admins-service returns them (Phase 5). */

export const HELP_AUDIENCES = ["public", "signed_in", "internal"] as const;
export type HelpAudience = (typeof HELP_AUDIENCES)[number];

export const HELP_AUDIENCE_LABELS: Record<HelpAudience, string> = {
  public: "Everyone",
  signed_in: "Signed-in users",
  internal: "Internal (team only)",
};

export const HELP_STATUS_FILTERS = ["all", "draft", "published", "changed", "stale", "archived"] as const;
export type HelpStatusFilter = (typeof HELP_STATUS_FILTERS)[number];

export interface HelpFeedbackCounts {
  helpful: number;
  notHelpful: number;
}

export interface HelpArticleSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  audience: HelpAudience;
  status: "draft" | "published";
  hasUnpublishedChanges: boolean;
  archived: boolean;
  collectionId: string | null;
  order: number;
  ownerEmail: string | null;
  verifiedAt: string | null;
  stale: boolean;
  liveVersion: number | null;
  publishedAt: string | null;
  updatedAt: string;
  updatedBy: string;
  feedback: HelpFeedbackCounts;
  publicUrl: string | null;
  intercomArticleId: string | null;
}

export interface HelpArticle extends HelpArticleSummary {
  markdown: string;
  previousSlugs: string[];
  draftUpdatedAt: string;
  verifiedBy: string | null;
  versionCount: number;
  live: {
    versionId: string;
    number: number;
    title: string;
    publishedAt: string;
    publishedBy: string;
  } | null;
  liveFeedback: HelpFeedbackCounts;
  createdBy: string;
  createdAt: string;
}

export interface HelpArticleList {
  articles: HelpArticleSummary[];
  counts: Record<HelpStatusFilter, number>;
}

export interface HelpCollection {
  id: string;
  slug: string;
  name: string;
  description: string;
  parentId: string | null;
  order: number;
  articleCount: number;
  publishedCount: number;
  updatedAt: string;
  updatedBy: string;
}

export interface HelpVersionSummary {
  id: string;
  number: number;
  title: string;
  note: string | null;
  publishedBy: string;
  publishedAt: string;
  live: boolean;
  feedback: HelpFeedbackCounts;
}

export interface HelpVersion extends HelpVersionSummary {
  slug: string;
  description: string;
  markdown: string;
  audience: HelpAudience;
  html: string;
}

export interface HelpPreview {
  html: string;
  headings: Array<{ id: string; text: string; level: number }>;
}

export interface HelpImage {
  path: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export interface HelpRedirect {
  from: string;
  to: string;
  kind: "intercom_article" | "intercom_collection" | "renamed_article";
}

export interface HelpArticleQuery {
  status?: Exclude<HelpStatusFilter, "all">;
  collectionId?: string;
  q?: string;
  audience?: HelpAudience;
}

export interface HelpArticleChanges {
  title?: string;
  slug?: string;
  description?: string;
  markdown?: string;
  audience?: HelpAudience;
  collectionId?: string | null;
  order?: number;
  ownerEmail?: string | null;
  baseDraftUpdatedAt?: string;
}

export interface HelpCollectionInput {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
  order?: number;
}

/** What an Intercom import did, or (a preview) would do. */
export interface HelpImportReport {
  dryRun: boolean;
  collections: Array<{ intercomId: string; name: string; slug: string; action: "created" | "exists" | "would_create" }>;
  articles: Array<{
    intercomId: string;
    title: string;
    state: string;
    action: "published" | "draft" | "exists" | "replaced" | "skipped" | "would_publish" | "would_draft";
    reason?: string;
    slug?: string;
    collection?: string | null;
    redirectsTo?: string;
  }>;
  totals: Record<string, number>;
  images: { rehosted: number; failed: Array<{ intercomId: string; url: string; error: string }> };
  links: { rewritten: number; dangling: Array<{ intercomId: string; title: string; link: string }> };
  redirects: Array<{ from: string; to: string }>;
}

/** One "Import from Intercom" run, as the support service keeps it. */
export interface HelpImportRun {
  id: string;
  dryRun: boolean;
  skipDrafts: boolean;
  replaceUnedited: boolean;
  status: "running" | "done" | "failed";
  startedBy: { email: string; name: string | null };
  startedAt: string;
  finishedAt: string | null;
  report: HelpImportReport | null;
  error: string | null;
}

export interface HelpImportOptions {
  dryRun: boolean;
  skipDrafts?: boolean;
  replaceUnedited?: boolean;
}
