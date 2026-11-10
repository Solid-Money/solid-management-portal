"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buyerTotals,
  buyersBars,
  buyersTrend,
  memberTotals,
  perSpender,
  share,
  tiersOf,
} from "@/lib/good-customers";
import { compactUsd, formatCount, formatRatio } from "@/lib/overview-format";
import { dayLabel } from "@/lib/overview-range";
import type {
  GoodCustomersResponse,
  GoodCustomersRouteRow,
  GoodCustomersTierRow,
  GoodCustomersTiers,
} from "@/types/overview";
import { Chip, OVERVIEW_ACCENT, OverviewCard, SectionHeader, SplitBar } from "@/components/overview/overview-ui";
import { Tile } from "@/components/overview/kpi-tiles";

const TIER_MID = "#8b8fea";
const TIER_LIGHT = "#c7cbf5";
const TIER_TRACK = "#e3e5fb";
const CORE_GREY = "#b8bcc6";

const TIER_LABELS: Record<GoodCustomersTierRow["tier"], string> = {
  ultra: "Ultra",
  prime: "Prime",
  core: "Core",
};

/**
 * The Customers tab's Tiers section: who holds Prime or Ultra, how they got
 * it, and how they use the card next to everyone else. Same window and rules
 * as the rest of the tab.
 */
export function TiersSection({ data }: { data: GoodCustomersResponse }) {
  const tiers = tiersOf(data);
  return (
    <div className="flex flex-col gap-3.5 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-gray-900">Tiers</h2>
          <p className="mt-1 text-[12.5px] text-gray-500">
            Prime and Ultra members on {dayLabel(data.asOf)}, and how they used the card in the{" "}
            {data.definition.windowDays} days to {dayLabel(data.asOf)}. Bought = paid for Prime or
            locked FUSE for a year.
            {tiers?.source === "records"
              ? " Read from stored records for this day, so legacy members are an upper bound."
              : ""}
          </p>
        </div>
      </div>
      {tiers ? (
        <TiersBody data={data} tiers={tiers} />
      ) : (
        <OverviewCard className="px-5 py-4 text-[12.5px] text-gray-500">
          Tiers could not load for this range. The rest of the tab is unaffected.
        </OverviewCard>
      )}
    </div>
  );
}

function TiersBody({ data, tiers }: { data: GoodCustomersResponse; tiers: GoodCustomersTiers }) {
  return (
    <>
      <TierTiles data={data} tiers={tiers} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TiersTable data={data} tiers={tiers} />
        </div>
        <BuyersCard tiers={tiers} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RoutesCard data={data} tiers={tiers} />
        <TrialsCard tiers={tiers} />
      </div>
    </>
  );
}

