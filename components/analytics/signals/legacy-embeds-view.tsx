"use client";

import { useState } from "react";
import MetabaseEmbed from "@/components/metabase-embed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotInstrumented } from "@/components/analytics/not-instrumented";

/**
 * The raw Metabase dashboards, kept until the tabs replacing them ship.
 *
 * The tokens moved out of the bundle and into env: a Metabase public token is
 * an unauthenticated URL, so anyone who reads it can open that dashboard
 * without signing in. A dashboard with no token configured is hidden rather
 * than rendered as a broken iframe.
 *
 * These retire with Phase 2 — Deposits becomes Funnel → Deposits by rail, Card
 * becomes the Card tab, Referrals and Points become Rewards.
 */
interface LegacyDashboard {
  id: string;
  label: string;
  token: string | undefined;
  /** The tab that takes over when this one retires. */
  replacedBy: string;
}

const DASHBOARDS: LegacyDashboard[] = [
  {
    id: "deposits",
    label: "Deposits",
    token: process.env.NEXT_PUBLIC_METABASE_TOKEN_DEPOSITS,
    replacedBy: "Funnel → Deposits by rail",
  },
  {
    id: "card",
    label: "Card",
    token: process.env.NEXT_PUBLIC_METABASE_TOKEN_CARD,
    replacedBy: "the Card tab",
  },
  {
    id: "referrals",
    label: "Referrals",
    token: process.env.NEXT_PUBLIC_METABASE_TOKEN_REFERRALS,
    replacedBy: "Rewards → Referral program",
  },
  {
    id: "points",
    label: "Points",
    token: process.env.NEXT_PUBLIC_METABASE_TOKEN_POINTS,
    replacedBy: "Rewards → Owed & upcoming",
  },
];

export function LegacyEmbedsView() {
  const available = DASHBOARDS.filter((dashboard) => Boolean(dashboard.token));
  const [active, setActive] = useState(available[0]?.id ?? "deposits");

  if (available.length === 0) {
    return (
      <NotInstrumented
        metric="Legacy Metabase embeds"
        reason="No Metabase public tokens are configured. Set NEXT_PUBLIC_METABASE_TOKEN_* in the environment to show these dashboards, or ignore this tab — the panels replacing them are being built out."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        These are the original Metabase dashboards, embedded unchanged. They are
        served through public tokens with no authentication of their own, and
        their numbers use Metabase&apos;s own definitions rather than the
        glossary — so where a figure here disagrees with a tab above, the tab
        above is the one to trust. They retire as each replacement ships.
      </div>

      <Tabs value={active} onValueChange={setActive}>
        <TabsList>
          {available.map((dashboard) => (
            <TabsTrigger key={dashboard.id} value={dashboard.id}>
              {dashboard.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {available.map((dashboard) => (
          <TabsContent key={dashboard.id} value={dashboard.id}>
            <p className="mb-3 text-xs text-gray-500">
              Being replaced by {dashboard.replacedBy}.
            </p>
            <MetabaseEmbed
              publicToken={dashboard.token!}
              type="dashboard"
              height={1000}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default LegacyEmbedsView;
