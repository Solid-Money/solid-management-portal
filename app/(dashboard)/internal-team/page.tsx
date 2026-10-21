"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { getInternalTeam } from "@/lib/api";
import { InternalTeamRoster } from "@/types";
import AddMemberForm from "@/components/internal-team/add-member-form";
import {
  ActiveMembersTable,
  RemovedMembersTable,
} from "@/components/internal-team/members-table";
import { Badge } from "@/components/ui/badge";

/**
 * Config → Internal team: who counts as Solid staff or a tester.
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
          Solid staff and testers, who get team-only features and new rollouts
          first: the Wirex EUR account while it is staged to the team,
          internal-only rewards notifications and new Wirex card spend modes.
          Members are also skipped by card-waitlist emails. Changes take effect
          within a minute.
        </p>
        {data ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <Badge variant={data.virtualAccountTeamOnly ? "info" : "muted"}>
              Wirex EUR account:{" "}
              {data.virtualAccountTeamOnly ? "team only" : "open to all"}
            </Badge>
            <span>
              {data.virtualAccountTeamOnly
                ? "Only members get it in this environment."
                : "Not limited to members in this environment, so membership makes no difference to it."}
            </span>
          </div>
        ) : null}
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
          <AddMemberForm />
          <ActiveMembersTable members={active} />
          {removed.length > 0 ? (
            <RemovedMembersTable members={removed} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
