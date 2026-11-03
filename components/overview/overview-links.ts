import type { OverviewRange } from "@/types/overview";

/**
 * Where each Overview number's rows live. The Analytics pages take the same
 * range as `startDate`/`endDate`, so a click keeps the window the reader was
 * looking at.
 */
export function analyticsHref(
  tab: string,
  subTab: string | null,
  range: Pick<OverviewRange, "from" | "to">,
): string {
  const params = new URLSearchParams();
  if (subTab) params.set("tab", subTab);
  params.set("startDate", range.from);
  params.set("endDate", range.to);
  return `/analytics/${tab}?${params.toString()}`;
}

/** A support inbox view, e.g. the needs-a-human queue. */
export function supportHref(view?: string): string {
  return view ? `/support?view=${encodeURIComponent(view)}` : "/support";
}
