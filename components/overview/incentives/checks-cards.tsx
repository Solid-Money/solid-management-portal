"use client";

import { checkChip, checkValue } from "@/lib/incentives";
import type { IncentivesResponse } from "@/types/overview";
import { Chip, OverviewCard, SectionHeader } from "@/components/overview/overview-ui";

/** Whether the money went where the records say, one row per check. */
export function ChecksCard({ data }: { data: IncentivesResponse }) {
  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader title="Checks" subtitle="Is the money going where the records say?" />
      <div className="mt-3 flex flex-col">
        {data.checks.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-gray-500">No checks have run yet.</p>
        ) : (
          data.checks.map((check) => {
            const chip = checkChip(check.status);
            return (
              <div
                key={check.key}
                className="flex items-center gap-3 border-b border-[#eef0f3] py-1.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-4 font-medium text-gray-900">{check.label}</p>
                  <p className="text-[11.5px] leading-[15.5px] text-gray-500">{check.detail}</p>
                </div>
                <span className="text-[15px] font-semibold whitespace-nowrap text-gray-900">
                  {checkValue(check)}
                </span>
                <Chip tone={chip.tone}>{chip.label}</Chip>
              </div>
            );
          })
        )}
      </div>
    </OverviewCard>
  );
}

/** Costs that look like incentives but stay out of the totals, so nobody adds them by hand. */
export function NotCountedCard({ data }: { data: IncentivesResponse }) {
  if (data.notIncluded.length === 0) return null;
  return (
    <OverviewCard className="p-5">
      <SectionHeader title="Not counted here" subtitle="Costs that look like incentives but aren't in the totals" />
      <ul className="mt-3 text-[12.5px] leading-[18px]">
        {data.notIncluded.map((item) => (
          <li
            key={item.key}
            className="grid gap-x-4 border-b border-[#eef0f3] py-[7px] last:border-b-0 sm:grid-cols-[26%_20%_minmax(0,1fr)]"
          >
            <span className="font-medium text-gray-900">{item.label}</span>
            <span className="text-gray-700">{item.size}</span>
            <span className="text-gray-500">{item.why}</span>
          </li>
        ))}
      </ul>
    </OverviewCard>
  );
}
