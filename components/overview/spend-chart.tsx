"use client";

import { useState } from "react";
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
import { spendBars, type SpendBar } from "@/lib/overview-charts";
import { axisUsd, compactUsd, formatCount } from "@/lib/overview-format";
import { dayLabel, isLatestWeek, spanLabel } from "@/lib/overview-range";
import type { OverviewResponse } from "@/types/overview";
import {
  ArrowLink,
  OVERVIEW_ACCENT,
  OVERVIEW_FADED,
  OVERVIEW_INCIDENT,
  OverviewCard,
  SectionHeader,
} from "@/components/overview/overview-ui";
import { analyticsHref } from "@/components/overview/overview-links";
import {
  CHART_SIDE_PX,
  CalloutLabel,
  calloutMargin,
  placeCallouts,
} from "@/components/overview/chart-callout";

/** At most this many incident days carry a label; the rest are just pink. */
const MAX_INCIDENT_LABELS = 2;

/**
 * Daily settled card spend: whether this week is normal. The picked range is
 * in the accent colour, earlier days faded, today hatched, and only two kinds
 * of day are labelled — the best day and incident days.
 */
export function SpendChart({ data }: { data: OverviewResponse }) {
  const { range, spendDaily } = data;
  const [plotWidth, setPlotWidth] = useState(0);
  const bars = spendBars(spendDaily.days);
  const weekly = bars.length < spendDaily.days.length;
  const today = bars.find((b) => b.partial);
  const best = spendDaily.bestDay;
  const incidents = bars.filter((b) => b.incident).slice(-MAX_INCIDENT_LABELS);
  const updatedAt = data.generatedAt.slice(11, 16);
  const indexOf = (date: string) => bars.findIndex((b) => b.date === date);
  // By week, the best day sits in the bar whose days cover it.
  const bestIndex = best ? bars.findIndex((b) => b.date <= best.date && best.date <= b.until) : -1;
  const callouts = placeCallouts(
    [
      ...incidents.map((bar) => ({
        key: `incident-${bar.date}`,
        date: bar.date,
        index: indexOf(bar.date),
        text: `${dayLabel(bar.date)} · ${compactUsd(bar.usd)} · ${bar.incident?.label ?? ""}`,
      })),
      ...(best && bestIndex >= 0
        ? [
            {
              key: "best",
              date: bars[bestIndex].date,
              index: bestIndex,
              text: `${dayLabel(best.date)} · ${compactUsd(best.usd)} · ${
                best.bestSince ? `best day since ${dayLabel(best.bestSince)}` : "best day shown"
              }`,
            },
          ]
        : []),
    ],
    bars.length,
    plotWidth,
  );

  return (
    <OverviewCard className="flex flex-col p-5">
      <SectionHeader
        title="Card spend, daily"
        subtitle={`Settled card purchases, USD · ${formatCount(spendDaily.days.length)} days shown${
          weekly ? " by week" : ""
        }, your range highlighted`}
        action={<ArrowLink href={analyticsHref("card", "spending", range)}>Open in Analytics</ArrowLink>}
      />

      <div className="mt-4 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%" onResize={(width) => setPlotWidth(width - CHART_SIDE_PX)}>
          <BarChart data={bars} margin={{ top: calloutMargin(callouts), right: 4, left: 0, bottom: 0 }}>
            <defs>
              <pattern id="spend-today" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#ffffff" />
                <line x1="0" y1="0" x2="0" y2="6" stroke={OVERVIEW_ACCENT} strokeWidth="1.5" strokeOpacity="0.45" />
              </pattern>
            </defs>
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
              tick={{ fontSize: 11, fill: "#9ca3af" }}
            />
            <Tooltip cursor={{ fill: "#f4f5fb" }} content={<SpendTooltip />} />
            {incidents.map((bar) => (
              <ReferenceLine
                key={`line-${bar.date}`}
                x={bar.date}
                stroke={OVERVIEW_INCIDENT}
                strokeDasharray="2 2"
              />
            ))}
            {callouts.map((spec) => (
              <ReferenceLine
                key={spec.key}
                x={spec.date}
                stroke="transparent"
                label={<CalloutLabel spec={spec} />}
              />
            ))}
            <Bar dataKey="usd" radius={[3, 3, 0, 0]} maxBarSize={28}>
              {bars.map((bar) => (
                <Cell
                  key={bar.date}
                  fill={
                    bar.partial
                      ? "url(#spend-today)"
                      : bar.incident
                        ? OVERVIEW_INCIDENT
                        : bar.inRange
                          ? OVERVIEW_ACCENT
                          : OVERVIEW_FADED
                  }
                  stroke={bar.partial ? OVERVIEW_ACCENT : undefined}
                  strokeDasharray={bar.partial ? "3 2" : undefined}
                  strokeOpacity={bar.partial ? 0.6 : undefined}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-gray-500">
        <Legend color={OVERVIEW_ACCENT} label={isLatestWeek(range) ? "This week" : spanLabel(range.from, range.to, range.today)} />
        <Legend color={OVERVIEW_FADED} label="Before" />
        <Legend color={OVERVIEW_INCIDENT} label="Incident day" />
        {today ? (
          <Legend
            color="#ffffff"
            dashed
            label={`Today so far (${compactUsd(today.usd)} by ${updatedAt})`}
          />
        ) : null}
      </div>
    </OverviewCard>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2 rounded-[2px]"
        style={{
          background: color,
          border: dashed ? `1px dashed ${OVERVIEW_ACCENT}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

function SpendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SpendBar }>;
}) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  return (
    <div className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold">
        {bar.date === bar.until ? dayLabel(bar.date) : `${dayLabel(bar.date)} – ${dayLabel(bar.until)}`}
        {bar.partial ? " (so far)" : ""}
      </div>
      <div className="mt-1">
        {compactUsd(bar.usd)} · {formatCount(bar.payments)} payments
      </div>
      {bar.incident ? <div className="mt-1 text-[#f8b4b4]">{bar.incident.label}</div> : null}
    </div>
  );
}