function TierTiles({ data, tiers }: { data: GoodCustomersResponse; tiers: GoodCustomersTiers }) {
  const { bought, members, trials } = tiers;
  const locked = bought.lockPrime + bought.lockUltra;
  const memberCount = members.prime + members.ultra;
  const memberUse = memberTotals(tiers);
  const coreSpend = Math.max(data.spend.allUsd - memberUse.spendUsd, 0);
  const toPaid = share(trials.endedThenBought, trials.ended);
  const neverAccepted = Math.max(trials.gifted - trials.accepted, 0);

  return (
    <div className="grid grid-cols-1 gap-3.5 min-[480px]:grid-cols-2 xl:grid-cols-4">
      <Tile
        title="Paid for a tier"
        value={formatCount(bought.total)}
        chip={
          <Chip tone="neutral">
            {bought.lastWeek > 0 ? `+${formatCount(bought.lastWeek)} this week` : "None this week"}
          </Chip>
        }
        context={`${formatCount(bought.paid)} paid $${bought.primeAnnualUsd} for Prime. ${formatCount(
          locked,
        )} locked FUSE for a year: ${formatCount(bought.lockPrime)} for Prime, ${formatCount(
          bought.lockUltra,
        )} for Ultra`}
      >
        <SplitBar
          parts={[
            { label: `Paid $${bought.primeAnnualUsd} · ${formatCount(bought.paid)}`, value: bought.paid, color: OVERVIEW_ACCENT },
            { label: `Locked FUSE · ${formatCount(locked)}`, value: locked, color: TIER_MID },
          ]}
        />
      </Tile>

      <Tile
        title="Prime and Ultra members"
        value={formatCount(memberCount)}
        chip={
          <Chip tone="neutral">
            Prime {formatCount(members.prime)} · Ultra {formatCount(members.ultra)}
          </Chip>
        }
        context={`Holding a tier on ${dayLabel(data.asOf)}, by how they got it. ${formatCount(
          members.withCard,
        )} of them have a card`}
      >
        <SplitBar
          parts={[
            {
              label: `Bought ${formatCount(members.byRoute.paid + members.byRoute.lock)}`,
              value: members.byRoute.paid + members.byRoute.lock,
              color: OVERVIEW_ACCENT,
            },
            { label: `Free trial ${formatCount(members.byRoute.trial)}`, value: members.byRoute.trial, color: TIER_MID },
            { label: `Legacy ${formatCount(members.byRoute.legacy)}`, value: members.byRoute.legacy, color: TIER_LIGHT },
          ]}
        />
      </Tile>

      <Tile
        title="Members' share of card spend"
        value={formatRatio(share(memberUse.spendUsd, data.spend.allUsd))}
        chip={
          <Chip tone="neutral">
            from {formatRatio(share(memberUse.spenders, data.ladder.activeSpenders))} of spenders
          </Chip>
        }
        context={`Settled spend in the last ${data.definition.windowDays} days that came from Prime and Ultra members`}
      >
        <SplitBar
          parts={[
            { label: `Members ${compactUsd(memberUse.spendUsd)}`, value: memberUse.spendUsd, color: OVERVIEW_ACCENT },
            { label: `Core ${compactUsd(coreSpend)}`, value: coreSpend, color: TIER_LIGHT },
          ]}
        />
      </Tile>

      <Tile
        title="Trial to paid"
        value={formatRatio(toPaid)}
        chip={
          trials.ended > 0 ? (
            <Chip tone={toPaid !== null && toPaid < 0.1 ? "bad" : "neutral"}>
              {formatCount(trials.endedThenBought)} of {formatCount(trials.ended)}
            </Chip>
          ) : null
        }
        context={`People whose free trial ended and who then bought a tier. ${formatCount(
          neverAccepted,
        )} gifted trials were never accepted`}
      >
        <SplitBar
          parts={[
            { label: `Bought ${formatCount(trials.endedThenBought)}`, value: trials.endedThenBought, color: OVERVIEW_ACCENT },
            {
              label: `Did not buy ${formatCount(trials.ended - trials.endedThenBought)}`,
              value: trials.ended - trials.endedThenBought,
              color: TIER_LIGHT,
            },
          ]}
        />
      </Tile>
    </div>
  );
}

const HEAD = "text-[10.5px] font-semibold tracking-[0.4px] text-gray-400 uppercase";

