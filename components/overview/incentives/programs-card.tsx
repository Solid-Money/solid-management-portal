"use client";

import { keepTogether, programRows, sharePercent, shortSpan, wholeUsd } from "@/lib/incentives";
import { formatCount } from "@/lib/overview-format";
import type { IncentivesResponse } from "@/types/overview";
import { OverviewCard, SectionHeader } from "@/components/overview/overview-ui";
import { INCENTIVE_COLORS } from "@/components/overview/incentives/incentives-ui";

const BAR_COLORS = {
  cashback: INCENTIVE_COLORS.cashback,
  referrals: INCENTIVE_COLORS.referrals,
  other: INCENTIVE_COLORS.perks,
} as const;

/**
 * "Where it went": one row per program the backend lists, in its order. A
 * program with nothing sent or earned in the range is left out, so programs
 * that have not started stay hidden until they have money.
 */
export function ProgramsCard({ data }: { data: IncentivesResponse }) {
  const { rows, total } = programRows(data.programs);
  const head = "py-1.5 text-[10.5px] font-semibold tracking-[0.4px] text-gray-400 uppercase";
  const year = (data.range.today ?? data.generatedAt).slice(0, 4);
  const hasCorrections = rows.some((r) => r.key === "payout_corrections");

  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader
        title="Where it went"
        subtitle={`${keepTogether(shortSpan(data.range.from, data.range.to, year))}, by type`}
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[460px] text-[12.5px]">
          <thead>
            <tr className="border-b border-[#eef0f3] text-left">
              <th className={`pr-3 ${head}`}>Type</th>
              <th className={`pr-3 text-right ${head}`}>Sent</th>
              <th className={`pr-3 text-right ${head}`}>Earned</th>
              <th className={`pr-3 text-right ${head}`}>Payments</th>
              <th className={`pl-1 ${head}`}>Share of sent</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-b border-[#eef0f3]">
                <td colSpan={5} className="py-6 text-center text-gray-500">
                  Nothing sent or earned in this range.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="h-[30px] border-b border-[#eef0f3]">
                  <td className="py-1.5 pr-3 font-medium whitespace-nowrap text-gray-900">{row.label}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-700">{wholeUsd(row.sentUsd)}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-700">
                    {row.earnedUsd === null ? <Dash /> : wholeUsd(row.earnedUsd)}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-700">
                    {row.payments === null ? <Dash /> : formatCount(row.payments)}
                  </td>
                  <td className="py-1.5 pl-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full min-w-12 overflow-hidden rounded-full bg-[#f1f2f6]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max((row.share ?? 0) * 100, 0)}%`,
                            background: BAR_COLORS[row.kind],
                          }}
                        />
                      </div>
                      <span className="w-11 shrink-0 text-right text-gray-700">{sharePercent(row.share)}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="h-[30px] font-semibold text-gray-900">
                <td className="py-1.5 pr-3">Total</td>
                <td className="py-1.5 pr-3 text-right">{wholeUsd(total.sentUsd)}</td>
                <td className="py-1.5 pr-3 text-right">{wholeUsd(total.earnedUsd)}</td>
                <td className="py-1.5 pr-3" />
                <td className="py-1.5 pl-1 text-right">{total.sentUsd > 0 ? "100%" : "—"}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p className="mt-3 text-[11.5px] leading-[15.5px] text-gray-500">
        Payments: one transfer each; a referral reward is two (friend and referrer).
        {hasCorrections ? " Corrections = paid on-chain beyond the recorded amounts; see Checks." : ""}
      </p>
    </OverviewCard>
  );
}

function Dash() {
  return <span className="text-gray-300">—</span>;
}
