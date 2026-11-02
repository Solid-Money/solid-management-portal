"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { getInternalTeam } from "@/lib/api";
import { InternalTeamRoster } from "@/types";
import AddMemberForm from "@/components/internal-team/add-member-form";
import CollapsibleSection from "@/components/internal-team/collapsible-section";
import FeatureAccessTable from "@/components/internal-team/feature-access-table";
import {
  ActiveMembersTable,
  RemovedMembersTable,
} from "@/components/internal-team/members-table";
import AdminTeamSection from "@/components/admin-access/admin-team-section";
import ApprovalRulesSection from "@/components/admin-access/approval-rules-section";

/**
 * Config → Internal team, in four parts, each closed until opened:
 *
 * 1–2. The app side: who counts as Solid staff or a tester (members, by app
 *      username), and which team-only rollouts each of them gets.
 * 3–4. The portal side, a separate system: who may sign in to this portal at
 *      what rank (admin access), and which portal actions need another admin's
 *      approval (approval rules).
 *
 * The member list used to be hardcoded in the backend, so adding a tester took
 * a deploy and taking off someone who had left took remembering to. It lives in
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

  const appSection = (children: React.ReactNode) =>
    error ? (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Could not load the internal team.
      </div>
    ) : isLoading || !data ? (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
      </div>
    ) : (
      children
    );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Internal team</h1>
        <p className="mt-1 text-sm text-gray-500">
          The first two sections are about app accounts: Solid staff and
          testers, by app username, and the team-only features each gets. The
          last two are a separate system about this portal: who can sign in to
          it at what rank, and which actions here need another admin&apos;s
          approval. Open a section to see and change it.
        </p>
      </div>

      <CollapsibleSection
        id="team-members"
        title="1. Team members"
        summary={
          data
            ? `${active.length} app accounts on the internal team${removed.length ? `, ${removed.length} removed` : ""}. Members get internal-only rewards notifications and are skipped by card-waitlist emails.`
            : "App accounts on the internal team: internal-only notifications, skipped by card-waitlist emails."
        }
      >
        {appSection(
          <>
            <AddMemberForm />
            <ActiveMembersTable members={active} />
            {removed.length > 0 ? (
              <RemovedMembersTable members={removed} />
            ) : null}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="feature-access"
        title="2. Feature access"
        summary="Which team-only features — the Wirex EUR account, the Credit & Smart spend modes, the new deposit tokens — each active member gets. Changes take effect within a minute."
      >
        {appSection(
          <>
            <p className="text-sm text-gray-500">
              Assign each active member the team-only features they should
              have, or remove a tag to take one away. A member with no tags is
              still on the team.
            </p>
            {data ? (
              <FeatureAccessTable members={active} features={data.features} />
            ) : null}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="admin-access"
        title="3. Admin access"
        summary="Who can sign in to this portal, and at what rank — rank 1 has the most access, rank 4 the least. A company Google account alone is not enough; removing a rank ends access within seconds."
      >
        <AdminTeamSection />
      </CollapsibleSection>

      <CollapsibleSection
        id="approval-rules"
        title="4. Approval rules"
        summary="Which portal actions wait for another admin's approval before they run, how many approvals, from which ranks, and which ranks may start them. Requests wait under Activity → Approvals."
      >
        <ApprovalRulesSection />
      </CollapsibleSection>
    </div>
  );
}
