"use client";

import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGoodCustomers } from "@/hooks/use-good-customers";
import { describeApiError } from "@/lib/api";
import {
  cohortLabel,
  countryName,
  guardrails,
  netPerQualified,
  qualifiedCashbackMultiple,
  share,
  weeklyBars,
  type GuardrailStatus,
} from "@/lib/good-customers";
import { change, compactUsd, formatCount, formatRatio } from "@/lib/overview-format";
import { dayLabel } from "@/lib/overview-range";
import type { GoodCustomersResponse } from "@/types/overview";
import {
  ChangeChip,
  Chip,
  OVERVIEW_ACCENT,
  OVERVIEW_FADED,
  OVERVIEW_INCIDENT,
  OverviewCard,
  SectionHeader,
  Sparkline,
  SplitBar,
  type ChipTone,
} from "@/components/overview/overview-ui";
import { Tile } from "@/components/overview/kpi-tiles";

const LADDER_LIGHT = "#c7cbf5";
const LADDER_MID = "#8b8fea";
const LADDER_DEEP = "#25259a";

/**
 * The Overview's Good customers tab: who holds a card, who uses it, and who
 * uses it enough to keep using it. Always the 28 days to the range's last
 * day, counted per person, whatever the range's length.
 */
export function GoodCustomersTab({ from, to }: { from: string; to: string }) {
  const { data, error, isLoading, isPlaceholderData, refetch } = useGoodCustomers(from, to, true);

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        Good customers could not load: {describeApiError(error)}.{" "}
        <button type="button" onClick={() => void refetch()} className="font-medium underline">
          Try again
        </button>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // While a new range loads, the previous one stays on screen, dimmed and
  // marked, so its numbers are never read as the new range's.
  if (isPlaceholderData) {
    return (
      <div aria-busy="true" className="relative">
        <p className="mb-3 inline-flex items-center gap-2 text-[12.5px] text-gray-500">
          <Loader2 className="size-3.5 animate-spin" />
          Updating to the {data.definition.windowDays} days to {dayLabel(to)}…
        </p>
        <div className="pointer-events-none opacity-50">
          <GoodCustomersView data={data} />
        </div>
      </div>
    );
  }
  return <GoodCustomersView data={data} />;
}

/** The tab's content for one response; no fetching. */
export function GoodCustomersView({ data }: { data: GoodCustomersResponse }) {
  const d = data.definition;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12.5px] text-gray-500">
        People, not cards. Qualified = settled purchases on {d.minSpendDays}+ days and $
        {d.minSpendUsd}+ in the {d.windowDays} days to {dayLabel(data.asOf)}. Always the{" "}
        {d.windowDays} days to the range end.
      </p>
      <Tiles data={data} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyChart data={data} />
        </div>
        <LadderCard data={data} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CohortsCard data={data} />
        <GuardrailsCard data={data} />
      </div>
      <p className="text-[11px] leading-[15px] text-gray-400">
        Definition v{d.version}. Spend = settled card purchases in USD, all of a person’s cards
        together. Real customer = holds a card and has put in their own money or made a settled
        purchase. Qualified = {d.minSpendDays}+ spend days and ${d.minSpendUsd}+ in the trailing{" "}
        {d.windowDays} days. High-value = qualified plus ${d.highValueSpendUsd}+ spend, $
        {d.highValueMoneyInUsd}+ of their own money in, or active Prime. Revenue is fees plus
        Prime, as on the Revenue tile; treasury interest and partner card markups are not included.
      </p>
    </div>
  );
}

