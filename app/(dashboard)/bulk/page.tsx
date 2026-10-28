"use client";

import { CircleDollarSign, Layers, Sparkles } from "lucide-react";

import BulkSection from "@/components/bulk/bulk-section";
import StuckCashbackBulk from "@/components/bulk/stuck-cashback-bulk";
import TierTrialsBulk from "@/components/bulk/tier-trials-bulk";

/**
 * Config → Bulk: the jobs that act on many users at once.
 *
 * Each one used to be either its own page (tier trials) or a button on every
 * user's profile (re-sending failed cashback), and an incident that touches two
 * hundred users is two hundred profiles. Gathering them here keeps every
 * many-users action in one place, each behind a closed section so nothing
 * loads — or gets pressed — until the operator opens the one they came for.
 */
export default function BulkPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Layers className="h-5 w-5 text-gray-400" />
          Bulk
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Actions that run across many users at once. Open a section to load
          it; every action is recorded on each affected user&apos;s audit
          trail under your name.
        </p>
      </div>

      <div className="space-y-3">
        <BulkSection
          id="stuck-cashback"
          title="Stuck cashback"
          description="Cashback that gave up after five payout attempts — pick rows, or all of them, and send them back to the payout queue"
          icon={CircleDollarSign}
        >
          {(open) => <StuckCashbackBulk open={open} />}
        </BulkSection>

        <BulkSection
          id="tier-trials"
          title="Tier trials"
          description="Gift Prime or Ultra to a list of usernames at once"
          icon={Sparkles}
        >
          {() => <TierTrialsBulk />}
        </BulkSection>
      </div>
    </div>
  );
}
