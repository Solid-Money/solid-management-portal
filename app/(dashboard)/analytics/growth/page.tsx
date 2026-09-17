"use client";

import { useSearchParams } from "next/navigation";
import { SubTabBar } from "@/components/analytics/analytics-header";
import { PendingSubTab } from "@/components/analytics/panel";
import { analyticsTab, resolveSubTab } from "@/lib/analytics-navigation";

const TAB_ID = "growth";

/**
 * Every sub-tab here lands in a later phase. The placeholder names the phase
 * and what blocks it, so the tab is honest about being empty rather than
 * looking broken.
 */
export default function GrowthAnalyticsPage() {
  const searchParams = useSearchParams();
  const tab = analyticsTab(TAB_ID)!;
  const subTab = resolveSubTab(tab, searchParams.get("tab") ?? undefined);

  return (
    <div className="space-y-6">
      <SubTabBar tabId={TAB_ID} />
      {subTab ? <PendingSubTab tabLabel={tab.label} subTab={subTab} /> : null}
    </div>
  );
}
