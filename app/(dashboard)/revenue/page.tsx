"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExecutiveSummary } from "@/components/revenue/executive-summary";
import { FinanceDetail } from "@/components/revenue/finance-detail";
import { OperationsView } from "@/components/revenue/operations-view";
import { InvestorReport } from "@/components/revenue/investor-report";
import { FeesYieldsView } from "@/components/revenue/fees-yields-view";
import { AnalyticsChartsView } from "@/components/revenue/analytics-charts-view";
import type { DashboardView } from "@/types/revenue";

export default function RevenueDashboardPage() {
  const [activeView, setActiveView] = useState<DashboardView>("executive");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <DollarSign className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revenue Dashboard</h1>
            <p className="text-sm text-gray-500">
              Track yield share and borrowing revenue
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs
        value={activeView}
        onValueChange={(value) => setActiveView(value as DashboardView)}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="executive">Executive</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="fees-yields">Fees & Yields</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="investor">Investor</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="executive" className="mt-0">
            <ExecutiveSummary />
          </TabsContent>

          <TabsContent value="finance" className="mt-0">
            <FinanceDetail />
          </TabsContent>

          <TabsContent value="fees-yields" className="mt-0">
            <FeesYieldsView />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <AnalyticsChartsView />
          </TabsContent>

          <TabsContent value="operations" className="mt-0">
            <OperationsView />
          </TabsContent>

          <TabsContent value="investor" className="mt-0">
            <InvestorReport />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
