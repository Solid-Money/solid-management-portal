"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { restoreInternalTeamMember } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { InternalTeamMember } from "@/types";
import RemoveMemberDialog from "@/components/internal-team/remove-member-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const shortDate = (value?: string) =>
  value
    ? formatDateTime(value, { month: "short", day: "numeric", year: "numeric" })
    : "—";

/** How to name a member in a toast or a dialog, account or not. */
const memberLabel = (member: InternalTeamMember) =>
  member.username ?? member.userId;

/**
 * The member's account as a link to their page, or their bare id once the
 * account is gone — a link there would only lead to an error.
 */
function MemberCell({ member }: { member: InternalTeamMember }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {member.userExists ? (
        <Link
          href={`/users/${member.userId}`}
          className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
          title={member.username ? undefined : member.userId}
        >
          {member.username ?? member.userId}
        </Link>
      ) : (
        <span className="font-mono text-xs text-gray-500">{member.userId}</span>
      )}
      {!member.userExists && <Badge variant="warning">User not found</Badge>}
      {member.source === "imported" && <Badge variant="muted">Imported</Badge>}
    </div>
  );
}

/** Who is on the internal team now, newest first. */
export function ActiveMembersTable({
  members,
}: {
  members: InternalTeamMember[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active members ({members.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nobody is on the internal team. Add someone above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Country</th>
                  <th className="py-2 pr-4">Note</th>
                  <th className="py-2 pr-4">Added by</th>
                  <th className="py-2 pr-4">Added</th>
                  <th className="py-2" aria-label="Remove" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((member) => (
                  <tr key={member.userId}>
                    <td className="py-2 pr-4">
                      <MemberCell member={member} />
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {member.email || "—"}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {member.country || "—"}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">
                      {member.note || "—"}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">
                      {member.addedBy || "—"}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-gray-500">
                      {shortDate(member.createdAt)}
                    </td>
                    <td className="py-2 text-right">
                      <RemoveMemberDialog
                        userId={member.userId}
                        username={memberLabel(member)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Who was taken off the team, by whom and why — kept so a removal can be
 * undone, and so "why did my team-only features disappear?" has an answer.
 */
export function RemovedMembersTable({
  members,
}: {
  members: InternalTeamMember[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-gray-500">
          Removed ({members.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase text-gray-500">
                <th className="py-2 pr-4">Username</th>
                <th className="py-2 pr-4">Removed by</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4">Removed</th>
                <th className="py-2" aria-label="Restore" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-500">
              {members.map((member) => (
                <tr key={member.userId}>
                  <td className="py-2 pr-4">
                    <MemberCell member={member} />
                  </td>
                  <td className="py-2 pr-4">{member.removedBy || "—"}</td>
                  <td className="py-2 pr-4 whitespace-pre-line">
                    {member.removedReason || "—"}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {shortDate(member.removedAt)}
                  </td>
                  <td className="py-2 text-right">
                    <RestoreMemberButton member={member} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Put a removed member straight back. No dialog: it only undoes a removal that
 * already has its reason on record, and the restore is audited in turn.
 */
function RestoreMemberButton({ member }: { member: InternalTeamMember }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () =>
      (await restoreInternalTeamMember(member.userId)).data.data,
    onSuccess: () => {
      toast.success(`${memberLabel(member)} is back on the internal team`);
      void queryClient.invalidateQueries({ queryKey: ["internal-team"] });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", member.userId],
      });
    },
  });

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="cursor-pointer"
    >
      {mutation.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5" />
      )}
      Restore
    </Button>
  );
}
