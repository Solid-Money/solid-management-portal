"use client";

import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2, Sparkles } from "lucide-react";

import { getUserRewards } from "@/lib/api";
import {
  formatCashbackMoney,
  formatCashbackTotals,
} from "@/lib/card-transactions";
import { tierTrialRemaining } from "@/lib/tier-trial";
import { CashbackCurrency, UserRewardsData } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TIER_VARIANT: Record<string, "muted" | "info" | "success"> = {
  core: "muted",
  prime: "info",
  ultra: "success",
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

/** One currency's view of the month's cashback. */
interface MonthCashback {
  currency: CashbackCurrency;
  thisMonth: number;
  pending?: number;
  tierCap: number;
  monthCap?: number;
}

/**
 * The month's cashback in the cardholder's own currency.
 *
 * The top-level figures count USD rows only; a euro cardholder's month is in
 * `cashbackEur`, in euros and held to the tier's euro cap. The two are never
 * added together.
 */
function monthCashbackOf(rewards: UserRewardsData): MonthCashback {
  const eur = rewards.cashbackEur;
  if (rewards.cashbackCurrency === "EUR" && eur) {
    return {
      currency: "EUR",
      thisMonth: eur.cashbackThisMonth,
      pending: eur.cashbackPendingThisMonth,
      tierCap: eur.maxCashbackMonthly,
      monthCap: eur.cashbackCapThisMonth,
    };
  }

  return {
    currency: "USD",
    thisMonth: rewards.cashbackThisMonth,
    pending: rewards.cashbackPendingThisMonth,
    tierCap: rewards.maxCashbackMonthly,
    monthCap: rewards.cashbackCapThisMonth,
  };
}

/**
 * The month's cashback, and dollars earned beside it when a euro cardholder
 * has both (a currency switched mid-month) — side by side, never summed.
 */
function monthCashbackValue(
  rewards: UserRewardsData,
  month: MonthCashback
): string {
  return month.currency === "EUR"
    ? formatCashbackTotals(rewards.cashbackThisMonth, month.thisMonth)
    : formatCashbackMoney(month.thisMonth, "USD");
}

/**
 * What is still pending this month, and the cap the month is paid up to, in
 * the month's own currency.
 *
 * A euro cardholder who switched mid-month can still have dollar rows
 * pending; those are shown beside the euro figure, in dollars, never summed
 * into it — as {@link monthCashbackValue} shows the paid side. The cap is the
 * month's own (euro) cap.
 *
 * The month's cap sits above the tier's when purchases were made on a bigger
 * tier — a trial that has since ended keeps its cap on what was bought during
 * it — which is exactly what a cardholder asks support about, so both are
 * shown then.
 */
function monthCashbackHint(
  rewards: UserRewardsData,
  month: MonthCashback
): string {
  const parts: string[] = [];
  const money = (value: number) => formatCashbackMoney(value, month.currency);

  const pending = month.pending ?? 0;
  if (pending > 0) parts.push(`+${money(pending)} pending`);

  const usdPending =
    month.currency === "EUR" ? (rewards.cashbackPendingThisMonth ?? 0) : 0;
  if (usdPending > 0) {
    parts.push(`+${formatCashbackMoney(usdPending, "USD")} pending`);
  }

  const tierCap = month.tierCap;
  const monthCap = month.monthCap ?? tierCap;
  parts.push(
    monthCap > tierCap
      ? `Cap ${money(monthCap)} (tier ${money(tierCap)})`
      : `Cap ${money(monthCap)}`
  );

  return parts.join(" · ");
}

/**
 * What the next tier would take.
 *
 * The lock is quoted only when the backend gives the FUSE still to lock
 * (`fuseToNextTier` > 0). Without that figure no route is named, because any
 * of these can be the reason: the lock is off or doesn't reach that tier, it
 * couldn't be read, or an older backend sent nothing. The hint points to the
 * Tier membership card, which lists the routes this user is actually offered.
 * Points are deprecated and never reach a tier, so they are never quoted.
 */
function nextTierHint(rewards: UserRewardsData): string {
  if (!rewards.nextTier) return "Top tier";
  const fuse = rewards.fuseToNextTier;
  if (typeof fuse === "number" && fuse > 0) {
    return `Lock ${Math.ceil(fuse).toLocaleString("en-US")} more FUSE for ${rewards.nextTier}`;
  }
  return `Routes to ${rewards.nextTier}: see Tier membership`;
}

/**
 * Tier and cashback allowance, read from the same rewards service the app's
 * rewards screen uses — so "why am I not getting 2% cashback?" can be
 * answered from the same numbers the customer is seeing.
 */
export default function UserRewardsCard({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery<{ data: UserRewardsData }>({
    queryKey: ["user-rewards", userId],
    queryFn: async () => (await getUserRewards(userId)).data,
  });

  const rewards = data?.data;
  const month = rewards ? monthCashbackOf(rewards) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-gray-400" />
          Rewards
        </CardTitle>
        {rewards && (
          <Badge variant={TIER_VARIANT[rewards.currentTier] ?? "muted"}>
            {rewards.currentTier}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : error || !rewards ? (
          <p className="text-sm text-red-600">Failed to load rewards.</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Stat
                label="Next tier"
                value={rewards.nextTier ?? "—"}
                hint={nextTierHint(rewards)}
              />
              <Stat
                label="Cashback rate"
                value={`${rewards.cashbackRate}%`}
                hint={
                  rewards.nextTier
                    ? `${rewards.nextTierCashbackRate}% at ${rewards.nextTier}`
                    : undefined
                }
              />
              {month && (
                <Stat
                  label="Cashback this month"
                  value={monthCashbackValue(rewards, month)}
                  hint={monthCashbackHint(rewards, month)}
                />
              )}
              <Stat
                label="Referral points"
                value={rewards.referralPoints.toLocaleString()}
              />
              <Stat
                label="Yield boost"
                value={`${rewards.yieldBoostPercentage}%`}
                hint={
                  (rewards.yieldBoostBalanceCap ?? 0) > 0
                    ? `On the first $${(rewards.yieldBoostBalanceCap ?? 0).toLocaleString("en-US")} of savings`
                    : rewards.yieldBoostCap > 0
                      ? `$${rewards.yieldBoostEarned.toFixed(2)} of $${rewards.yieldBoostCap.toFixed(2)} earned`
                      : undefined
                }
              />
              <Stat
                label="Subscription discount"
                value={`${rewards.subscriptionDiscountRate}%`}
                hint={
                  rewards.subscriptionCategoryLimit > 0
                    ? `${rewards.subscriptionCategoryLimit} categories/month`
                    : undefined
                }
              />
            </dl>

            {/* Lock progress only: a membership is bought outright, and points
                no longer count, so there is no bar to draw without a lock. */}
            {rewards.nextTier && rewards.progressToNextTierPct > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>{rewards.nextTier} lock progress</span>
                  <span>{Math.round(rewards.progressToNextTierPct)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, rewards.progressToNextTierPct))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              {!rewards.hasOptedIn && (
                <Badge variant="warning">Not opted in to rewards</Badge>
              )}
              {rewards.totalPoints > 0 && (
                <Badge variant="muted">
                  {rewards.totalPoints.toLocaleString()} points (no longer count
                  toward a tier)
                </Badge>
              )}
              {rewards.fuseSkipLine?.enabled &&
                rewards.fuseSkipLine.balanceFuse > 0 && (
                  <Badge variant="info">
                    <Sparkles className="h-3 w-3" />
                    {rewards.fuseSkipLine.balanceFuse.toLocaleString()} FUSE in
                    Savings (grandfathered) → {rewards.fuseSkipLine.unlockedTier}
                  </Badge>
                )}
              {/* The tier above can be a trial rather than something they
                  bought, which is the first thing to know when the tier and
                  their lock or membership don't line up. */}
              {rewards.activeTierTrial && (
                <Badge variant="success">
                  <Sparkles className="h-3 w-3" />
                  {rewards.activeTierTrial.tier} trial ·{" "}
                  {tierTrialRemaining(rewards.activeTierTrial)}
                </Badge>
              )}
              {rewards.pendingTierTrial && (
                <Badge variant="warning">
                  <Gift className="h-3 w-3" />
                  {rewards.pendingTierTrial.durationDays} days of{" "}
                  {rewards.pendingTierTrial.tier} waiting to be activated
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