function TiersTable({ data, tiers }: { data: GoodCustomersResponse; tiers: GoodCustomersTiers }) {
  const { ladder, spend, definition: d } = data;
  const all = {
    cardholders: ladder.cardholders,
    spenders: ladder.activeSpenders,
    qualified: ladder.qualified,
    spendUsd: spend.allUsd,
  };
  const members = memberTotals(tiers);
  const core = tiers.table.find((row) => row.tier === "core");
  const memberEach = perSpender(members);
  const coreEach = core ? perSpender(core) : null;
  const ratio = memberEach !== null && coreEach !== null && coreEach > 0 ? memberEach / coreEach : null;

  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader
        title="Tiers"
        subtitle={`Cardholders by tier on ${dayLabel(data.asOf)}, and their card use in the ${d.windowDays} days to ${dayLabel(data.asOf)}`}
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[700px] text-[12.5px]">
          <thead>
            <tr className="border-b border-[#eef0f3] text-left">
              <th className={`py-1.5 pr-3 ${HEAD}`}>Tier</th>
              <th className={`py-1.5 pr-3 text-right ${HEAD}`}>Cardholders</th>
              <th className={`py-1.5 pr-3 pl-3 ${HEAD}`}>How they got it</th>
              <th className={`py-1.5 pr-3 text-right ${HEAD}`}>Spent in {d.windowDays} days</th>
              <th className={`py-1.5 pr-3 text-right ${HEAD}`}>Qualified</th>
              <th className={`py-1.5 pr-3 text-right ${HEAD}`}>Per spender</th>
              <th className={`py-1.5 text-right ${HEAD}`}>Card spend</th>
            </tr>
          </thead>
          <tbody>
            {tiers.table.map((row) => (
              <tr key={row.tier} className="border-b border-[#eef0f3]">
                <td className="py-2.5 pr-3 font-medium text-gray-900">{TIER_LABELS[row.tier]}</td>
                <td className="py-2.5 pr-3 text-right text-gray-700">{formatCount(row.cardholders)}</td>
                <td className="py-2.5 pr-3 pl-3">
                  {row.tier === "core" ? (
                    <span className="text-[11.5px] text-gray-400">No tier</span>
                  ) : (
                    <RouteMix row={row} />
                  )}
                </td>
                <PartCell part={row.spenders} whole={row.cardholders} />
                <PartCell part={row.qualified} whole={row.cardholders} />
                <td className="py-2.5 pr-3 text-right text-gray-700">{usdOrDash(perSpender(row))}</td>
                <td className="py-2.5 text-right whitespace-nowrap text-gray-400">
                  <span className="font-medium text-gray-900">{compactUsd(row.spendUsd)}</span> ·{" "}
                  {formatRatio(share(row.spendUsd, spend.allUsd))}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2.5 pr-3 text-gray-900">All cardholders</td>
              <td className="py-2.5 pr-3 text-right text-gray-900">{formatCount(all.cardholders)}</td>
              <td className="py-2.5 pr-3 pl-3 text-[11.5px] font-normal text-gray-400">
                {formatCount(tiers.members.withCard)} hold a tier
              </td>
              <PartCell part={all.spenders} whole={all.cardholders} strong />
              <PartCell part={all.qualified} whole={all.cardholders} strong />
              <td className="py-2.5 pr-3 text-right text-gray-900">{usdOrDash(perSpender(all))}</td>
              <td className="py-2.5 text-right text-gray-900">{compactUsd(all.spendUsd)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11.5px] text-gray-500">
        <div className="flex gap-3.5">
          <Legend color={OVERVIEW_ACCENT} label="Bought" />
          <Legend color={TIER_MID} label="Free trial" />
          <Legend color={TIER_LIGHT} label="Legacy" />
        </div>
        <span>
          {tiers.members.prime + tiers.members.ultra - tiers.members.withCard > 0
            ? `${formatCount(
                tiers.members.prime + tiers.members.ultra - tiers.members.withCard,
              )} members without a card are left out. `
            : ""}
          Legacy = held FUSE when tiers v3 launched.
        </span>
      </div>
      {ratio !== null && memberEach !== null && coreEach !== null ? (
        <Insight
          tone={ratio >= 1 ? "good" : "warn"}
          lead={
            ratio >= 1.5
              ? `Members spend about ${ratio >= 2 ? Math.round(ratio) : ratio.toFixed(1)}× more.`
              : "Members spend about the same as Core."
          }
          rest={`Prime and Ultra cardholders who spent averaged ${wholeUsd(memberEach)} in ${d.windowDays} days, against ${wholeUsd(
            coreEach,
          )} on Core. ${formatCount(members.spenders)} members drove ${formatRatio(
            share(members.spendUsd, spend.allUsd),
          )} of card spend.`}
        />
      ) : null}
    </OverviewCard>
  );
}

function RouteMix({ row }: { row: GoodCustomersTierRow }) {
  const bought = row.byRoute.paid + row.byRoute.lock;
  const parts = [
    { value: bought, color: OVERVIEW_ACCENT },
    { value: row.byRoute.trial, color: TIER_MID },
    { value: row.byRoute.legacy, color: TIER_LIGHT },
  ];
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-[110px] shrink-0 gap-[2px] overflow-hidden rounded bg-[#f1f2f6]">
        {total > 0
          ? parts.map((p, i) => (
              <div key={i} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
            ))
          : null}
      </div>
      <span className="text-[11.5px] whitespace-nowrap text-gray-500">
        {formatCount(bought)} · {formatCount(row.byRoute.trial)} · {formatCount(row.byRoute.legacy)}
      </span>
    </div>
  );
}

function PartCell({ part, whole, strong }: { part: number; whole: number; strong?: boolean }) {
  return (
    <td className="py-2.5 pr-3 text-right whitespace-nowrap text-gray-400">
      <span className={strong ? "font-semibold text-gray-900" : "font-medium text-gray-900"}>
        {formatCount(part)}
      </span>{" "}
      <span className="font-normal">· {formatRatio(share(part, whole))}</span>
    </td>
  );
}

function BuyersCard({ tiers }: { tiers: GoodCustomersTiers }) {
  const bars = buyersBars(tiers);
  const trend = buyersTrend(tiers);
  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader title="New tier buyers, weekly" subtitle="Paid for Prime or locked FUSE, by week to each date" />
      <div className="mt-4 h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(day: string) => dayLabel(day)}
              axisLine={false}
              tickLine={false}
              interval={bars.length > 8 ? "preserveStartEnd" : 0}
              minTickGap={20}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={28}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
            />
            <Tooltip cursor={{ fill: "#f4f5fb" }} content={<BuyersTooltip />} />
            <Bar dataKey="paid" stackId="buyers" fill={OVERVIEW_ACCENT} maxBarSize={32} />
            <Bar dataKey="lock" stackId="buyers" fill={TIER_MID} radius={[3, 3, 0, 0]} maxBarSize={32}>
              <LabelList dataKey="total" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "#374151" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-3.5 text-[11.5px] text-gray-500">
        <Legend color={OVERVIEW_ACCENT} label={`Paid $${tiers.bought.primeAnnualUsd}`} />
        <Legend color={TIER_MID} label="Locked FUSE" />
      </div>
      {trend.recent + trend.before > 0 ? (
        <Insight
          tone={trend.recent < trend.before ? "warn" : "good"}
          lead={trend.recent < trend.before ? "Buying slowed." : "Buying is holding up."}
          rest={`${formatCount(trend.recent)} tier purchases in the last ${trend.weeks} weeks, against ${formatCount(
            trend.before,
          )} in the ${trend.weeks} weeks before.`}
        />
      ) : null}
    </OverviewCard>
  );
}

function BuyersTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ReturnType<typeof buyersBars>[number] }>;
}) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  return (
    <div className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold">Week to {dayLabel(bar.date)}</div>
      <div className="mt-1">
        {formatCount(bar.paid)} paid for Prime · {formatCount(bar.lock)} locked FUSE
      </div>
    </div>
  );
}

