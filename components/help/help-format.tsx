import { Badge } from "@/components/ui/badge";
import type { HelpArticleSummary } from "@/types/help";

/** The public help site (support.solid.xyz in production). */
export const HELP_SITE_URL = (process.env.NEXT_PUBLIC_HELP_SITE_URL || "https://support.solid.xyz").replace(/\/+$/, "");

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function personName(email: string | null | undefined): string {
  if (!email) return "—";
  if (email === "intercom-import") return "Intercom import";
  return email.split("@")[0];
}

/** Published / Draft / Changes not published / Needs review / Archived, as badges. */
export function ArticleStatus({ article }: { article: HelpArticleSummary }) {
  if (article.archived) return <Badge variant="muted">Archived</Badge>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {article.status === "published" ? (
        <Badge variant="success">Published v{article.liveVersion}</Badge>
      ) : (
        <Badge variant="muted">Draft</Badge>
      )}
      {article.hasUnpublishedChanges && <Badge variant="warning">Unpublished changes</Badge>}
      {article.stale && <Badge variant="danger">Needs review</Badge>}
    </span>
  );
}

export function FeedbackScore({ helpful, notHelpful }: { helpful: number; notHelpful: number }) {
  const total = helpful + notHelpful;
  if (!total) return <span className="text-gray-400">—</span>;
  const rate = Math.round((helpful / total) * 100);
  return (
    <span className={rate < 60 ? "text-red-700" : "text-gray-700"} title={`${helpful} yes, ${notHelpful} no`}>
      {rate}% <span className="text-gray-400">({total})</span>
    </span>
  );
}
