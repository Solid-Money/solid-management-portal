"use client";

import { useSearchParams } from "next/navigation";
import { SubTabBar } from "@/components/analytics/analytics-header";
import { PendingSubTab } from "@/components/analytics/panel";
import { SignalsSegmentsView } from "@/components/analytics/signals/segments-view";
import { LegacyEmbedsView } from "@/components/analytics/signals/legacy-embeds-view";
import { analyticsTab, resolveSubTab } from "@/lib/analytics-navigation";

const TAB_ID = "signals";

export default function SignalsAnalyticsPage() {
  const searchParams = useSearchParams();
  const tab = analyticsTab(TAB_ID)!;
  const subTab = resolveSubTab(tab, searchParams.get("tab") ?? undefined);

  return (
    <div className="space-y-6">
      <SubTabBar tabId={TAB_ID} />

      {subTab?.pending ? (
        <PendingSubTab tabLabel={tab.label} subTab={subTab} />
      ) : subTab?.id === "segments" ? (
        <SignalsSegmentsView />
      ) : subTab?.id === "legacy-embeds" ? (
        <LegacyEmbedsView />
      ) : null}
    </div>
  );
}
