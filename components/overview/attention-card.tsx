"use client";

import { OverviewCard } from "@/components/overview/overview-ui";

/**
 * Needs your attention: the incident radar's items. Until the radar ships
 * this shows its empty state, so the page keeps its final layout.
 */
export function AttentionCard() {
  return (
    <OverviewCard className="px-5 py-4">
      <h2 className="text-[15px] font-semibold text-gray-900">Needs your attention</h2>
      <p className="mt-2 flex items-center gap-2 text-[13px] text-gray-600">
        <span className="size-[7px] rounded-full bg-[#16a34a]" />
        Nothing needs attention
      </p>
    </OverviewCard>
  );
}
