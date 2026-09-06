"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Eye, Loader2, Snowflake } from "lucide-react";

import api, { getUserCard } from "@/lib/api";
import { Activity, Balance, User, UserCardOverview } from "@/types";
import ActivityList from "@/components/activity-list";
import BalancesCard from "@/components/balances-card";
import CardTransactionsTable from "@/components/card-transactions-table";
import DepositSummaryCard from "@/components/deposit-summary-card";
import UserCardPanel from "@/components/user/user-card-panel";
import UserCashbackCard from "@/components/user/user-cashback-card";
import UserCashbackRateCard from "@/components/user/user-cashback-rate-card";
import UserIntercomCard from "@/components/user/user-intercom-card";
import UserProfileCard from "@/components/user/user-profile-card";
import UserRewardsCard from "@/components/user/user-rewards-card";
import UserSavingsCard from "@/components/user/user-savings-card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** One headline figure in the strip under the user's name. */
function SummaryStat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p
        className={`mt-1 font-bold text-gray-900 ${
          emphasis ? "text-xl" : "text-lg"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["user", id],
    queryFn: async () => (await api.get(`/admin/v1/users/${id}`)).data,
  });

  const { data: balances, isLoading: balancesLoading } = useQuery<{
    data: Balance[];
  }>({
    queryKey: ["user-balances", id],
    queryFn: async () => (await api.get(`/admin/v1/users/${id}/balances`)).data,
  });

  const { data: card, isLoading: cardLoading } = useQuery<{
    data: UserCardOverview;
  }>({
    queryKey: ["user-card", id],
    queryFn: async () => (await getUserCard(id)).data,
  });

  const { data: activity, isLoading: activityLoading } = useQuery<{
    docs: Activity[];
  }>({
    queryKey: ["user-activity", id],
    queryFn: async () =>
      (
        await api.get(`/admin/v1/users/${id}/activity`, {
          params: { limit: 100 },
        })
      ).data,
  });

  // The page frame renders as soon as the user record lands; the panels each
  // carry their own loading state, so one slow on-chain read no longer holds
  // the whole page — and support's most common lookup — behind a spinner.
  if (userLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
        User not found.
      </div>
    );
  }

  const balanceRows = balances?.data ?? [];
  const displayName = user.username || user.email || id;
  const cardOverview = card?.data;

  const totalOf = (accountType: string) =>
    balanceRows.find((balance) => balance.accountType === accountType)
      ?.usdValue ?? 0;

  const savingsUsd =
    totalOf("savings") + totalOf("fuse-savings") + totalOf("eth-savings");
  const walletUsd = totalOf("wallet");
  const cardUsd = cardOverview?.balanceUsd ?? totalOf("card");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/users"
          className="text-gray-500 hover:text-gray-700"
          aria-label="Back to users"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
        <CopyButton value={id} label="User ID" />
        {/*
          No account-status badge here: users have no status field, so it only
          ever read "unknown". KYC — the status support actually asks about —
          is on the profile card, per Bridge customer.
        */}
        {cardOverview?.hasCard && (
          <Badge variant="info">{cardOverview.provider} card</Badge>
        )}
        {cardOverview?.frozen && (
          <Badge variant="warning">
            <Snowflake className="h-3 w-3" />
            Card frozen
          </Badge>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
          <Eye className="h-3.5 w-3.5" />
          Read-only view of what this user sees
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat
          label="Total"
          value={`$${(savingsUsd + walletUsd).toFixed(2)}`}
          emphasis
        />
        <SummaryStat label="Savings" value={`$${savingsUsd.toFixed(2)}`} />
        <SummaryStat label="Card" value={`$${cardUsd.toFixed(2)}`} />
        <SummaryStat label="Wallet" value={`$${walletUsd.toFixed(2)}`} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="card">Card &amp; spending</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <UserProfileCard user={user} />
              {balancesLoading ? (
                <div className="flex justify-center rounded-xl border bg-white py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                </div>
              ) : (
                <BalancesCard balances={balanceRows} />
              )}
            </div>
            <div className="space-y-4">
              <UserSavingsCard userId={id} />
              <UserCardPanel
                userId={id}
                username={displayName}
                card={cardOverview}
                isLoading={cardLoading}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          {activityLoading ? (
            <div className="flex justify-center rounded-xl border bg-white py-12">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="h-[calc(100vh-22rem)] min-h-96">
              <ActivityList activities={activity?.docs ?? []} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="deposits">
          <DepositSummaryCard userId={id} />
        </TabsContent>

        <TabsContent value="card" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UserCardPanel
              userId={id}
              username={displayName}
              card={cardOverview}
              isLoading={cardLoading}
            />
            <UserCashbackCard userId={id} />
          </div>
          {/* Next to the spending table, because a rate set on one transaction
              beats this one and is edited from a row down there. */}
          <UserCashbackRateCard
            userId={id}
            username={displayName}
            cashbackPercentage={user.cashbackPercentage}
          />
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              Card spending
            </h2>
            <CardTransactionsTable userId={id} compact />
          </div>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <UserRewardsCard userId={id} />
          <UserCashbackRateCard
            userId={id}
            username={displayName}
            cashbackPercentage={user.cashbackPercentage}
          />
          <UserCashbackCard userId={id} />
        </TabsContent>

        <TabsContent value="support">
          <UserIntercomCard userId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
