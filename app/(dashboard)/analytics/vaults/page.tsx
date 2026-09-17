"use client";

import { useSearchParams } from "next/navigation";
import { SubTabBar } from "@/components/analytics/analytics-header";
import { PendingSubTab } from "@/components/analytics/panel";
import { AnalyticsChartsView } from "@/components/revenue/analytics-charts-view";
import { analyticsTab, resolveSubTab } from "@/lib/analytics-navigation";

const TAB_ID = "vaults";

/**
 * TVL & flows carries the protocol charts that used to live on the old
 * `/revenue` Analytics tab — withdrawal latency, bridge activity, share
 * premium and the user cohort chart.
 *
 * Moved here rather than retired: this is where the spec sends them, and
 * leaving them behind on a page that no longer exists would have quietly
 * dropped four working charts. The dedicated TVL series (flow-based versus
 * marked-to-market) and the weekly flows chart still land in Phase 2 — this
 * sub-tab is not finished, it is just not empty.
 */
export default function VaultsAnalyticsPage() {
  const searchParams = useSearchParams();
  const tab = analyticsTab(TAB_ID)!;
  const subTab = resolveSubTab(tab, searchParams.get("tab") ?? undefined);

  return (
    <div className="space-y-6">
      <SubTabBar tabId={TAB_ID} />

      {subTab?.pending ? (
        <PendingSubTab tabLabel={tab.label} subTab={subTab} />
      ) : subTab?.id === "tvl" ? (
        <AnalyticsChartsView />
      ) : null}
    </div>
  );
}
