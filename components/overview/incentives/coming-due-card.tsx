"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Customized,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  axisTicks,
  dueBars,
  dueHeadline,
  newCashbackNote,
  overdueNote,
  type DueBar,
} from "@/lib/incentives";
import { axisUsd, compactUsd } from "@/lib/overview-format";
import type { IncentivesResponse } from "@/types/overview";
import { OverviewCard, SectionHeader } from "@/components/overview/overview-ui";
import {
  AXIS_TICK,
  INCENTIVE_COLORS,
  INCENTIVE_OUTLINE,
  Legend,
  stackBox,
  type ChartLayerProps,
} from "@/components/overview/incentives/incentives-ui";

const EXPECTED_KEYS = ["cashbackExpectedBar", "referralsExpectedBar"];
const ALL_KEYS = ["cashbackAll", "referralsAll"];

/**
 * What is already owed, by the week it pays out: what we expect to pay at
 * the last four weeks' pay rates (solid) next to everything owed if nothing
 * is cancelled (outlined). Always as of now, whatever the range. A part with
 * no measured pay rate shows only what is owed.
 */
export function ComingDueCard({ data }: { data: IncentivesResponse }) {
  const { comingDue } = data;
  const bars = dueBars(comingDue);
  const ticks = axisTicks(Math.max(0, ...bars.map((b) => Math.max(b.all, b.expected ?? 0))));
  const overdue = overdueNote(data);
  const headline = dueHeadline(comingDue);
  const anyExpected = bars.some((b) => b.cashbackExpected !== null || b.referralsExpected !== null);
  // An unknown expected part draws no solid bar; the tooltip still reads the nulls.
  const chartBars: ChartDueBar[] = bars.map((b) => ({
    ...b,
    cashbackExpectedBar: b.cashbackExpected ?? 0,
    referralsExpectedBar: b.referralsExpected ?? 0,
  }));

  return (
    <OverviewCard className="flex h-full flex-col p-5">
      <SectionHeader
        title="Coming due"
        subtitle={
          <>
            <span className="font-semibold text-gray-900">{headline.lead}</span>
            {headline.rest}
          </>
        }
      />

      {bars.length === 0 ? (
        <p className="mt-6 py-12 text-center text-[12.5px] text-gray-500">Nothing is owed right now.</p>
      ) : (
        <div className="mt-2 h-[218px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartBars}
              margin={{ top: 24, right: 4, left: 0, bottom: 0 }}
              barGap={12}
              barCategoryGap="10%"
            >
              <CartesianGrid stroke="#eef0f4" vertical={false} />
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                minTickGap={4}
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
              <Tooltip cursor={{ fill: "#f4f5fb" }} content={<DueTooltip />} />
              <Bar dataKey="cashbackExpectedBar" stackId="expected" fill={INCENTIVE_COLORS.cashback} maxBarSize={34} isAnimationActive={false} />
              <Bar dataKey="referralsExpectedBar" stackId="expected" fill={INCENTIVE_COLORS.referrals} maxBarSize={34} isAnimationActive={false} />
              <Bar dataKey="cashbackAll" stackId="all" fill={INCENTIVE_OUTLINE.cashback} maxBarSize={34} isAnimationActive={false} />
              <Bar dataKey="referralsAll" stackId="all" fill={INCENTIVE_OUTLINE.referrals} maxBarSize={34} isAnimationActive={false} />
              <Customized component={<DueLayer bars={bars} />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px] text-gray-500">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Legend color={INCENTIVE_COLORS.cashback} label="Cashback & perks" />
          <Legend color={INCENTIVE_COLORS.referrals} label="Referral rewards" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {anyExpected ? <Legend color="#6b7280" label="Expected" /> : null}
          <Legend color="#ffffff" dashed label="If nothing is cancelled" />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-1 text-[12px] leading-4 text-gray-500">
        {overdue ? <p>{overdue}</p> : null}
        <p>{newCashbackNote(data)}</p>
      </div>
    </OverviewCard>
  );
}

type ChartDueBar = DueBar & { cashbackExpectedBar: number; referralsExpectedBar: number };

/**
 * The expected total over each solid bar (or, with no pay rate, what is owed
 * over the outlined bar), and one dashed outline per outlined bar.
 */
function DueLayer({ bars, ...chart }: ChartLayerProps & { bars: DueBar[] }) {
  if (!chart.offset) return null;
  return (
    <g>
      {bars.map((bar, index) => {
        const all = stackBox(chart, ALL_KEYS, index);
        const expected = stackBox(chart, EXPECTED_KEYS, index);
        return (
          <g key={bar.from}>
            {all && all.height > 0 ? (
              <rect
                x={all.x + 0.5}
                y={all.y + 0.5}
                width={Math.max(all.width - 1, 0)}
                height={Math.max(all.height - 1, 0)}
                fill="none"
                stroke={INCENTIVE_OUTLINE.stroke}
                strokeDasharray="3 2"
              />
            ) : null}
            {bar.expected !== null && expected ? (
              <text
                x={expected.x + expected.width / 2}
                y={expected.y - 7}
                textAnchor="middle"
                fontSize={11.5}
                fontWeight={600}
                fill="#111827"
              >
                {compactUsd(bar.expected)}
              </text>
            ) : bar.expected === null && all && bar.all > 0 ? (
              <text
                x={all.x + all.width / 2}
                y={all.y - 7}
                textAnchor="middle"
                fontSize={11.5}
                fontWeight={600}
                fill="#4b5563"
              >
                {compactUsd(bar.all)}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

function DueTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DueBar }> }) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  return (
    <div className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold">Pays {bar.label}</div>
      <div className="mt-1 grid grid-cols-[auto_auto_auto] gap-x-4 gap-y-0.5">
        <span />
        <span className="text-right text-gray-400">Expected</span>
        <span className="text-right text-gray-400">If none cancelled</span>
        <span>Cashback & perks</span>
        <span className="text-right">{maybeUsd(bar.cashbackExpected)}</span>
        <span className="text-right">{compactUsd(bar.cashbackAll)}</span>
        <span>Referral rewards</span>
        <span className="text-right">{maybeUsd(bar.referralsExpected)}</span>
        <span className="text-right">{compactUsd(bar.referralsAll)}</span>
        <span className="font-semibold">Total</span>
        <span className="text-right font-semibold">{maybeUsd(bar.expected)}</span>
        <span className="text-right font-semibold">{compactUsd(bar.all)}</span>
      </div>
    </div>
  );
}

/** An expected amount, or a dash when there is no pay rate to expect it by. */
const maybeUsd = (value: number | null) => (value === null ? "—" : compactUsd(value));
