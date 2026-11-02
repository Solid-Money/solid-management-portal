"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  MONEY_IN_SERIES,
  capAt,
  methodColor,
  moneyBars,
  type MoneyBar,
} from "@/lib/overview-charts";
import { axisUsd, change, compactUsd, formatCount, niceCeil } from "@/lib/overview-format";
import { dayLabel, spanLabel } from "@/lib/overview-range";
import type {
  MoneyInMethod,
  OverviewMoneyInGap,
  OverviewMoneyInMethod,
  OverviewResponse,
} from "@/types/overview";
import {
  ArrowLink,
  ChangeChip,
  OVERVIEW_ACCENT,
  OVERVIEW_FADED,
  OverviewCard,
  SectionHeader,
} from "@/components/overview/overview-ui";
import { analyticsHref } from "@/components/overview/overview-links";
import {
  CalloutLabel,
  calloutMargin,
  placeCallouts,
} from "@/components/overview/chart-callout";

type View = "method" | "total";

/**
 * Money in, daily: stacked by how it arrived, crypto in blues and cash in
 * greens. The chips are legend, filter and the range's totals at once; picking
 * one shows that method alone on its own scale. Missing data is drawn — a
 * dashed bracket under days where a normally busy method wrote nothing.
 */
export function MoneyInCard({
  data,
  compare,
}: {
  data: OverviewResponse;
  compare: boolean;
}) {
  const { range, moneyIn } = data;
  const [view, setView] = useState<View>("method");
  const [selected, setSelected] = useState<MoneyInMethod | "all">("all");

  const bars = useMemo(() => moneyBars(moneyIn.daily), [moneyIn.daily]);
  const weekly = bars.length < moneyIn.daily.length;
  const methods = moneyIn.methods.filter((m) => m.count.current > 0 || m.count.previous > 0);
  const picked = methods.find((m) => m.method === selected) ?? null;

  const valueOf = (bar: MoneyBar) =>
    picked ? (bar.byMethod[picked.method] ?? 0) : bar.total;
  const rawCap = capAt(bars.filter((b) => !b.partial).map(valueOf));
  const cap = rawCap === null ? null : niceCeil(rawCap);
  const capped = cap === null ? [] : bars.filter((b) => valueOf(b) > cap);
  const callouts = placeCallouts(
    capped.slice(-2).map((bar) => ({
      key: `cap-${bar.date}`,
      date: bar.date,
      index: bars.indexOf(bar),
      text: capText(bar, picked?.method ?? null),
    })),
    bars.length,
  );
  const gaps = picked ? moneyIn.gaps.filter((g) => g.method === picked.method) : moneyIn.gaps;
  const totalChange = change(moneyIn.total.current, moneyIn.total.previous);
  const insights = moneyIn.insights ?? [];

  const chartData = bars.map((bar) => ({ ...bar, single: valueOf(bar) }));

  return (
    <OverviewCard className="p-5">
      <SectionHeader
        title="Money in, daily"
        subtitle={
          <>
            {compactUsd(moneyIn.total.current)} from {formatCount(moneyIn.deposits.current)} deposits in your range
            {compare && totalChange.text ? `, ${totalChange.text}` : ""} · {formatCount(moneyIn.daily.length)} days shown
            {weekly ? " by week" : ""}, your range highlighted
          </>
        }
        action={
          <>
            <div className="inline-flex rounded-lg border border-[#e6e8ee] p-0.5 text-[12.5px]">
              {(["method", "total"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium",
                    view === v ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900",
                  )}
                >
                  {v === "method" ? "By method" : "Total"}
                </button>
              ))}
            </div>
            <ArrowLink href={analyticsHref("funnel", "rails", range)}>Open deposits</ArrowLink>
          </>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <MethodChip
          label="All"
          usd={moneyIn.total.current}
          active={selected === "all"}
          onClick={() => setSelected("all")}
        />
        {methods.map((m) => (
          <MethodChip
            key={m.method}
            label={m.label}
            usd={m.usd.current}
            color={methodColor(m.method)}
            active={selected === m.method}
            onClick={() => setSelected(selected === m.method ? "all" : m.method)}
          />
        ))}
      </div>
      {picked ? <PickedLine method={picked} compare={compare} /> : null}

      <div className={cn("mt-4 grid gap-6", insights.length ? "lg:grid-cols-[minmax(0,1fr)_400px]" : "")}>
        <div>
          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: calloutMargin(callouts), right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => dayLabel(d)}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <YAxis
                  tickFormatter={(v: number) => axisUsd(v)}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  domain={cap === null ? [0, "auto"] : [0, cap]}
                  allowDataOverflow={cap !== null}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <Tooltip cursor={{ fill: "#f4f5fb" }} content={<MoneyTooltip />} />

                {callouts.map((spec) => (
                  <ReferenceLine
                    key={spec.key}
                    x={spec.date}
                    stroke="transparent"
                    label={<CalloutLabel spec={spec} />}
                  />
                ))}

                {picked || view === "total" ? (
                  <Bar dataKey="single" radius={[3, 3, 0, 0]} maxBarSize={28}>
                    {chartData.map((bar) => (
                      <Cell
                        key={bar.date}
                        fill={picked ? methodColor(picked.method) : bar.inRange ? OVERVIEW_ACCENT : OVERVIEW_FADED}
                        fillOpacity={barOpacity(bar, Boolean(picked))}
                        stroke={bar.partial ? OVERVIEW_ACCENT : undefined}
                        strokeDasharray={bar.partial ? "3 2" : undefined}
                      />
                    ))}
                  </Bar>
                ) : (
                  MONEY_IN_SERIES.map((series, index) => (
                    <Bar
                      key={series.id}
                      dataKey={(bar: MoneyBar) => bar.series[series.id]}
                      name={series.label}
                      stackId="money"
                      maxBarSize={28}
                      radius={index === MONEY_IN_SERIES.length - 1 ? [3, 3, 0, 0] : 0}
                    >
                      {chartData.map((bar) => (
                        <Cell
                          key={bar.date}
                          fill={series.color}
                          fillOpacity={barOpacity(bar, true)}
                          stroke="#ffffff"
                          strokeWidth={0.5}
                        />
                      ))}
                    </Bar>
                  ))
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <GapBrackets gaps={gapGroups(gaps)} bars={bars} today={range.today} />
          <p className="mt-2 text-[12px] text-gray-500">
            Counted apart from money in: {formatCount(moneyIn.underTenToWallet.current)} card top-ups under $10 went
            to the Wallet instead
            {compare ? ` (previous period ${formatCount(moneyIn.underTenToWallet.previous)})` : ""}, and{" "}
            {formatCount(moneyIn.refunded.current)} {moneyIn.refunded.current === 1 ? "was" : "were"} refunded.
          </p>
        </div>

        {insights.length ? (
          <div className="border-[#eef0f4] lg:border-l lg:pl-6">
            <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Insights</p>
            <div className="mt-3 flex flex-col gap-2.5">
              {insights.slice(0, 4).map((insight) => (
                <div
                  key={insight.lead}
                  className="rounded-lg border border-[#e6e8ee] bg-[#fafbfd] px-3.5 py-3 text-[12.5px] leading-[18px] text-gray-600"
                >
                  <strong className="font-semibold text-gray-900">{insight.lead}</strong> {insight.text}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </OverviewCard>
  );
}

function MethodChip({
  label,
  usd,
  color,
  active,
  onClick,
}: {
  label: string;
  usd: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px]",
        active ? "border-gray-900 bg-gray-900 text-white" : "border-[#e6e8ee] bg-white text-gray-700 hover:border-gray-300",
      )}
    >
      {color ? <span className="size-2 rounded-full" style={{ background: color }} /> : null}
      {label}
      <span className="font-semibold">{compactUsd(usd)}</span>
    </button>
  );
}

function PickedLine({ method, compare }: { method: OverviewMoneyInMethod; compare: boolean }) {
  return (
    <p className="mt-2 flex items-center gap-2 text-[12.5px] text-gray-600">
      {method.label}: {compactUsd(method.usd.current)} from {formatCount(method.count.current)} deposits
      {compare ? (
        method.change === null ? (
          <span className="text-gray-400">· no deposits to compare with</span>
        ) : (
          <ChangeChip change={change(method.usd.current, method.usd.previous)} />
        )
      ) : null}
    </p>
  );
}

function barOpacity(bar: MoneyBar, colored: boolean): number {
  if (bar.partial) return 0.3;
  if (!colored) return 1;
  return bar.inRange ? 1 : 0.45;
}

const METHOD_LABELS: Record<MoneyInMethod, string> = {
  base: "Base",
  bnb: "BNB Chain",
  arbitrum: "Arbitrum",
  ethereum: "Ethereum",
  polygon: "Polygon",
  fuse: "Fuse",
  bank: "bank",
  transfi: "TransFi",
};

/** "Oct 5 · $75.6K · $50.5K of it on Fuse" */
function capText(bar: MoneyBar, method: MoneyInMethod | null): string {
  if (method) return `${dayLabel(bar.date)} · ${compactUsd(bar.byMethod[method] ?? 0)}`;
  const top = (Object.entries(bar.byMethod) as Array<[MoneyInMethod, number]>).sort((a, b) => b[1] - a[1])[0];
  const share = top && bar.total > 0 ? top[1] / bar.total : 0;
  return share >= 0.5
    ? `${dayLabel(bar.date)} · ${compactUsd(bar.total)} · ${compactUsd(top[1])} of it on ${METHOD_LABELS[top[0]]}`
    : `${dayLabel(bar.date)} · ${compactUsd(bar.total)}`;
}

/** Gaps over the same days are drawn once: "No bank or TransFi records". */
function gapGroups(gaps: OverviewMoneyInGap[]): Array<{ from: string; to: string; names: string }> {
  const groups = new Map<string, MoneyInMethod[]>();
  for (const gap of gaps) {
    const key = `${gap.from}|${gap.to}`;
    groups.set(key, [...(groups.get(key) ?? []), gap.method]);
  }
  return [...groups.entries()].map(([key, methods]) => {
    const [from, to] = key.split("|");
    const names = methods.map((m) => METHOD_LABELS[m]);
    return {
      from,
      to,
      names: names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0],
    };
  });
}

function MoneyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MoneyBar }>;
}) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  const rows = MONEY_IN_SERIES.map((s) => ({ ...s, usd: bar.series[s.id] }))
    .filter((r) => r.usd > 0)
    .sort((a, b) => b.usd - a.usd);
  return (
    <div className="min-w-[180px] rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold">
        {bar.date === bar.until ? dayLabel(bar.date) : `${dayLabel(bar.date)} – ${dayLabel(bar.until)}`}
        {bar.partial ? " (so far)" : ""} · {compactUsd(bar.total)}
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[2px]" style={{ background: row.color }} />
              {row.label}
            </span>
            <span className="font-semibold">{compactUsd(row.usd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Y-axis width plus the chart's right margin, which the plot area leaves out. */
const AXIS_WIDTH = 48;
const RIGHT_MARGIN = 4;

/**
 * Missing data, drawn: a dashed bracket under the days a normally busy method
 * wrote nothing, lined up with the bars above it.
 */
function GapBrackets({
  gaps,
  bars,
  today,
}: {
  gaps: Array<{ from: string; to: string; names: string }>;
  bars: MoneyBar[];
  today: string;
}) {
  const placed = gaps
    .map((gap) => ({
      ...gap,
      first: bars.findIndex((b) => b.until >= gap.from),
      last: bars.findLastIndex((b) => b.date <= gap.to),
    }))
    .filter((gap) => gap.first >= 0 && gap.last >= gap.first);
  if (placed.length === 0) return null;
  const n = bars.length;
  const plot = `(100% - ${AXIS_WIDTH + RIGHT_MARGIN}px)`;
  return (
    <div className="relative mt-1 h-8">
      {placed.map((gap) => (
        <div
          key={`${gap.from}-${gap.to}`}
          className="absolute top-0 flex flex-col items-center"
          style={{
            left: `calc(${AXIS_WIDTH}px + ${plot} * ${gap.first / n})`,
            width: `calc(${plot} * ${(gap.last - gap.first + 1) / n})`,
          }}
        >
          <div className="h-1.5 w-full rounded-b-sm border-x border-b border-dashed border-[#16a37a]" />
          <span className="mt-1 text-[11.5px] whitespace-nowrap text-[#15803d]">
            No {gap.names} records, {spanLabel(gap.from, gap.to, today)}
          </span>
        </div>
      ))}
    </div>
  );
}
