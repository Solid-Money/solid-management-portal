"use client";

import { formatCount, formatRatio } from "@/lib/overview-format";
import { isLatestWeek, spanLabel } from "@/lib/overview-range";
import type { OverviewFunnelSteps, OverviewResponse } from "@/types/overview";
import {
  ArrowLink,
  OVERVIEW_ACCENT,
  OverviewCard,
  SectionHeader,
} from "@/components/overview/overview-ui";
import { analyticsHref } from "@/components/overview/overview-links";

/**
 * Where this period's sign-ups stop: signed up → got a card → first purchase.
 * The grey line under each step is the previous period's sign-ups at the same
 * step, as of today — they had longer, so falling below them is a warning.
 */
export function NewUsersCard({
  data,
  compare,
}: {
  data: OverviewResponse;
  compare: boolean;
}) {
  const { range, newUsers } = data;
  const { current, previous, biggestDrop } = newUsers;
  const thisWeek = isLatestWeek(range);
  const period = thisWeek ? "this week" : "in this range";
  const previousLabel = thisWeek ? "Last week’s sign-ups" : "Previous period’s sign-ups";

  const steps: Array<{
    key: keyof OverviewFunnelSteps;
    label: string;
    stoppedBefore: string | null;
  }> = [
    { key: "signUps", label: "Signed up", stoppedBefore: null },
    {
      key: "gotCard",
      label: "Got a card",
      stoppedBefore: `${formatCount(current.signUps - current.gotCard)} stopped here`,
    },
    {
      key: "firstPurchase",
      label: "First purchase",
      stoppedBefore: `${formatCount(current.gotCard - current.firstPurchase)} have a card but haven’t paid`,
    },
  ];

  return (
    <OverviewCard className="flex flex-col p-5">
      <SectionHeader
        title={`New users ${period}`}
        subtitle={`${formatCount(current.signUps)} real sign-ups, ${spanLabel(range.from, range.to, range.today)}`}
        action={
          <ArrowLink href={analyticsHref("funnel", "onboarding", range)}>See who stopped</ArrowLink>
        }
      />

      <div className="mt-4 flex flex-col">
        {steps.map((step, index) => {
          const value = current[step.key];
          const share = current.signUps > 0 ? value / current.signUps : null;
          const previousShare = previous.signUps > 0 ? previous[step.key] / previous.signUps : null;
          return (
            <div key={step.key}>
              {step.stoppedBefore && index > 0 ? (
                <div className="my-1.5 ml-2.5 border-l-2 border-[#f2a5a5] py-1 pl-3 text-[12px] text-[#b91c1c]">
                  {step.stoppedBefore}
                </div>
              ) : null}
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-gray-700">{step.label}</span>
                <span className="text-gray-500">
                  <span className="font-semibold text-gray-900">{formatCount(value)}</span>
                  {index > 0 ? ` · ${formatRatio(share)}` : ""}
                </span>
              </div>
              <div className="mt-1.5 h-6 w-full overflow-hidden rounded-md bg-[#f1f2f6]">
                <div
                  className="h-full rounded-md"
                  style={{ width: `${(share ?? 0) * 100}%`, background: OVERVIEW_ACCENT }}
                />
              </div>
              {compare && index > 0 ? (
                <p className="mt-1 text-[11px] text-gray-400">
                  {previousLabel}: {formatRatio(previousShare)}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {biggestDrop && current.signUps > 0 ? (
        <div className="mt-4 rounded-lg border border-[#dfe1fb] bg-[#f6f7ff] px-3.5 py-3 text-[12.5px] leading-[18px] text-gray-700">
          <DropInsight current={current} previous={previous} compare={compare} step={biggestDrop.step} />
        </div>
      ) : null}
    </OverviewCard>
  );
}

function DropInsight({
  current,
  previous,
  compare,
  step,
}: {
  current: OverviewFunnelSteps;
  previous: OverviewFunnelSteps;
  compare: boolean;
  step: "gotCard" | "firstPurchase";
}) {
  if (step === "gotCard") {
    const lost = (current.signUps - current.gotCard) / current.signUps;
    const prevShare = previous.signUps > 0 ? previous.gotCard / previous.signUps : null;
    return (
      <>
        <strong className="font-semibold text-[#3b3bd6]">The big drop is before the card.</strong>{" "}
        {fractionWords(lost)} people who sign up never create one.
        {compare && prevShare !== null
          ? ` The previous period’s sign-ups, with longer to get there, reached ${formatRatio(prevShare)}.`
          : ""}
      </>
    );
  }
  const lost = current.gotCard > 0 ? (current.gotCard - current.firstPurchase) / current.gotCard : 0;
  return (
    <>
      <strong className="font-semibold text-[#3b3bd6]">The big drop is after the card.</strong>{" "}
      {fractionWords(lost)} people with a new card haven’t paid with it yet.
    </>
  );
}

/** 0.75 → "3 in 4", 0.5 → "1 in 2"; "43% of" when no small fraction fits. */
function fractionWords(share: number): string {
  for (const d of [2, 3, 4, 5, 10]) {
    const n = Math.round(share * d);
    if (n > 0 && n < d && Math.abs(n / d - share) < 0.03) return `${n} in ${d}`;
  }
  return `${formatRatio(share)} of`;
}