function Tiles({ data }: { data: GoodCustomersResponse }) {
  const { ladder, weekly, spend, economics, definition: d } = data;
  const weekBefore = weekly.length > 1 ? weekly[weekly.length - 2].qualified : null;
  const net = netPerQualified(data);
  const multiple = qualifiedCashbackMultiple(data);
  const paid = economics.feesUsd + economics.primeUsd;
  const notYet = Math.max(ladder.realCustomers - ladder.qualified, 0);

  return (
    <div className="grid grid-cols-1 gap-3.5 min-[480px]:grid-cols-2 xl:grid-cols-4">
      <Tile
        title="Qualified customers"
        value={formatCount(ladder.qualified)}
        chip={weekBefore !== null ? <ChangeChip change={change(ladder.qualified, weekBefore)} /> : null}
        context={`${d.minSpendDays}+ spend days and $${d.minSpendUsd}+ settled in the last ${d.windowDays} days${
          weekBefore !== null ? `. ${formatCount(weekBefore)} a week earlier` : ""
        }`}
      >
        <Sparkline values={weekly.map((w) => w.qualified)} highlight={0} />
      </Tile>

      <Tile
        title="Qualified rate"
        value={formatRatio(share(ladder.qualified, ladder.realCustomers))}
        chip={
          <Chip tone="neutral">
            {formatCount(ladder.qualified)} of {formatCount(ladder.realCustomers)}
          </Chip>
        }
        context="Share of real customers (funded or spent) who qualify"
      >
        <SplitBar
          parts={[
            { label: `Qualified ${formatCount(ladder.qualified)}`, value: ladder.qualified, color: OVERVIEW_ACCENT },
            { label: `Not yet ${formatCount(notYet)}`, value: notYet, color: OVERVIEW_FADED },
          ]}
        />
      </Tile>

      <Tile
        title="Share of card spend"
        value={formatRatio(share(spend.qualifiedUsd, spend.allUsd))}
        chip={
          <Chip tone="neutral">
            from {formatRatio(share(ladder.qualified, ladder.activeSpenders))} of spenders
          </Chip>
        }
        context={`Settled spend in the last ${d.windowDays} days that came from qualified customers`}
      >
        <SplitBar
          parts={[
            { label: `Qualified ${compactUsd(spend.qualifiedUsd)}`, value: spend.qualifiedUsd, color: OVERVIEW_ACCENT },
            {
              label: `Other spenders ${compactUsd(spend.allUsd - spend.qualifiedUsd)}`,
              value: spend.allUsd - spend.qualifiedUsd,
              color: OVERVIEW_FADED,
            },
          ]}
        />
      </Tile>

      <Tile
        title="Net revenue after cashback"
        value={net === null ? "—" : compactUsd(net).replace("-", "−")}
        chip={
          multiple !== null && multiple > 1 ? (
            <Chip tone="bad">
              Cashback {multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}× revenue
            </Chip>
          ) : null
        }
        context={`Per qualified customer, last ${economics.days} days. ${formatCount(
          economics.coveringOwnCashback,
        )} of ${formatCount(ladder.qualified)} cover their own cashback`}
      >
        <SplitBar
          parts={[
            { label: `Revenue ${compactUsd(paid)}`, value: paid, color: OVERVIEW_ACCENT },
            { label: `Cashback ${compactUsd(economics.cashbackUsd)}`, value: economics.cashbackUsd, color: OVERVIEW_INCIDENT },
          ]}
        />
      </Tile>
    </div>
  );
}

function WeeklyChart({ data }: { data: GoodCustomersResponse }) {
  const bars = weeklyBars(data);
  const first = bars[0];
  const last = bars[bars.length - 1];

  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader
        title="Qualified customers, weekly"
        subtitle={`People who qualified in the ${data.definition.windowDays} days to each date, inside all active spenders · ${bars.length} weeks`}
      />
      <div className="mt-4 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(day: string) => dayLabel(day)}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
            />
            <YAxis
              tickFormatter={(v: number) => formatCount(v)}
              axisLine={false}
              tickLine={false}
              width={48}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
            />
            <Tooltip
              cursor={{ fill: "#f4f5fb" }}
              content={<WeekTooltip windowDays={data.definition.windowDays} />}
            />
            <Bar dataKey="qualified" stackId="people" fill={OVERVIEW_ACCENT} maxBarSize={36} />
            <Bar dataKey="others" stackId="people" fill={OVERVIEW_FADED} radius={[3, 3, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px] text-gray-500">
        <div className="flex gap-4">
          <Legend color={OVERVIEW_ACCENT} label="Qualified" />
          <Legend color={OVERVIEW_FADED} label="Other active spenders" />
        </div>
        {first && last ? (
          <span>
            Qualified share of active spenders: {formatRatio(share(first.qualified, first.activeSpenders))} on{" "}
            {dayLabel(first.date)} → {formatRatio(share(last.qualified, last.activeSpenders))} on{" "}
            {dayLabel(last.date)}
          </span>
        ) : null}
      </div>
    </OverviewCard>
  );
}

