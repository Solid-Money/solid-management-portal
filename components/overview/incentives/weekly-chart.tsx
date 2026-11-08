"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Customized,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  axisTicks,
  payDelayText,
  unknownCorrectionsNote,
  shortSpan,
  weeklyBars,
  weeklyNotes,
  weeklyTicks,
  weeklyTotalsText,
  weeksDescription,
  type ChartNote,
  type WeeklyBar,
  type WeeklyMode,
} from "@/lib/incentives";
import { axisUsd, compactUsd } from "@/lib/overview-format";
import { dayLabel } from "@/lib/overview-range";
import { cn } from "@/lib/utils";
import type { IncentivesResponse } from "@/types/overview";
import { ArrowLink, OverviewCard } from "@/components/overview/overview-ui";
import { analyticsHref } from "@/components/overview/overview-links";
import {
  AXIS_TICK,
  INCENTIVE_COLORS,
  INCENTIVE_FADED,
  INCENTIVE_OUTLINE,
  Legend,
  stackBox,
  type ChartLayerProps,
} from "@/components/overview/incentives/incentives-ui";

const SERIES = [
  { key: "cashback", label: "Cashback" },
  { key: "referrals", label: "Referral rewards" },
  { key: "perks", label: "Subscription perks" },
  { key: "yieldBoost", label: "Yield boost" },
] as const;
const SERIES_KEYS = SERIES.map((s) => s.key as string);

/** Room above the plot for the notes and the value label. */
const TOP_MARGIN = 40;

/**
 * Money that left the payout wallets each week, by type, or what each week's
 * activity earned. The running week is faded; the last full week carries its
 * total; notes only appear when the data shows a pause or a catch-up.
 */
