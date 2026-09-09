import { redirect } from "next/navigation";

/**
 * Revenue moved into the Analytics section.
 *
 * Kept as a redirect rather than deleted: this URL is in Slack threads and
 * browser bookmarks, and the seven tabs that used to live here are now four
 * sub-tabs of `/analytics/revenue`.
 */
export default function RevenueRedirectPage() {
  redirect("/analytics/revenue?tab=overview");
}
