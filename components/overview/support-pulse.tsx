"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { change, formatCount, formatDuration, formatRatio, intentLabel } from "@/lib/overview-format";
import type { OverviewResponse, OverviewSupportQueue } from "@/types/overview";
import {
  ArrowLink,
  OVERVIEW_ACCENT,
  OverviewCard,
  SectionHeader,
} from "@/components/overview/overview-ui";
import { supportHref } from "@/components/overview/overview-links";

const QUEUES: Array<{ id: OverviewSupportQueue; label: string }> = [
  { id: "needs_human", label: "Need a human" },
  { id: "ai_handling", label: "AI handling" },
  { id: "escalated", label: "Escalated" },
  { id: "waiting_customer", label: "Waiting on customer" },
];

/**
 * How much is waiting, how customers feel, whether the AI is coping, and what
 * people write about. Queues are as they stand now; the rest follows the range.
 */
export function SupportPulse({
  data,
  compare,
}: {
  data: OverviewResponse;
  compare: boolean;
}) {
  const { support, range } = data;
  const newChange = change(support.newCases.current, support.newCases.previous);
  const maxIntent = Math.max(1, ...support.topIntents.map((i) => i.count));

  return (
    <OverviewCard className="p-5">
      <SectionHeader
        title="Support pulse"
        subtitle={`${formatCount(support.newCases.current)} new cases ${
          range.days === 7 ? "this week" : "in this range"
        }${compare && newChange.text ? ` (${newChange.text})` : ""}`}
        action={<ArrowLink href={supportHref()}>Open inbox</ArrowLink>}
      />

      <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-[#eef0f4]">
        <Column title="Queues now">
          <div className="grid grid-cols-2 gap-2">
            {QUEUES.map((queue) => {
              const count = support.open[queue.id] ?? 0;
              const alarm = queue.id === "needs_human" && count > 0;
              return (
                <Link
                  key={queue.id}
                  href={supportHref(queue.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 hover:shadow-sm",
                    alarm ? "border-[#f5c2c2] bg-[#fdf3f3]" : "border-[#eef0f4] bg-[#fafbfd]",
                  )}
                >
                  <div className={cn("text-[20px] font-semibold", alarm ? "text-[#b91c1c]" : "text-gray-900")}>
                    {formatCount(count)}
                  </div>
                  <div className="text-[12px] text-gray-500">{queue.label}</div>
                </Link>
              );
            })}
          </div>
        </Column>

        <Column title="Mood" className="xl:pl-6">
          <p className="text-[12.5px] leading-[18px] text-gray-500">
            Not measured yet. Mood comes from a sentiment label the AI adds to each chat, which ships with the
            support-service change after this page.
          </p>
        </Column>

        <Column title="Solid AI" className="xl:pl-6">
          <Row
            label="Solved alone"
            value={formatRatio(support.solvedAloneRate.current)}
            was={compare ? formatRatio(support.solvedAloneRate.previous) : null}
            worse={
              support.solvedAloneRate.current !== null &&
              support.solvedAloneRate.previous !== null &&
              support.solvedAloneRate.current < support.solvedAloneRate.previous
            }
          />
          <Row
            label="Median first reply"
            value={formatDuration(support.firstReplyMedianSeconds.current)}
            was={compare ? formatDuration(support.firstReplyMedianSeconds.previous) : null}
            worse={
              support.firstReplyMedianSeconds.current !== null &&
              support.firstReplyMedianSeconds.previous !== null &&
              support.firstReplyMedianSeconds.current > support.firstReplyMedianSeconds.previous
            }
          />
          <p className="mt-2 text-[11.5px] text-gray-400">
            {formatCount(support.solvedAlone.current)} of {formatCount(support.newCases.current)} new cases resolved
            without a person.
          </p>
        </Column>

        <Column title="What people write about" className="xl:pl-6">
          <div className="flex flex-col gap-1.5">
            {support.topIntents.map((intent) => (
              <div key={intent.intent} className="grid grid-cols-[96px_1fr_32px] items-center gap-2 text-[12.5px]">
                <span className="truncate text-gray-700">{intentLabel(intent.intent)}</span>
                <span className="h-1.5 rounded-full bg-[#f1f2f6]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(intent.count / maxIntent) * 100}%`, background: OVERVIEW_ACCENT }}
                  />
                </span>
                <span className="text-right text-gray-500">{formatCount(intent.count)}</span>
              </div>
            ))}
            {support.withoutIntent.current > 0 ? (
              <p className="mt-1 text-[11.5px] text-gray-400">
                {formatCount(support.withoutIntent.current)} new cases had no topic.
              </p>
            ) : null}
          </div>
        </Column>
      </div>
    </OverviewCard>
  );
}

function Column({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{title}</p>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  was,
  worse,
}: {
  label: string;
  value: string;
  was: string | null;
  worse: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-[#f1f2f6] py-2 text-[13px]">
      <span className="text-gray-700">{label}</span>
      <span>
        <span className="font-semibold text-gray-900">{value}</span>
        {was ? (
          <span className={cn("ml-2 text-[12px]", worse ? "text-[#b91c1c]" : "text-gray-400")}>was {was}</span>
        ) : null}
      </span>
    </div>
  );
}
