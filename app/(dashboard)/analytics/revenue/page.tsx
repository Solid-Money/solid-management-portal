"use client";

import { useSearchParams } from "next/navigation";
import { SubTabBar } from "@/components/analytics/analytics-header";
import { PendingSubTab } from "@/components/analytics/panel";
import { ExecutiveSummary } from "@/components/revenue/executive-summary";
import { FinanceDetail } from "@/components/revenue/finance-detail";
import { FeesYieldsView } from "@/components/revenue/fees-yields-view";
import { OperationsView } from "@/components/revenue/operations-view";
import { ProductFeesView } from "@/components/revenue/product-fees-view";
import { analyticsTab, resolveSubTab } from "@/lib/analytics-navigation";

const TAB_ID = "revenue";

/**
 * Revenue, regrouped into the four sub-tabs the spec defines.
 *
 * The seven tabs on the old `/revenue` page were organised by which endpoint
 * fed them — Executive, Finance, Product Fees, Fees & Yields, Analytics,
 * Operations, Investor — which is why three of them showed a different revenue
 * total. These four are organised by the question being asked, and the views
 * are the existing components: nothing about how the numbers are computed
 * changes here, only where they live.
 *
 * Operations is folded into Overview rather than kept as a tab of its own: what
 * it uniquely showed is revenue by business line, which is what Overview asks
 * for. Its 90-day default was one of the three revenue windows nobody could
 * see, so it now sits under the same heading as the 30-day executive total with
 * both scopes stated — the numbers still differ, but visibly and for a reason.
 */
export default function RevenueAnalyticsPage() {
  const searchParams = useSearchParams();
  const tab = analyticsTab(TAB_ID)!;
  const subTab = resolveSubTab(tab, searchParams.get("tab") ?? undefined);

  return (
    <div className="space-y-6">
      <SubTabBar tabId={TAB_ID} />

      {subTab?.pending ? (
        <PendingSubTab tabLabel={tab.label} subTab={subTab} />
      ) : subTab?.id === "overview" ? (
        <div className="space-y-6">
          <ExecutiveSummary />
          <OperationsView />
          <FinanceDetail />
        </div>
      ) : subTab?.id === "fees" ? (
        <ProductFeesView />
      ) : subTab?.id === "vaults" ? (
        <FeesYieldsView />
      ) : null}
    </div>
  );
}
