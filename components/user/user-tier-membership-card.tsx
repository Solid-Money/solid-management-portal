"use client";

import { useQuery } from "@tanstack/react-query";
import { KeyRound, Loader2, Lock, RefreshCw } from "lucide-react";

import { getUserTierMembership } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import {
  TierMembershipView,
  TierSubscriptionStatus,
  TierSubscriptionView,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TIER_VARIANT: Record<string, "info" | "success"> = {
  prime: "info",
  ultra: "success",
};

/**
 * A membership's state in the words support uses for it.
 *
 * `cancelled` and `past_due` both still grant the tier, which is the part that
 * surprises people — so they are labelled by what they mean for the user rather
 * than by the enum value.
 */
const STATUS_LABEL: Record<TierSubscriptionStatus, string> = {
  active: "Active",
  past_due: "Payment failed — in grace",
  cancelled: "Ends at period end",
  expired: "Ended",
};

const STATUS_VARIANT: Record<
  TierSubscriptionStatus,
  "success" | "warning" | "muted" | "destructive"
> = {
  active: "success",
  past_due: "warning",
  cancelled: "muted",
  expired: "destructive",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

const formatFuse = (amount: number) =>
  `${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} FUSE`;

/** One past membership, for the history list. */
function SubscriptionRow({ subscription }: { subscription: TierSubscriptionView }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-gray-100 py-2 text-xs">
      <Badge variant={TIER_VARIANT[subscription.tier] ?? "muted"}>
        {subscription.tier}
      </Badge>
      <Badge variant={STATUS_VARIANT[subscription.status]}>
        {STATUS_LABEL[subscription.status]}
      </Badge>
      <span className="text-gray-900">${subscription.priceUsd}/yr</span>
      <span className="text-gray-500">
        {formatDateTime(subscription.currentPeriodStart)} →{" "}
        {formatDateTime(subscription.currentPeriodEnd)}
      </span>
      {subscription.failedAttempts > 0 && (
        <span className="text-amber-700">
          {subscription.failedAttempts} failed charge
          {subscription.failedAttempts === 1 ? "" : "s"}
        </span>
      )}
    </li>
  );
}

/**
 * Why this user is on the tier they are on.
 *
 * Rewards v3 sells tiers rather than awarding them, so "why am I not Prime?"
 * now has three possible answers — nothing locked, nothing paid, or a renewal
 * that failed — and this card shows all three at once rather than making
 * support check them in turn. The lock figures come from the chain on every
 * load, so they are the same numbers the app is showing the user.
 */
export default function UserTierMembershipCard({
  userId,
}: {
  userId: string;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["user-tier-membership", userId],
    queryFn: async () => {
      const response = await getUserTierMembership(userId);
      return response.data.data;
    },
    enabled: Boolean(userId),
  });

  const membership: TierMembershipView | undefined = data;
  const state = membership?.state;
  const subscription = state?.subscription;
  const lock = state?.lock;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-emerald-600" />
          Tier membership
        </CardTitle>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the chain…
          </div>
        ) : isError || !state ? (
          <p className="text-sm text-gray-500">
            Could not read this user&apos;s membership.
          </p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Current tier" value={state.currentTier} />
              <Stat
                label="Member since"
                value={
                  state.memberSince ? formatDateTime(state.memberSince) : "—"
                }
              />
              <Stat
                label="Points unlock tiers"
                value={state.pointsUnlockEnabled ? "Yes" : "No (v3)"}
              />
              <Stat
                label="Routes on offer"
                value={
                  state.offers
                    .filter((o) => o.lockAvailable || o.cashAvailable)
                    .map((o) => o.tier)
                    .join(", ") || "None"
                }
              />
            </dl>

            {lock && lock.lockedFuse > 0 ? (
              <div className="rounded-md border border-gray-200 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Lock className="h-3.5 w-3.5 text-gray-500" />
                  Locked FUSE
                </div>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Locked" value={formatFuse(lock.lockedFuse)} />
                  <Stat
                    label="Unlocks tier"
                    value={lock.unlockedTier}
                  />
                  <Stat
                    label="Next unlock"
                    value={
                      lock.nextUnlockAt
                        ? formatDateTime(lock.nextUnlockAt)
                        : lock.maturedFuse > 0
                          ? "Due now"
                          : "—"
                    }
                  />
                  {/* Matured-but-unreturned is the one state worth acting on:
                      the sweep runs daily, so anything here for longer than
                      that is a sweep that is not running. */}
                  <Stat
                    label="Awaiting return"
                    value={
                      lock.maturedFuse > 0 ? formatFuse(lock.maturedFuse) : "—"
                    }
                  />
                </dl>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No FUSE locked.</p>
            )}

            {subscription ? (
              <div className="rounded-md border border-gray-200 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                  Paid membership
                  <Badge variant={STATUS_VARIANT[subscription.status]}>
                    {STATUS_LABEL[subscription.status]}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Tier" value={subscription.tier} />
                  <Stat label="Price" value={`$${subscription.priceUsd}/yr`} />
                  <Stat
                    label="Paid through"
                    value={formatDateTime(subscription.currentPeriodEnd)}
                  />
                  <Stat
                    label={
                      subscription.status === "past_due"
                        ? "Grace ends"
                        : "Next charge"
                    }
                    value={
                      subscription.status === "past_due"
                        ? subscription.graceEndsAt
                          ? formatDateTime(subscription.graceEndsAt)
                          : "—"
                        : subscription.nextChargeAt
                          ? formatDateTime(subscription.nextChargeAt)
                          : "Will not renew"
                    }
                  />
                </dl>
                {subscription.failedAttempts > 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    {subscription.failedAttempts} renewal attempt
                    {subscription.failedAttempts === 1 ? "" : "s"} have failed —
                    the usual cause is a Safe short of USDC. The charge is
                    retried on a backoff until the grace period ends.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No paid membership.</p>
            )}

            {membership && membership.history.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-medium uppercase text-gray-500">
                  History
                </h4>
                <ul>
                  {membership.history.map((row) => (
                    <SubscriptionRow key={row.id} subscription={row} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
