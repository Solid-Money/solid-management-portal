"use client";

import { Suspense } from "react";
import { BlockedReferrers } from "@/components/referral-review/blocked-referrers";
import { RecheckPanel } from "@/components/referral-review/recheck-panel";
import { ReviewQueue } from "@/components/referral-review/review-queue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUrlTab } from "@/hooks/use-url-tab";

const TABS = ["queue", "blocked", "recheck"] as const;

/**
 * Growth → Referral Review: the referral rewards that need a person.
 *
 * Nothing here sends money. An approved reward is paid by the next daily
 * payout sweep after the same spend checks as every other reward, and nothing
 * here can stop a payout already in flight.
 */
export default function ReferralReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReferralReviewScreen />
    </Suspense>
  );
}

function ReferralReviewScreen() {
  // In the URL so the admin search can open "Blocked referrers" directly.
  const [tab, setTab] = useUrlTab(TABS, "queue");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Referral Review
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Approve or reject held referral rewards, block referrers, and
          re-check every unpaid reward against today&apos;s rules before the
          02:00 UTC payout. Every decision needs a reason and goes on the
          user&apos;s audit trail.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Review queue</TabsTrigger>
          <TabsTrigger value="blocked">Blocked referrers</TabsTrigger>
          <TabsTrigger value="recheck">Re-check unpaid</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <ReviewQueue />
        </TabsContent>
        <TabsContent value="blocked">
          <BlockedReferrers />
        </TabsContent>
        <TabsContent value="recheck">
          <RecheckPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