const ROUTE_LABELS: Record<GoodCustomersRouteRow["route"], string> = {
  paid: "Paid for Prime",
  lock: "Locked FUSE",
  legacy: "Legacy",
  trial: "Free trial",
  core: "Core (no tier)",
};

const ROUTE_COLORS: Record<GoodCustomersRouteRow["route"], string> = {
  paid: OVERVIEW_ACCENT,
  lock: OVERVIEW_ACCENT,
  legacy: TIER_MID,
  trial: TIER_MID,
  core: CORE_GREY,
};

function RoutesCard({ data, tiers }: { data: GoodCustomersResponse; tiers: GoodCustomersTiers }) {
  const buyers = buyerTotals(tiers);
  const core = tiers.routes.find((row) => row.route === "core");
  const buyersRate = share(buyers.qualified, buyers.spenders);
  const coreRate = core ? share(core.qualified, core.spenders) : null;
  const buyersEach = perSpender(buyers);
  const coreEach = core ? perSpender(core) : null;

  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader
        title="Qualified, by how people got their tier"
        subtitle={`Of those who spent in the ${data.definition.windowDays} days to ${dayLabel(data.asOf)}`}
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-[12px]">
          <thead>
            <tr className="border-b border-[#eef0f3] text-left">
              <th className={`py-1.5 pr-3 ${HEAD}`}>How they got their tier</th>
              <th className={`py-1.5 pr-3 ${HEAD}`} colSpan={2}>
                Qualified
              </th>
              <th className={`py-1.5 pr-3 text-right ${HEAD}`}>Spent</th>
              <th className={`py-1.5 text-right ${HEAD}`}>Per spender</th>
            </tr>
          </thead>
          <tbody>
            {tiers.routes.map((row) => {
              const rate = share(row.qualified, row.spenders);
              return (
                <tr key={row.route} className="border-b border-[#eef0f3] last:border-b-0">
                  <td className="py-2.5 pr-3 font-medium whitespace-nowrap text-gray-900">
                    {row.route === "paid" ? `Paid $${tiers.bought.primeAnnualUsd} for Prime` : ROUTE_LABELS[row.route]}
                  </td>
                  <td className="w-full py-2.5 pr-3">
                    <div className="h-2 w-full min-w-[120px] overflow-hidden rounded" style={{ background: TIER_TRACK }}>
                      <div
                        className="h-full rounded"
                        style={{ width: `${(rate ?? 0) * 100}%`, background: ROUTE_COLORS[row.route] }}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-gray-900">{formatRatio(rate)}</td>
                  <td className="py-2.5 pr-3 text-right whitespace-nowrap text-gray-400">
                    <span className="text-gray-700">{formatCount(row.qualified)}</span> of{" "}
                    {formatCount(row.spenders)}
                  </td>
                  <td className="py-2.5 text-right text-gray-700">{usdOrDash(perSpender(row))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {buyers.spenders > 0 && buyersRate !== null && buyersEach !== null && coreRate !== null && coreEach ? (
        <Insight
          tone={buyersRate > coreRate ? "good" : "warn"}
          lead={
            buyersRate > coreRate
              ? "People who bought a tier are the best customers."
              : "People who bought a tier are not ahead of Core."
          }
          rest={`${formatCount(buyers.qualified)} of the ${formatCount(buyers.spenders)} who spent qualified (${formatRatio(
            buyersRate,
          )}), and each spent ${wholeUsd(buyersEach)}, ${(buyersEach / coreEach).toFixed(1)}× a Core spender.`}
        />
      ) : null}
    </OverviewCard>
  );
}

function TrialsCard({ tiers }: { tiers: GoodCustomersTiers }) {
  const { trials } = tiers;
  const rows = [
    { label: "Gifted", value: trials.gifted, note: null },
    { label: "Accepted in the app", value: trials.accepted, note: share(trials.accepted, trials.gifted) },
    { label: "Trial ended", value: trials.ended, note: null },
    { label: "Then bought a tier", value: trials.endedThenBought, note: share(trials.endedThenBought, trials.ended) },
  ];
  const trialRow = tiers.routes.find((row) => row.route === "trial");
  const coreRow = tiers.routes.find((row) => row.route === "core");
  const trialRate = trialRow ? share(trialRow.qualified, trialRow.spenders) : null;
  const coreRate = coreRow ? share(coreRow.qualified, coreRow.spenders) : null;
  const toPaid = share(trials.endedThenBought, trials.ended);
  const neverAccepted = Math.max(trials.gifted - trials.accepted, 0);

  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader
        title="Free trials"
        subtitle={`Gifted by the team${trials.since ? ` since ${dayLabel(trials.since)}` : ""} · people, not trials`}
      />
      <div className="mt-4 flex flex-col">
        {rows.map((row, i) => (
          <div key={row.label} className="flex items-center gap-3 border-b border-[#eef0f3] py-2.5 text-[12px] last:border-b-0">
            <span className="w-[150px] shrink-0 font-medium text-gray-900">{row.label}</span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded" style={{ background: TIER_TRACK }}>
              <div
                className="h-full rounded"
                style={{
                  width: `${(share(row.value, trials.gifted) ?? 0) * 100}%`,
                  minWidth: row.value > 0 ? 3 : 0,
                  background: i === rows.length - 1 ? OVERVIEW_ACCENT : TIER_MID,
                }}
              />
            </div>
            <span className="w-[90px] shrink-0 text-right whitespace-nowrap text-gray-400">
              <span className="font-semibold text-gray-900">{formatCount(row.value)}</span>
              {row.note !== null ? ` · ${formatRatio(row.note)}` : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] leading-[15.5px] text-gray-500">
        {formatCount(trials.onTrial)} are on a trial now. {formatCount(neverAccepted)} gifted trials were never
        accepted; a trial only starts once the user accepts it in the app.
      </p>
      {trialRate !== null && coreRate !== null && toPaid !== null ? (
        <Insight
          tone="warn"
          lead={
            trialRate > coreRate && toPaid < 0.1
              ? "Trials lift usage, not purchases."
              : toPaid < 0.1
                ? "Few trials lead to a purchase."
                : "Trials are turning into purchases."
          }
          rest={`${formatRatio(trialRate)} of trial spenders qualify, against ${formatRatio(
            coreRate,
          )} on Core, ${toPaid < 0.1 ? "but only" : "and"} ${formatRatio(toPaid)} of ended trials led to a purchase.`}
        />
      ) : null}
    </OverviewCard>
  );
}

function Insight({ tone, lead, rest }: { tone: "good" | "warn"; lead: string; rest: string }) {
  const styles =
    tone === "good"
      ? { box: "border-[#dcf3d4] bg-[#f6fdf3]", lead: "text-[#277e11]" }
      : { box: "border-[#fbe3bf] bg-[#fffaf0]", lead: "text-[#b45309]" };
  return (
    <div className={`mt-4 rounded-lg border px-3.5 py-3 text-[12.5px] leading-[18px] text-gray-700 ${styles.box}`}>
      <strong className={`font-semibold ${styles.lead}`}>{lead}</strong> {rest}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}

/** `$1,064`: per-person amounts read better whole than as `$1.1K`. */
function wholeUsd(value: number): string {
  return `$${formatCount(Math.round(value))}`;
}

function usdOrDash(value: number | null): string {
  return value === null ? "—" : wholeUsd(value);
}
