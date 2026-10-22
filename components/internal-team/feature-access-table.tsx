"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  assignInternalTeamFeature,
  removeInternalTeamFeature,
} from "@/lib/api";
import {
  InternalTeamFeature,
  InternalTeamFeatureKey,
  InternalTeamMember,
} from "@/types";
import {
  MemberCell,
  memberLabel,
} from "@/components/internal-team/members-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmationModal from "@/components/ui/confirmation-modal";

/** After a change: the team page and the member's own audit trail. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient();
  return (userId: string) => {
    void queryClient.invalidateQueries({ queryKey: ["internal-team"] });
    void queryClient.invalidateQueries({
      queryKey: ["user-audit-log", userId],
    });
  };
}

/**
 * Which team-only rollouts each active member gets. Being on the team only
 * makes someone internal; the Wirex EUR account, the Credit & Smart spend
 * modes and the new deposit tokens are each assigned here, one tag per member.
 */
export default function FeatureAccessTable({
  members,
  features,
}: {
  members: InternalTeamMember[];
  features: InternalTeamFeature[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <li
              key={feature.key}
              className="rounded-md border border-gray-200 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">
                  {feature.label}
                </span>
                <Badge variant={feature.teamOnly ? "info" : "muted"}>
                  {feature.teamOnly ? "Tagged members only" : "Open to all"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {feature.description}
                {feature.teamOnly
                  ? ""
                  : " Everyone has it in this environment, so the tag changes nothing here."}
              </p>
            </li>
          ))}
        </ul>

        {members.length === 0 ? (
          <p className="text-sm text-gray-500">
            Add a member above to give them features.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-4">Member</th>
                  <th className="py-2 pr-4">Features</th>
                  <th className="py-2" aria-label="Assign" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((member) => (
                  <FeatureRow
                    key={member.userId}
                    member={member}
                    features={features}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeatureRow({
  member,
  features,
}: {
  member: InternalTeamMember;
  features: InternalTeamFeature[];
}) {
  const assigned = features.filter((feature) =>
    member.features.includes(feature.key)
  );
  const unassigned = features.filter(
    (feature) => !member.features.includes(feature.key)
  );

  return (
    <tr>
      <td className="py-2 pr-4 align-top">
        <MemberCell member={member} />
      </td>
      <td className="py-2 pr-4 align-top">
        {assigned.length === 0 ? (
          <span className="text-gray-400">None</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assigned.map((feature) => (
              <FeatureTag key={feature.key} member={member} feature={feature} />
            ))}
          </div>
        )}
      </td>
      <td className="py-2 text-right align-top">
        {unassigned.length > 0 ? (
          <AssignFeature member={member} options={unassigned} />
        ) : null}
      </td>
    </tr>
  );
}

/**
 * An assigned feature, with its remove button. Removing asks first: it takes
 * the feature away from that person within a minute.
 */
function FeatureTag({
  member,
  feature,
}: {
  member: InternalTeamMember;
  feature: InternalTeamFeature;
}) {
  const [confirming, setConfirming] = useState(false);
  const refresh = useRefreshAfterChange();

  const mutation = useMutation({
    mutationFn: async () =>
      (await removeInternalTeamFeature(member.userId, feature.key)).data.data,
    onSuccess: () => {
      toast.success(`${feature.label} removed from ${memberLabel(member)}`);
      setConfirming(false);
      refresh(member.userId);
    },
  });

  return (
    <>
      <Badge variant="info" className="gap-1 pr-1">
        {feature.label}
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={mutation.isPending}
          className="cursor-pointer rounded p-0.5 hover:bg-indigo-200"
          aria-label={`Remove ${feature.label} from ${memberLabel(member)}`}
        >
          {mutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </button>
      </Badge>
      <ConfirmationModal
        isOpen={confirming}
        title={`Remove ${feature.label}?`}
        message={
          <>
            {memberLabel(member)} loses {feature.label} within a minute. They
            stay on the internal team, and you can assign it again at any time.
          </>
        }
        confirmText="Remove"
        isDestructive
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

/** Pick a feature the member does not have yet, and assign it. */
function AssignFeature({
  member,
  options,
}: {
  member: InternalTeamMember;
  options: InternalTeamFeature[];
}) {
  const [selected, setSelected] = useState<InternalTeamFeatureKey | "">("");
  const refresh = useRefreshAfterChange();

  const mutation = useMutation({
    mutationFn: async (feature: InternalTeamFeatureKey) =>
      (await assignInternalTeamFeature(member.userId, feature)).data.data,
    onSuccess: (_member, feature) => {
      const label =
        options.find((option) => option.key === feature)?.label ?? feature;
      toast.success(`${label} assigned to ${memberLabel(member)}`);
      setSelected("");
      refresh(member.userId);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (selected && !mutation.isPending) mutation.mutate(selected);
      }}
      className="flex items-center justify-end gap-2"
    >
      <select
        value={selected}
        onChange={(event) =>
          setSelected(event.target.value as InternalTeamFeatureKey | "")
        }
        aria-label={`Feature to assign to ${memberLabel(member)}`}
        className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700"
      >
        <option value="">Choose a feature…</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={!selected || mutation.isPending}
        className="cursor-pointer"
      >
        {mutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        Assign
      </Button>
    </form>
  );
}
