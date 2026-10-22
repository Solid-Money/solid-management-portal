"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { getInternalTeam } from "@/lib/api";
import { InternalTeamRoster } from "@/types";
import AddMemberForm from "@/components/internal-team/add-member-form";
import FeatureAccessTable from "@/components/internal-team/feature-access-table";
import {
  ActiveMembersTable,
  RemovedMembersTable,
} from "@/components/internal-team/members-table";

/**
 * Config → Internal team, in two parts: who counts as Solid staff or a tester
 * (members), and which team-only rollouts each of them gets (feature access).
 *
 * The list used to be hardcoded in the backend, so adding a tester took a
 * deploy and taking off someone who had left took remembering to. It lives in
 * the database now — the old entries carried over and marked Imported — and
 * every change lands on that user's audit trail.
 *
 * Removal is soft: a removed member stays on the page with who removed them and
 * why, one click from being restored.
 */
export default function InternalTeamPage() {
  const { data, isLoading, error } = useQuery<InternalTeamRoster>({
    queryKey: ["internal-team"],
    queryFn: async () => (await getInternalTeam()).data.data,
  });

  const active = data?.members.filter((member) => member.enabled) ?? [];
  const removed = data?.members.filter((member) => !member.enabled) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Internal team</h1>
        <p className="mt-1 text-sm text-gray-500">
          Solid staff and testers. Being a member makes someone internal: they
          get internal-only rewards notifications and are skipped by
          card-waitlist emails. Team-only features — the Wirex EUR account, the
          Credit &amp; Smart spend modes, the EUR vault, the new deposit tokens
          — are assigned to each member separately below. Changes take effect
          within a minute.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Could not load the internal team.
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
        </div>
      ) : null}

      {data ? (
        <>
          <section className="space-y-4" aria-labelledby="team-members">
            <h2
              id="team-members"
              className="text-lg font-semibold text-gray-900"
            >
              1. Team members
            </h2>
            <AddMemberForm />
            <ActiveMembersTable members={active} />
            {removed.length > 0 ? (
              <RemovedMembersTable members={removed} />
            ) : null}
          </section>

          <section className="space-y-4" aria-labelledby="feature-access">
            <div>
              <h2
                id="feature-access"
                className="text-lg font-semibold text-gray-900"
              >
                2. Feature access
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Assign each active member the team-only features they should
                have, or remove a tag to take one away. A member with no tags is
                still on the team.
              </p>
            </div>
            <FeatureAccessTable members={active} features={data.features} />
          </section>
        </>
      ) : null}
    </div>
  );
}
