"use client";

import { useSearchParams } from "next/navigation";
import { SubTabBar } from "@/components/analytics/analytics-header";
import { PendingSubTab } from "@/components/analytics/panel";
import { CardSpendingView } from "@/components/analytics/card/spending-view";
import { CardIssuanceView } from "@/components/analytics/card/issuance-view";
import { CardDeclinesView } from "@/components/analytics/card/declines-view";
import { CardRevenueView } from "@/components/analytics/card/revenue-view";
import { CardEconomicsView } from "@/components/analytics/card/economics-view";
import { analyticsTab, resolveSubTab } from "@/lib/analytics-navigation";

const TAB_ID = "card";

/**
 * The card business: spend, issuance, declines, the FX revenue the issuers
 * pay us, and what each rail costs.
 *
 * Every view reads `cardTransactions` through the same rail attribution on the
 * backend, so Rain and Wirex totals agree across sub-tabs. Revenue & payouts is
 * the exception to the header's date range — a payout belongs to a whole
 * billing month — and says so on the page.
 */
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
      ) : subTab?.id === "issuance" ? (
        <CardIssuanceView />
      ) : subTab?.id === "declines" ? (
        <CardDeclinesView />
      ) : subTab?.id === "revenue" ? (
        <CardRevenueView />
      ) : subTab?.id === "costs" ? (
        <CardEconomicsView />
      ) : null}
    </div>
  );
}
