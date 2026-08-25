"use client";

import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2, Sparkles } from "lucide-react";

import { getUserRewards } from "@/lib/api";
import { UserRewardsData } from "@/types";
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

/**
 * Tier, points and cashback allowance, read from the same rewards service the
 * app's rewards screen uses — so "why am I not getting 2% cashback?" can be
 * answered from the same numbers the customer is seeing.
 */
export default function UserRewardsCard({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery<{ data: UserRewardsData }>({
    queryKey: ["user-rewards", userId],
    queryFn: async () => (await getUserRewards(userId)).data,
  });

  const rewards = data?.data;

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
                label="Points"
                value={rewards.totalPoints.toLocaleString()}
                hint={
                  rewards.nextTier
                    ? `${rewards.pointsToNextTier.toLocaleString()} to ${rewards.nextTier}`
                    : "Top tier"
                }
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
              <Stat
                label="Cashback this month"
                value={`$${rewards.cashbackThisMonth.toFixed(2)}`}
                hint={`Cap $${rewards.maxCashbackMonthly.toFixed(2)}`}
              />
              <Stat
                label="Referral points"
                value={rewards.referralPoints.toLocaleString()}
              />
              <Stat
                label="Yield boost"
                value={`${rewards.yieldBoostPercentage}%`}
                hint={
                  rewards.yieldBoostCap > 0
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

            {rewards.nextTier && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Progress to {rewards.nextTier}</span>
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
              {rewards.legacyCarryoverPoints > 0 && (
                <Badge variant="muted">
                  {rewards.legacyCarryoverPoints.toLocaleString()} carried over
                  from {rewards.legacyPoints.toLocaleString()} legacy points
                </Badge>
              )}
              {rewards.fuseSkipLine?.enabled &&
                rewards.fuseSkipLine.balanceFuse > 0 && (
                  <Badge variant="info">
                    <Sparkles className="h-3 w-3" />
                    {rewards.fuseSkipLine.balanceFuse.toLocaleString()} FUSE
                    staked → {rewards.fuseSkipLine.unlockedTier}
                  </Badge>
                )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