function WeekTooltip({
  active,
  payload,
  windowDays,
}: {
  active?: boolean;
  payload?: Array<{ payload: ReturnType<typeof weeklyBars>[number] }>;
  windowDays: number;
}) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  return (
    <div className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold">
        {windowDays} days to {dayLabel(bar.date)}
      </div>
      <div className="mt-1">
        {formatCount(bar.qualified)} qualified of {formatCount(bar.activeSpenders)} active spenders
      </div>
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

function LadderCard({ data }: { data: GoodCustomersResponse }) {
  const { ladder, retention, definition: d } = data;
  const top = ladder.neverFundedTopCountry;
  const steps = [
    { label: "Real customers", hint: "funded or spent", value: ladder.realCustomers, color: LADDER_MID },
    { label: "Active spenders", hint: `${d.windowDays} days`, value: ladder.activeSpenders, color: LADDER_MID },
    {
      label: "Qualified",
      hint: `${d.minSpendDays}+ days, $${d.minSpendUsd}+`,
      value: ladder.qualified,
      color: OVERVIEW_ACCENT,
      strong: true,
    },
    {
      label: "High-value",
      hint: `+$${d.highValueSpendUsd} spend, $${d.highValueMoneyInUsd} in, or Prime`,
      value: ladder.highValue,
      color: LADDER_DEEP,
    },
  ];
  const qualifiedKept = retention ? share(retention.qualified.spentAgain, retention.qualified.people) : null;
  const othersKept = retention
    ? share(retention.otherSpenders.spentAgain, retention.otherSpenders.people)
    : null;

  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader
        title="Customer ladder"
        subtitle={`Everyone holding a Solid card, as of ${dayLabel(data.asOf)}`}
      />
      <div className="mt-4 flex flex-col gap-3">
        <LadderStep label="Cardholders" value={ladder.cardholders} total={ladder.cardholders} color={LADDER_LIGHT} />
        {ladder.neverFundedOrSpent > 0 ? (
          <div className="ml-2.5 border-l-2 border-[#f2a5a5] py-1 pl-3 text-[12px] text-[#b91c1c]">
            {formatCount(ladder.neverFundedOrSpent)} never funded or spent
            {top ? ` · ${formatCount(top.count)} of them in ${countryName(top.country)}` : ""}
          </div>
        ) : null}
        {steps.map((step) => (
          <LadderStep key={step.label} {...step} total={ladder.cardholders} />
        ))}
      </div>
      {retention && qualifiedKept !== null && othersKept !== null ? (
        <div className="mt-4 rounded-lg border border-[#dfe1fb] bg-[#f6f7ff] px-3.5 py-3 text-[12.5px] leading-[18px] text-gray-700">
          <strong className="font-semibold text-[#3b3bd6]">
            {qualifiedKept > othersKept
              ? "Qualified customers keep spending."
              : "Qualified customers are not sticking better."}
          </strong>{" "}
          {formatRatio(qualifiedKept)} of those qualified on {dayLabel(retention.asOf)} spent again in the
          next {d.windowDays} days, against {formatRatio(othersKept)} of other spenders.
        </div>
      ) : null}
    </OverviewCard>
  );
}

