"use client";

import { useSearchParams } from "next/navigation";
import { SubTabBar } from "@/components/analytics/analytics-header";
import { PendingSubTab } from "@/components/analytics/panel";
import { CardSpendingView } from "@/components/analytics/card/spending-view";
import { analyticsTab, resolveSubTab } from "@/lib/analytics-navigation";

const TAB_ID = "card";

export default function CardAnalyticsPage() {
  const searchParams = useSearchParams();
  const tab = analyticsTab(TAB_ID)!;
  const subTab = resolveSubTab(tab, searchParams.get("tab") ?? undefined);

  return (
    <div className="space-y-6">
      <SubTabBar tabId={TAB_ID} />

      {subTab?.pending ? (
        <PendingSubTab tabLabel={tab.label} subTab={subTab} />
      ) : subTab?.id === "spending" ? (
        <CardSpendingView />
      ) : null}
    </div>
  );
}
