import { redirect } from "next/navigation";

/**
 * Tier trials moved into Config → Bulk, as one of its sections.
 *
 * Kept as a redirect rather than deleted: this URL is in Slack threads and
 * browser bookmarks. The hash opens the section on arrival.
 */
export default function TierTrialsRedirectPage() {
  redirect("/bulk#tier-trials");
}