function LadderStep({
  label,
  hint,
  value,
  total,
  color,
  strong,
}: {
  label: string;
  hint?: string;
  value: number;
  total: number;
  color: string;
  strong?: boolean;
}) {
  const ratio = share(value, total);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate">
          <span className={strong ? "font-semibold text-gray-900" : "text-gray-700"}>{label}</span>
          {hint ? <span className="ml-1.5 text-[11px] text-gray-400">{hint}</span> : null}
        </span>
        <span className="shrink-0 text-gray-500">
          <span className={strong ? "font-semibold text-[#3b3bd6]" : "font-semibold text-gray-900"}>
            {formatCount(value)}
          </span>{" "}
          {formatRatio(ratio)}
        </span>
      </div>
      <div className="mt-1.5 h-3 w-full overflow-hidden rounded bg-[#f1f2f6]">
        <div className="h-full rounded" style={{ width: `${(ratio ?? 0) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function CohortsCard({ data }: { data: GoodCustomersResponse }) {
  const head = "text-[10.5px] font-semibold tracking-[0.4px] text-gray-400 uppercase";
  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader
        title="New cards → qualified within 30 days"
        subtitle="By the month someone created their first card"
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-[12.5px]">
          <thead>
            <tr className="border-b border-[#eef0f3] text-left">
              <th className={`py-1.5 pr-3 ${head}`}>Card created</th>
              <th className={`py-1.5 pr-3 text-right ${head}`}>Cards</th>
              <th className={`py-1.5 pr-3 text-right ${head}`}>Real customers</th>
              <th className={`py-1.5 pr-3 text-right ${head}`}>First purchase</th>
              <th className={`py-1.5 pl-3 ${head}`}>Qualified in 30 days</th>
            </tr>
          </thead>
          <tbody>
            {data.cohorts.map((cohort) => {
              const ratio = share(cohort.qualified, cohort.realCustomers);
              return (
                <tr key={cohort.month} className="border-b border-[#eef0f3] last:border-b-0">
                  <td className="py-2.5 pr-3 font-medium text-gray-900">{cohortLabel(cohort)}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-700">{formatCount(cohort.cardholders)}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-700">{formatCount(cohort.realCustomers)}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-700">{formatCount(cohort.firstPurchase)}</td>
                  <td className="py-2.5 pl-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 shrink-0 overflow-hidden rounded bg-[#f1f2f6]">
                        <div
                          className="h-full rounded"
                          style={{ width: `${(ratio ?? 0) * 100}%`, background: OVERVIEW_ACCENT }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-gray-500">
                        <span className="font-semibold text-gray-900">{formatCount(cohort.qualified)}</span>{" "}
                        · {formatRatio(ratio)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11.5px] leading-[15.5px] text-gray-500">
        Qualified share is of the month’s real customers (funded or spent).
        {data.referralBar
          ? ` A referred friend earns the referral bonus at $${data.referralBar.spendUsd} of spend, close to the qualified bar, so the newest months include people spending to that line.`
          : ""}
      </p>
    </OverviewCard>
  );
}

const STATUS_CHIPS: Record<GuardrailStatus, { tone: ChipTone; label: string }> = {
  off: { tone: "bad", label: "Off track" },
  watch: { tone: "warn", label: "Watch" },
  ok: { tone: "good", label: "OK" },
  unknown: { tone: "neutral", label: "Unknown" },
};

function GuardrailsCard({ data }: { data: GoodCustomersResponse }) {
  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader
        title="Guardrails"
        subtitle="Read these next to the headline. First limits, to agree with the team."
      />
      <div className="mt-3 flex flex-col">
        {guardrails(data).map((row) => (
          <div
            key={row.key}
            className="flex items-center gap-3 border-b border-[#eef0f3] py-2.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-gray-900">{row.title}</p>
              <p className="text-[11.5px] leading-[15.5px] text-gray-500">{row.detail}</p>
            </div>
            <span className="text-[15px] font-semibold whitespace-nowrap text-gray-900">{row.value}</span>
            <Chip tone={STATUS_CHIPS[row.status].tone}>{STATUS_CHIPS[row.status].label}</Chip>
          </div>
        ))}
      </div>
    </OverviewCard>
  );
}
