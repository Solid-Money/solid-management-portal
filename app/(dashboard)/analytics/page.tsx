import { redirect } from "next/navigation";

/**
 * `/analytics` has no view of its own — Overview is the landing tab.
 *
 * This route previously held the raw Metabase embeds; those moved to
 * Signals → Legacy embeds and retire with Phase 2.
 */
export default function AnalyticsIndexPage() {
  redirect("/analytics/overview");
}
