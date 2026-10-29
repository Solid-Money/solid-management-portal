"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  DEBT_RECOVERY_VIA_LABELS,
  formatUtc,
  formatUtcDay,
  referralV4DebtStatus,
  referralV4StepLabel,
} from "@/lib/referral-v4";
import { formatUsd } from "@/lib/utils";
import type { AdminReferralV4Debt } from "@/types/referral-v4";
import WriteOffReferralV4DebtDialog from "@/components/user/write-off-referral-v4-debt-dialog";
import UserLink from "@/components/user-link";
import { Badge } from "@/components/ui/badge";

/** What came back on one debt: when, how much, and from which payout. */
function Recoveries({ debt }: { debt: AdminReferralV4Debt }) {
  const recoveries = debt.recoveries ?? [];
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-gray-500">
        Reversed reward{" "}
        <span className="font-mono text-gray-700" title={debt.rewardId}>
          {debt.rewardId || "—"}
        </span>
      </p>
      {recoveries.length === 0 ? (
        <p className="text-xs text-gray-500">Nothing recovered yet.</p>
      ) : (
        <table className="min-w-full text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Date (UTC)</th>
              <th className="px-2 py-1 text-right font-medium">Recovered</th>
              <th className="px-2 py-1 text-left font-medium">From</th>
              <th className="px-2 py-1 text-left font-medium">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recoveries.map((recovery, index) => (
              <tr key={`${recovery.ref}:${recovery.at}:${index}`}>
                <td className="px-2 py-1.5 whitespace-nowrap text-gray-500">
                  {formatUtc(recovery.at)}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium text-emerald-700">
                  {formatUsd(recovery.usd)}
                </td>
                <td className="px-2 py-1.5 text-gray-700">
                  {DEBT_RECOVERY_VIA_LABELS[recovery.via] ?? recovery.via}
                </td>
                <td
                  className="px-2 py-1.5 font-mono text-[10px] text-gray-400"
                  title={recovery.ref}
                >
                  {recovery.ref || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * What this user owes from reversed referral v4 bonuses: a credited welcome
 * or big-spender bonus whose qualifying spend was later refunded below the
 * bar. Each debt is recovered from the user's future v4 bonuses and weekly
 * spend share — never from their card credit — and closes when recovered,
 * waived (the remainder fell below the waive threshold), or written off, by
 * age or by hand.
 *
 * A row expands to its recoveries. Open debts carry Write off for the admins
 * who can review referral rewards.
 */
export default function ReferralV4DebtsSection({
  debts,
  canWriteOff,
}: {
  debts: AdminReferralV4Debt[];
  canWriteOff: boolean;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const open = debts.filter((debt) => debt.status === "open");
  const owed = open.reduce(
    (sum, debt) => sum + (Number(debt.remainingUsd) || 0),
    0,
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase text-gray-500">
          Referral debts
        </h3>
        {debts.length > 0 && (
          <span
            className={`text-[11px] ${
              owed > 0 ? "text-amber-700" : "text-gray-500"
            }`}
          >
            {open.length} open · {formatUsd(owed)} still owed
          </span>
        )}
      </div>
      {debts.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing owed — none of this user&apos;s credited bonuses has been
          reversed.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-gray-500">
            Credited bonuses reversed after a refund took their spend below the
            bar. Recovered from this user&apos;s future v4 bonuses and weekly
            spend share — never from their card credit.
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-gray-100">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
                <tr>
                  <th className="w-6 px-2 py-2" />
                  <th className="px-3 py-2 text-left font-medium">Bonus</th>
                  <th className="px-3 py-2 text-left font-medium">Side</th>
                  <th className="px-3 py-2 text-left font-medium">Friend</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-right font-medium">Remaining</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Booked (UTC)
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Write-off</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {debts.map((debt) => {
                  const isExpanded = expanded.has(debt.id);
                  const status = referralV4DebtStatus(debt.status);
                  const isOpen = debt.status === "open";
                  return (
                    <Fragment key={debt.id}>
                      <tr
                        className="cursor-pointer align-top hover:bg-gray-50"
                        onClick={() => toggle(debt.id)}
                      >
                        <td className="px-2 py-2 text-gray-400">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {referralV4StepLabel(debt.step)}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {debt.side ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <UserLink
                            userId={debt.friend?.id}
                            username={debt.friend?.username}
                          />
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-gray-700">
                          {formatUsd(debt.amountUsd)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right whitespace-nowrap font-medium ${
                            isOpen && debt.remainingUsd > 0
                              ? "text-amber-700"
                              : "text-gray-900"
                          }`}
                        >
                          {formatUsd(debt.remainingUsd)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                          {formatUtcDay(debt.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {isOpen ? (
                            <span className="whitespace-nowrap">
                              auto {formatUtcDay(debt.writeOffAt)}
                            </span>
                          ) : (
                            <>
                              <p className="whitespace-nowrap">
                                {debt.closedAt
                                  ? `closed ${formatUtcDay(debt.closedAt)}`
                                  : "—"}
                              </p>
                              {debt.closedBy && (
                                <p className="text-[11px] text-gray-600">
                                  by {debt.closedBy}
                                </p>
                              )}
                            </>
                          )}
                        </td>
                        {/* The dialog renders in a portal, but its clicks still
                            bubble through React to this row; stop them here so
                            they don't toggle it. */}
                        <td
                          className="px-3 py-2 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {canWriteOff && isOpen && (
                            <WriteOffReferralV4DebtDialog debt={debt} />
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/60">
                          <td />
                          <td className="px-3 py-2" colSpan={9}>
                            <Recoveries debt={debt} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
