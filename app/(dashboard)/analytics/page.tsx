"use client";

import MetabaseEmbed from "@/components/metabase-embed";

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

      <div className="grid gap-8">
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Dashboard Overview</h2>
          <MetabaseEmbed 
            publicToken="5764cc51-e8e4-4309-b077-65f9588328ac" 
            type="dashboard" 
            height={1000} 
          />
        </div>
      </div>
    </div>
  );
}
