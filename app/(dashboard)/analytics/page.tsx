"use client";

import MetabaseEmbed from "@/components/metabase-embed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DASHBOARDS = [
  {
    id: "deposits",
    label: "Deposits",
    token: "bc074343-5b55-42e6-8e66-1f06b6358617",
  },
  {
    id: "card",
    label: "Card",
    token: "aac6212e-a872-4dd8-93d0-01fe0b5849ff",
  },
  {
    id: "referrals",
    label: "Referrals",
    token: "5764cc51-e8e4-4309-b077-65f9588328ac",
  },
] as const;

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Real-time insights for your dashboard.
          </p>
        </div>
      </div>

      <Tabs defaultValue="deposits">
        <TabsList>
          {DASHBOARDS.map((dashboard) => (
            <TabsTrigger key={dashboard.id} value={dashboard.id}>
              {dashboard.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {DASHBOARDS.map((dashboard) => (
          <TabsContent key={dashboard.id} value={dashboard.id}>
            <MetabaseEmbed
              publicToken={dashboard.token}
              type="dashboard"
              height={1000}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
