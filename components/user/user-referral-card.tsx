"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Users } from "lucide-react";

import { getUserReferrals } from "@/lib/api";
import {
  referralStatus,
  reversalReasonLabel,
  spendAgainstBar,
  spendBreakdown,
} from "@/lib/referral";
import { formatDateTime, formatUsd } from "@/lib/utils";
import { AdminReferralRewardRow, AdminUserReferrals } from "@/types";
import ReevaluateReferralDialog from "@/components/user/reevaluate-referral-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const shortDate = (value?: string) =>
  value
    ? formatDateTime(value, { month: "short", day: "numeric", year: "numeric" })
    : "—";

/** The one line that says where a reward stands and what happens next. */
function statusDetail(row: AdminReferralRewardRow): string | null {
  switch (row.status) {
    case "qualified":
      return row.payoutEtaAt
        ? `Pays ${formatDateTime(row.payoutEtaAt)}`
        : "Waiting out the payout delay";
    case "paid":
      return row.paidAt ? `Paid ${shortDate(row.paidAt)}` : "Paid";
    case "reversed":
      return `${reversalReasonLabel(row.reversalReason)}${
        row.reversedAt ? ` · ${shortDate(row.reversedAt)}` : ""
      }`;
    case "under_review":
      return row.reviewReason === "velocity_over_monthly_threshold"
        ? "Held: referrer over the monthly auto-review threshold"
        : "Held for review";
    case "expired":
      return "Window closed without clearing the bar";
    default:
      return null;
  }
}

function StatusCell({ row }: { row: AdminReferralRewardRow }) {
  const status = referralStatus(row.status);
  const detail = statusDetail(row);

  return (
    <div className="space-y-0.5">
      <Badge variant={status.variant}>{status.label}</Badge>
      {detail && <p className="text-[11px] text-gray-500">{detail}</p>}
      {row.reinstatedAt && (
        <p className="text-[11px] text-emerald-700">
          Reinstated by {row.reinstatedBy ?? "an admin"} ·{" "}
          {shortDate(row.reinstatedAt)}
        </p>
      )}
      {row.payoutTxUrl && (
        <a
          href={row.payoutTxUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[11px] text-indigo-600 hover:text-indigo-800"
        >
          Payout <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

/** Program terms in one line, read live from config. */
function termsLine(program: AdminUserReferrals["program"]): string {
  return (
    `${formatUsd(program.referrerRewardUsd, 0)} + ${formatUsd(
      program.newUserRewardUsd,
      0
    )} for ${formatUsd(program.spendTargetUsd, 0)} across ` +
    `${program.merchantTarget} merchants in ${program.qualifyWindowDays} days · ` +
    `paid ${program.payoutDelayDays} days after qualifying`
  );
}

/**
 * Referral cashback from both sides of the program: the reward this user
 * earns as someone's referred friend, and one row per friend they invited.
 *
 * Each row is measured against its own bar — a friend who qualified before the
 * target moved to $150 cleared $75, and reads that way here as in the app.
 * Reversed and expired rewards carry a Re-evaluate action that puts them back
 * through the rules, for the ones the engine got wrong.
 */
export default function UserReferralCard({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery<{ data: AdminUserReferrals }>({
    queryKey: ["user-referrals", userId],
    queryFn: async () => (await getUserReferrals(userId)).data,
  });

  const referrals = data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          Referral cashback
        </CardTitle>
        {referrals && !referrals.program.enabled && (
          <Badge variant="warning">Payouts paused</Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : error || !referrals ? (
          <p className="text-sm text-red-600">
            Failed to load referral rewards.
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-gray-500">
              {termsLine(referrals.program)}
            </p>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-gray-500">
                As a referred friend
              </h3>
              {referrals.invitedBy ? (
                <InvitedByRow
                  row={referrals.invitedBy}
                  pageUserId={userId}
                />
              ) : (
                <p className="text-sm text-gray-500">
                  Not referred, or not tracked by the referral engine.
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-gray-500">
                Friends invited ({referrals.friends.length})
              </h3>
              {referrals.friends.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nobody has signed up with this user&apos;s code yet.
                </p>
              ) : (
                <div className="max-h-96 overflow-auto rounded-lg border border-gray-100">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Friend
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Joined
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Spend against bar
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Status
                        </th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {referrals.friends.map((row) => (
                        <tr key={row.referredUserId} className="align-top">
                          <td className="px-3 py-2">
                            <Link
                              href={`/users/${row.referredUserId}`}
                              className="font-medium text-indigo-600 hover:underline"
                            >
                              {row.username || row.referredUserId}
                            </Link>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                            {shortDate(row.signupAt)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {spendAgainstBar(
                              row.spendUsd,
                              row.spendTargetUsd,
                              row.merchantCount,
                              row.merchantTarget
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <StatusCell row={row} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <ReevaluateReferralDialog
                              reward={row}
                              friendLabel={row.username || "this friend"}
                              pageUserId={userId}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** This user's own reward, with its spend read live. */
function InvitedByRow({
  row,
  pageUserId,
}: {
  row: NonNullable<AdminUserReferrals["invitedBy"]>;
  pageUserId: string;
}) {
  const spend = row.liveSpend;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gray-100 p-3 text-xs">
      <div className="space-y-1">
        <p className="text-gray-700">
          Invited by{" "}
          <Link
            href={`/users/${row.referrerId}`}
            className="font-mono text-indigo-600 hover:underline"
          >
            {row.referrerId}
          </Link>{" "}
          · joined {shortDate(row.signupAt)}
        </p>
        <p className="text-gray-700">
          {spend
            ? spendAgainstBar(
                spend.netSpendUsd,
                row.spendTargetUsd,
                spend.merchantCount,
                row.merchantTarget
              )
            : spendAgainstBar(
                row.spendUsd,
                row.spendTargetUsd,
                row.merchantCount,
                row.merchantTarget
              )}
          {spend && spend.refundedSpendUsd > 0 && (
            <span className="text-gray-500"> ({spendBreakdown(spend)})</span>
          )}
          {!spend && (
            <span className="text-gray-400"> · last recorded, not live</span>
          )}
        </p>
        <StatusCell row={row} />
      </div>
      <ReevaluateReferralDialog
        reward={row}
        friendLabel="this user"
        pageUserId={pageUserId}
      />
    </div>
  );
}
