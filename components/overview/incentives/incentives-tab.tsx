"use client";

import { Loader2 } from "lucide-react";
import { useIncentives } from "@/hooks/use-incentives";
import { describeApiError } from "@/lib/api";
import { keepTogether, shortSpan } from "@/lib/incentives";
import { formatRatio } from "@/lib/overview-format";
import { dayLabel } from "@/lib/overview-range";
import type { IncentivesResponse } from "@/types/overview";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IncentivesTiles } from "@/components/overview/incentives/incentives-tiles";
import { WeeklyChart } from "@/components/overview/incentives/weekly-chart";
import { ProgramsCard } from "@/components/overview/incentives/programs-card";
import { ComingDueCard } from "@/components/overview/incentives/coming-due-card";
import { ChecksCard, NotCountedCard } from "@/components/overview/incentives/checks-cards";

/**
 * The Overview's Incentives tab: what Solid gives users in cashback, referral
 * rewards, subscription perks and yield boost — what left our wallets, what
 * the range's activity earned, and what is coming due.
 */
export function IncentivesTab({ from, to, compare }: { from: string; to: string; compare: boolean }) {
  const { data, error, isLoading, isPlaceholderData, refetch } = useIncentives(from, to, true);

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        Incentives could not load: {describeApiError(error)}.{" "}
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
          Updating to {shortSpan(from, to)}…
        </p>
        <div className="pointer-events-none opacity-50">
          <IncentivesView data={data} compare={compare} />
        </div>
      </div>
    );
  }
  return <IncentivesView data={data} compare={compare} />;
}

/** The tab's content for one response; no fetching. */
export function IncentivesView({ data, compare }: { data: IncentivesResponse; compare: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="min-w-0 flex-1 text-[12.5px] text-gray-500">
          Money we give users: cashback, referral rewards, subscription perks and yield boost. Sent = left our
          wallets, checked on-chain. Earned = owed for the range&apos;s activity.
        </p>
        <Definitions data={data} />
      </div>
      <IncentivesTiles data={data} compare={compare} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <WeeklyChart data={data} />
        </div>
        <div className="lg:col-span-2">
          <ProgramsCard data={data} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ComingDueCard data={data} />
        <ChecksCard data={data} />
      </div>
      <NotCountedCard data={data} />
      <Footer data={data} />
    </div>
  );
}

/**
 * "How it's defined →" opens a popover with each number's definition in
 * plain words; the footer keeps the version, data time and wallets.
 */
function Definitions({ data }: { data: IncentivesResponse }) {
  const { rates } = data.comingDue;
  const rows: Array<[string, string]> = [
    [
      "Sent",
      "Tokens that left the cashback, referral and yield boost wallets in the range, valued at the rate when sent and dated by when they landed. Checked against the chain.",
    ],
    [
      "Earned",
      "What the range's purchases, qualified referrals and accrued yield boost entitle users to, minus anything already cancelled. Cashback pays 14 days after the purchase, referral rewards 30 days after the friend qualifies.",
    ],
    ["Payout corrections", "What payments moved on-chain beyond the amounts on their records."],
    [
      "Coming due",
      `Already owed, by the day it pays out, as of now. Expected = owed × the share actually paid in the last 4 weeks (cashback ${formatRatio(
        rates.cashback,
        1,
      )}, referral rewards ${formatRatio(rates.referrals, 1)}).`,
    ],
    ["Card spend per $1", "Settled card spend, by the Summary tab's rule, ÷ earned, same range."],
  ];
  return (
    <Popover>
      <PopoverTrigger className="text-[13px] font-medium whitespace-nowrap text-[#3b3bd6] hover:underline">
        How it&apos;s defined →
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] bg-white p-4 text-gray-900">
        <p className="text-[13px] font-semibold">How the Incentives numbers are defined</p>
        <dl className="mt-2 flex flex-col gap-2 text-[12px] leading-4">
          {rows.map(([term, text]) => (
            <div key={term}>
              <dt className="font-medium text-gray-900">{term}</dt>
              <dd className="text-gray-500">{text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-gray-400">
          Definition v{data.definition.version}. Weeks {weekDays(data)} {data.definition.timezone}.
        </p>
      </PopoverContent>
    </Popover>
  );
}

const weekDays = (data: IncentivesResponse) =>
  data.definition.weekStartsOn === "sunday" ? "Sun–Sat" : "Mon–Sun";

function Footer({ data }: { data: IncentivesResponse }) {
  const at = data.generatedAt;
  const asOf = keepTogether(`${dayLabel(at.slice(0, 10))} ${at.slice(0, 4)}, ${at.slice(11, 16)} UTC`);
  return (
    <p className="text-[11px] leading-[15px] text-gray-400">
      Definition v{data.definition.version}, data as of {asOf}. Sent = soUSD and soFUSE that left the cashback
      (0x8678…646c), referral (0x5de4…e30c) and yield boost (0x521b…d9e1) wallets, valued at the rate when sent.
      Earned = owed for the range&apos;s activity, minus anything already cancelled. Weeks {weekDays(data)}{" "}
      {data.definition.timezone}. Card spend uses the Summary tab&apos;s rule. Revenue is on the Summary tab.
    </p>
  );
}
