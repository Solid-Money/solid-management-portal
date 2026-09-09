"use client";

import { useSearchParams } from "next/navigation";
import { SubTabBar } from "@/components/analytics/analytics-header";
import { PendingSubTab } from "@/components/analytics/panel";
import { InvestorReport } from "@/components/revenue/investor-report";
import { analyticsTab, resolveSubTab } from "@/lib/analytics-navigation";

const TAB_ID = "investor";

/**
 * The existing investor report, moved off the old `/revenue` page.
 *
 * Kept working rather than replaced with a Phase 3 placeholder: the report is
 * used monthly, and hiding it until the rest of Analytics lands would have been
 * a regression dressed up as a roadmap. The spec's changes to it — CAC and LTV
 * computed from real cost inputs rather than defaults, and YoY hidden until
 * twelve months of data exist — depend on the cost inputs under Config → Costs
 * and on the per-user P&L, so they follow in a later phase.
 */
export default function InvestorAnalyticsPage() {
  const searchParams = useSearchParams();
  const tab = analyticsTab(TAB_ID)!;
  const subTab = resolveSubTab(tab, searchParams.get("tab") ?? undefined);

  return (
    <div className="space-y-6">
      <SubTabBar tabId={TAB_ID} />

      {subTab?.pending ? (
        <PendingSubTab tabLabel={tab.label} subTab={subTab} />
      ) : (
        <InvestorReport />
      )}
    </div>
  );
}
