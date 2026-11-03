import { spanLabel } from "@/lib/overview-range";
import type { OverviewResponse } from "@/types/overview";

/** The data window, the sources, and what revenue and rewards cost leave out. */
export function OverviewFooter({ data }: { data: OverviewResponse }) {
  const { range } = data;
  return (
    <p className="px-1 text-[11.5px] leading-[17px] text-gray-400">
      Data from accounts-service, analytics-service and support-service, {spanLabel(range.from, range.to, range.today)}{" "}
      (UTC), compared with {spanLabel(range.previousFrom, range.previousTo, range.today)}; generated{" "}
      {data.generatedAt.slice(11, 16)} UTC. Revenue is fees, yield share and Prime subscriptions; it leaves out
      treasury interest, single rows of $1,000 or more, and the partners’ card markups, which are not in our data.
      Rewards cost is cashback paid and still owed; referral rewards are not included yet. Sign-ups and the new-user
      funnel leave out deleted and test accounts.
    </p>
  );
}
