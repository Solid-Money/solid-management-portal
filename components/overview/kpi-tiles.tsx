"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { change, compactUsd, formatCount, formatRatio } from "@/lib/overview-format";
import type { OverviewKpis, OverviewResponse } from "@/types/overview";
import {
  ChangeChip,
  Chip,
  OVERVIEW_ACCENT,
  OverviewCard,
  Sparkline,
  SplitBar,
} from "@/components/overview/overview-ui";
import { analyticsHref } from "@/components/overview/overview-links";

const SPARK_DAYS = 14;

/**
 * The six numbers at the top of the page. Each tile is the link to the list
 * behind it, so a number that looks wrong is one click from its rows.
 */
export function KpiTiles({
  data,
  compare,
}: {
  data: OverviewResponse;
  compare: boolean;
}) {
  const { kpis, range } = data;
  const highlight = Math.min(range.days, SPARK_DAYS);
  const spend = kpis.cardSpend;
  const decline = kpis.declineRate;
  const costRatio = kpis.rewardsCost.costToRevenue;

  return (
    <div className="grid grid-cols-1 gap-3.5 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      <Tile
        title="Card spend"
        href={analyticsHref("card", "spending", range)}
        value={compactUsd(spend.usd.current)}
        chip={compare ? <ChangeChip change={change(spend.usd.current, spend.usd.previous)} /> : null}
        context={`${formatCount(spend.payments.current)} payments · avg ${
          spend.averageUsd.current === null ? "—" : `$${spend.averageUsd.current.toFixed(2)}`
        }`}
      >
        <Sparkline values={spend.sparkline} highlight={highlight} />
      </Tile>

      <Tile
        title="Active spenders"
        href={analyticsHref("card", "spending", range)}
        value={formatCount(kpis.activeSpenders.count.current)}
        chip={
          compare ? (
            <ChangeChip
              change={change(kpis.activeSpenders.count.current, kpis.activeSpenders.count.previous)}
            />
          ) : null
        }
        context={`Cards with a settled purchase${
          compare ? ` (was ${formatCount(kpis.activeSpenders.count.previous)})` : ""
        }`}
      >
        <Sparkline values={kpis.activeSpenders.sparkline} highlight={highlight} />
      </Tile>

      <Tile
        title="New sign-ups"
        href={analyticsHref("growth", "users", range)}
        value={formatCount(kpis.signUps.count.current)}
        chip={
          compare ? (
            <ChangeChip change={change(kpis.signUps.count.current, kpis.signUps.count.previous)} />
          ) : null
        }
        context={`Real accounts only. ${formatCount(kpis.signUps.deleted.current)} more ${
          kpis.signUps.deleted.current === 1 ? "was" : "were"
        } deleted`}
      >
        <Sparkline values={kpis.signUps.sparkline} highlight={highlight} />
      </Tile>

      <Tile
        title="Revenue"
        href={analyticsHref("revenue", "overview", range)}
        value={compactUsd(kpis.revenue.usd.current)}
        chip={
          compare ? (
            <ChangeChip change={change(kpis.revenue.usd.current, kpis.revenue.usd.previous)} />
          ) : null
        }
        context="Excludes treasury interest and partner card markups"
      >
        <SplitBar
          parts={[
            { label: `Prime ${compactUsd(kpis.revenue.primeUsd.current)}`, value: kpis.revenue.primeUsd.current, color: OVERVIEW_ACCENT },
            { label: `Fees ${compactUsd(kpis.revenue.feesUsd.current)}`, value: kpis.revenue.feesUsd.current, color: "#a3a7ee" },
          ]}
        />
      </Tile>

      <Tile
        title="Rewards cost"
        href={analyticsHref("rewards", null, range)}
        value={compactUsd(kpis.rewardsCost.usd.current)}
        chip={
          costRatio !== null ? (
            <Chip tone={costRatio > 1 ? "bad" : "good"}>
              {costRatio >= 10 ? Math.round(costRatio) : costRatio.toFixed(1)}× revenue
            </Chip>
          ) : null
        }
        context="Cashback paid and still owed on purchases in the range"
      >
        <SplitBar
          parts={[
            { label: "Revenue", value: kpis.revenue.usd.current, color: OVERVIEW_ACCENT },
            { label: "Cashback", value: kpis.rewardsCost.usd.current, color: "#f2a5a5" },
          ]}
        />
      </Tile>

      <Tile
        title="Card decline rate"
        href={analyticsHref("card", "declines", range)}
        value={formatRatio(decline.rate.current)}
        chip={
          decline.status === "spike" ? (
            <Chip tone="bad">Spike</Chip>
          ) : (
            <Chip tone="neutral">Steady</Chip>
          )
        }
        context={declineContext(decline)}
      >
        <Sparkline values={decline.sparkline} highlight={highlight} color="#6b7280" />
      </Tile>
    </div>
  );
}

function Tile({
  title,
  href,
  value,
  chip,
  context,
  children,
}: {
  title: string;
  href: string;
  value: string;
  chip: ReactNode;
  context: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="group block">
      <OverviewCard className="flex h-full flex-col gap-1.5 px-4 pt-4 pb-3 transition-shadow group-hover:shadow-sm">
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[26px] leading-none font-semibold tracking-[-0.5px] text-gray-900">
            {value}
          </span>
          {chip}
        </div>
        <p className="min-h-[31px] text-[11.5px] leading-[15.5px] text-gray-500">{context}</p>
        <div className="mt-auto">{children}</div>
      </OverviewCard>
    </Link>
  );
}

/** "397–492 declines a day, no spike. Rain 84% · Wirex 18%" */
function declineContext(decline: OverviewKpis["declineRate"]): string {
  const perDay = decline.dailyDeclines
    ? decline.dailyDeclines.min === decline.dailyDeclines.max
      ? `${formatCount(decline.dailyDeclines.min)} declines a day`
      : `${formatCount(decline.dailyDeclines.min)}–${formatCount(decline.dailyDeclines.max)} declines a day`
    : null;
  const spike =
    decline.status === "spike"
      ? `spike on ${decline.spikeDays.length} day${decline.spikeDays.length === 1 ? "" : "s"}`
      : "no spike";
  const providers = decline.byProvider
    .filter((p) => p.attempts.current > 0)
    .map((p) => `${p.provider === "rain" ? "Rain" : "Wirex"} ${formatRatio(p.rate.current)}`)
    .join(" · ");
  return `${[perDay, spike].filter(Boolean).join(", ")}. ${providers}`.trim();
}