export function WeeklyChart({ data }: { data: IncentivesResponse }) {
  const [mode, setMode] = useState<WeeklyMode>("sent");
  const bars = weeklyBars(data.weekly, mode);
  const notes = weeklyNotes(data, mode);
  const ticks = axisTicks(Math.max(0, ...bars.map((b) => b.total)));
  const lastFull = bars.map((b) => b.partial).lastIndexOf(false);
  const today = data.range.today ?? data.generatedAt.slice(0, 10);
  const weeks = weeksDescription(data.weekly, today);
  const unknownCorrections = unknownCorrectionsNote(data.weekly, mode);

  return (
    <OverviewCard className="flex h-full flex-col p-5">
      {/* SectionHeader's layout, but the switch wraps under the title on a phone. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-900">
            {mode === "sent" ? "Sent to users, weekly" : "Earned, weekly"}
          </h2>
          <p className="mt-1 text-[12.5px] text-gray-500">
            {mode === "sent"
              ? `Money that left our payout wallets, by type, USD · ${weeks}`
              : `Owed for each week's activity, by type, USD · ${weeks}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ModeSwitch mode={mode} onChange={setMode} />
          <ArrowLink href={analyticsHref("rewards", "paid", data.range)}>Open payouts</ArrowLink>
        </div>
      </div>

      {bars.length === 0 ? (
        <p className="mt-6 py-16 text-center text-[12.5px] text-gray-500">No weekly data yet.</p>
      ) : (
        <div className="mt-1 h-[264px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bars}
              margin={{ top: TOP_MARGIN, right: 4, left: 0, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid stroke="#eef0f4" vertical={false} />
              <XAxis
                dataKey="weekStart"
                ticks={weeklyTicks(bars)}
                interval="preserveStartEnd"
                minTickGap={8}
                tickFormatter={(day: string) => dayLabel(day)}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
                tick={AXIS_TICK}
              />
              <YAxis
                domain={[0, ticks[ticks.length - 1]]}
                ticks={ticks}
                tickFormatter={(v: number) => axisUsd(v)}
                axisLine={false}
                tickLine={false}
                width={48}
                tick={AXIS_TICK}
              />
              <Tooltip cursor={{ fill: "#f4f5fb" }} content={<WeekTooltip mode={mode} />} />
              {SERIES.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  stackId="week"
                  fill={INCENTIVE_COLORS[series.key]}
                  maxBarSize={34}
                  isAnimationActive={false}
                >
                  {bars.map((bar) => (
                    <Cell
                      key={bar.weekStart}
                      fill={bar.partial ? INCENTIVE_FADED[series.key] : INCENTIVE_COLORS[series.key]}
                    />
                  ))}
                </Bar>
              ))}
              <Customized component={<WeeklyLayer bars={bars} notes={notes} lastFull={lastFull} />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px] text-gray-500">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {SERIES.map((series) => (
            <Legend key={series.key} color={INCENTIVE_COLORS[series.key]} label={series.label} />
          ))}
        </div>
        <span>{weeklyTotalsText(data)}</span>
      </div>
      <p className="mt-3 text-[12px] leading-4 text-gray-500">{payDelayText(data)}</p>
      {unknownCorrections ? <p className="mt-1 text-[12px] leading-4 text-gray-500">{unknownCorrections}</p> : null}
    </OverviewCard>
  );
}

function ModeSwitch({ mode, onChange }: { mode: WeeklyMode; onChange: (mode: WeeklyMode) => void }) {
  return (
    <div role="group" aria-label="Show" className="inline-flex rounded-lg border border-[#e6e8ee] bg-white p-0.5">
      {(["sent", "earned"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[12.5px] font-medium",
            mode === m ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900",
          )}
        >
          {m === "sent" ? "Sent" : "Earned"}
        </button>
      ))}
    </div>
  );
}

/**
 * Drawn over the bars: the running week's dashed outline and "so far", the
 * last full week's total, and the notes with a thin leader to their bar.
 */
function WeeklyLayer({
  bars,
  notes,
  lastFull,
  ...chart
}: ChartLayerProps & { bars: WeeklyBar[]; notes: ChartNote[]; lastFull: number }) {
  const offset = chart.offset;
  if (!offset) return null;
  const partialIndex = bars.findIndex((b) => b.partial);
  const partial = partialIndex >= 0 ? stackBox(chart, SERIES_KEYS, partialIndex) : null;
  const full = lastFull >= 0 ? stackBox(chart, SERIES_KEYS, lastFull) : null;
  const plotLeft = offset.left;
  const plotRight = offset.left + offset.width;
  const placed: Array<{ left: number; right: number; y: number }> = [];

  return (
    <g>
      {partial && partial.height > 0 ? (
        <rect
          x={partial.x + 0.5}
          y={partial.y + 0.5}
          width={Math.max(partial.width - 1, 0)}
          height={Math.max(partial.height - 1, 0)}
          fill="none"
          stroke={INCENTIVE_OUTLINE.stroke}
          strokeDasharray="3 2"
        />
      ) : null}
      {partial ? (
        <text
          x={Math.min(partial.x + partial.width / 2, plotRight - 16)}
          y={partial.y - 7}
          textAnchor="middle"
          fontSize={11}
          fill="#6b7280"
        >
          so far
        </text>
      ) : null}
      {full ? (
        <text
          x={full.x + full.width / 2}
          y={full.y - 7}
          textAnchor="middle"
          fontSize={11.5}
          fontWeight={600}
          fill="#111827"
        >
          {compactUsd(bars[lastFull].total)}
        </text>
      ) : null}
      {notes.map((note) => {
        const index = bars.findIndex((b) => b.weekStart === note.weekStart);
        const box = index >= 0 ? stackBox(chart, SERIES_KEYS, index) : null;
        if (!box) return null;
        const x = box.x + box.width / 2;
        // Clear of the value label or "so far" sitting on the bar.
        const barTop = box.y - (index === lastFull || index === partialIndex ? 22 : 4);
        const width = note.text.length * 5.6;
        const right = x > plotLeft + offset.width / 2;
        let left = right ? x + 14 - width : x - 14;
        left = Math.min(Math.max(left, plotLeft), plotRight - width);
        let y = Math.max(12, barTop - 62);
        // A note that would sit on an earlier one moves below it.
        for (const other of placed) {
          if (left < other.right + 8 && left + width + 8 > other.left && Math.abs(y - other.y) < 16) {
            y = other.y + 16;
          }
        }
        placed.push({ left, right: left + width, y });
        return (
          <g key={note.key}>
            {barTop - (y + 5) > 6 ? (
              <line x1={x} x2={x} y1={y + 5} y2={barTop} stroke="#c4c8d2" strokeWidth={1} />
            ) : null}
            <text x={left} y={y} fontSize={11} fill="#6b7280">
              {note.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function WeekTooltip({
  active,
  payload,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ payload: WeeklyBar }>;
  mode: WeeklyMode;
}) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  return (
    <div className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold">
        {shortSpan(bar.weekStart, bar.weekEnd)}
        {bar.partial ? " (so far)" : ""} · {compactUsd(bar.total)} {mode === "sent" ? "sent" : "earned"}
      </div>
      {SERIES.map((series) =>
        bar[series.key] > 0 ? (
          <div key={series.key} className="mt-0.5 flex justify-between gap-4">
            <span>{series.label}</span>
            <span>{compactUsd(bar[series.key])}</span>
          </div>
        ) : null,
      )}
    </div>
  );
}
