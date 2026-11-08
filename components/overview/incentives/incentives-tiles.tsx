"use client";

import {
  centsUsd,
  changeVsText,
  earnedCaption,
  previousRangeLabel,
  sentCaption,
  spendCaption,
  splitAmounts,
  splitShares,
  wholeUsd,
} from "@/lib/incentives";
import type { IncentivesResponse } from "@/types/overview";
import { Chip, SplitBar } from "@/components/overview/overview-ui";
import { Tile } from "@/components/overview/kpi-tiles";
import { KIND_COLORS } from "@/components/overview/incentives/incentives-ui";

/**
 * Sent, earned and card spend per incentive dollar for the picked range.
 * Change chips stay grey: more incentives is neither good nor bad news here.
 */
export function IncentivesTiles({ data, compare }: { data: IncentivesResponse; compare: boolean }) {
  const { totals, range } = data;
  const sentChange = compare ? changeVsText(totals.sent.current, totals.sent.previous, range.days) : null;
  const earnedChange = compare
    ? changeVsText(totals.earned.current, totals.earned.previous, range.days)
    : null;
  const perDollar = totals.cardSpendPerIncentiveDollar;

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
      <Tile
        title="Sent to users"
        value={wholeUsd(totals.sent.current)}
        chip={sentChange ? <Chip tone="neutral">{sentChange}</Chip> : null}
        context={sentCaption(data)}
      >
        <SplitBar
          parts={splitShares(totals.sentSplit).map((p) => ({
            label: p.label,
            value: p.value,
            color: KIND_COLORS[p.kind],
          }))}
        />
      </Tile>

      <Tile
        title="Earned, paid later"
        value={wholeUsd(totals.earned.current)}
        chip={earnedChange ? <Chip tone="neutral">{earnedChange}</Chip> : null}
        context={earnedCaption(data)}
      >
        <SplitBar
          parts={splitAmounts(totals.earnedSplit).map((p) => ({
            label: p.label,
            value: p.value,
            color: KIND_COLORS[p.kind],
          }))}
        />
      </Tile>

      <Tile
        title="Card spend per $1 of incentives"
        value={centsUsd(perDollar.current)}
        chip={
          compare && perDollar.previous !== null ? (
            <Chip tone="neutral">
              {centsUsd(perDollar.previous)} {previousRangeLabel(range.days)}
            </Chip>
          ) : null
        }
        context={spendCaption(data)}
      >
        {null}
      </Tile>
    </div>
  );
}
