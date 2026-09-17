"use client";

import { useSearchParams } from "next/navigation";
import { SubTabBar } from "@/components/analytics/analytics-header";
import { PendingSubTab } from "@/components/analytics/panel";
import { RewardsOwedView } from "@/components/analytics/rewards/owed-view";
import { RewardsPaidView } from "@/components/analytics/rewards/paid-view";
import { RewardsReferralsView } from "@/components/analytics/rewards/referrals-view";
import { RewardsWalletsView } from "@/components/analytics/rewards/wallets-view";
import { analyticsTab, resolveSubTab } from "@/lib/analytics-navigation";

const TAB_ID = "rewards";

export default function RewardsAnalyticsPage() {
  const searchParams = useSearchParams();
  const tab = analyticsTab(TAB_ID)!;
  const subTab = resolveSubTab(tab, searchParams.get("tab") ?? undefined);

  return (
    <div className="space-y-6">
      <SubTabBar tabId={TAB_ID} />

      {subTab?.pending ? (
        <PendingSubTab tabLabel={tab.label} subTab={subTab} />
      ) : subTab?.id === "paid" ? (
        <RewardsPaidView />
      ) : subTab?.id === "owed" ? (
        <RewardsOwedView />
      ) : subTab?.id === "wallets" ? (
        <RewardsWalletsView />
      ) : subTab?.id === "referrals" ? (
        <RewardsReferralsView />
      ) : null}
    </div>
  );
}
