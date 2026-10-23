"use client";

import { use, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Eye,
  Loader2,
  ShieldAlert,
  Snowflake,
} from "lucide-react";

import api, { getUserCard } from "@/lib/api";
import { Activity, Balance, User, UserCardOverview } from "@/types";
import ActivityList from "@/components/activity-list";
import BalancesCard from "@/components/balances-card";
import CardTransactionsTable from "@/components/card-transactions-table";
import DepositSummaryCard from "@/components/deposit-summary-card";
import UserErrors from "@/components/errors/user-errors";
import UserCardPanel from "@/components/user/user-card-panel";
import UserCashbackCard from "@/components/user/user-cashback-card";
import UserRtfCard from "@/components/user/user-rtf-card";
import UserAuditLogCard from "@/components/user/user-audit-log-card";
import UserErrorsCard from "@/components/user/user-errors-card";
import UserCashbackRateCard from "@/components/user/user-cashback-rate-card";
import UserSupportCard from "@/components/user/user-support-card";
import UserKycCard from "@/components/user/user-kyc-card";
import UserVirtualAccountOnboardingCard from "@/components/user/user-virtual-account-onboarding-card";
import UserProfileCard from "@/components/user/user-profile-card";
import UserRecoveryCard from "@/components/user/user-recovery-card";
import UserReferralCard from "@/components/user/user-referral-card";
import UserRewardsCard from "@/components/user/user-rewards-card";
import UserSavingsCard from "@/components/user/user-savings-card";
import UserTierMembershipCard from "@/components/user/user-tier-membership-card";
import UserTierTrialCard from "@/components/user/user-tier-trial-card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionAnchor } from "@/components/section-anchor";
import { useUrlTab } from "@/hooks/use-url-tab";
import { USER_TABS, type UserTab } from "@/lib/search-index";
import { useRecentUsers } from "@/lib/recent-users";

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
  // In the URL so a search result can open the tab a section lives in.
  const [tab, setTab] = useUrlTab<UserTab>(USER_TABS, "overview");
  const { remember } = useRecentUsers();

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

  // Every profile opened goes on the admin's recent list, however it was
  // reached — search, a referral link, the activity feed, a pasted URL.
  const cardProvider = card?.data?.hasCard ? card.data.provider : undefined;
  useEffect(() => {
    if (!user) return;
    remember({
      id,
      username: user.username,
      email: user.email,
      isDeleted: user.isDeleted,
      cardProvider,
    });
  }, [id, user, cardProvider, remember]);

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
          The one account status users actually have: closed from the app.
          There is no generic status field — a badge for it only ever read
          "unknown". KYC is on the profile card, per Bridge customer, and the
          recover action sits next to the status there.
        */}
        {user.securityHold ? (
          <Badge
            variant="danger"
            title="Closed by an admin for security — cannot be recovered"
          >
            <ShieldAlert className="h-3 w-3" />
            Closed for security
          </Badge>
        ) : (
          user.isDeleted && (
            <Badge variant="danger">
              <Ban className="h-3 w-3" />
              Account closed
            </Badge>
          )
        )}
        {cardOverview?.hasCard && (
          <Badge variant="info">{cardOverview.provider} card</Badge>
        )}
        {cardOverview?.frozen && (
          <Badge variant="warning">
            <Snowflake className="h-3 w-3" />
            Card frozen
          </Badge>
        )}
        {cardOverview?.spendBlock?.blocked && (
          <Badge variant="danger">
            <Ban className="h-3 w-3" />
            Card spend blocked
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

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="card">Card &amp; spending</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <SectionAnchor id="user-profile">
                <UserProfileCard user={user} />
              </SectionAnchor>
              <SectionAnchor id="user-balances">
                {balancesLoading ? (
                  <div className="flex justify-center rounded-xl border bg-white py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  </div>
                ) : (
                  <BalancesCard balances={balanceRows} />
                )}
              </SectionAnchor>
            </div>
            <div className="space-y-4">
              <SectionAnchor id="user-savings">
                <UserSavingsCard userId={id} />
              </SectionAnchor>
              {/* The card tab holds the linked `user-card`; ids stay unique
                  page-wide even though inactive tabs are unmounted. */}
              <SectionAnchor id="user-overview-card">
                <UserCardPanel
                  userId={id}
                  username={displayName}
                  card={cardOverview}
                  isLoading={cardLoading}
                />
              </SectionAnchor>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          {activityLoading ? (
            <div className="flex justify-center rounded-xl border bg-white py-12">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div id="user-activity" className="h-[calc(100vh-22rem)] min-h-96">
              <ActivityList activities={activity?.docs ?? []} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="deposits">
          <SectionAnchor id="user-deposits">
            <DepositSummaryCard userId={id} />
          </SectionAnchor>
        </TabsContent>

        <TabsContent value="card" className="space-y-4">
          {/* Above the card itself, because verification is the gate the card
              is behind: a declined KYC is why most "where is my card?" tickets
              exist, and the reason codes here are what answer them. */}
          <SectionAnchor id="user-kyc">
            <UserKycCard userId={id} username={displayName} />
          </SectionAnchor>
          {/* The USD virtual account has its own verification and its own Rain
              review, so it gets stuck in places the card's KYC card does not
              show — and "I paid but got no account" lands on this tab. */}
          <SectionAnchor id="user-virtual-account">
            <UserVirtualAccountOnboardingCard
              userId={id}
              username={displayName}
            />
          </SectionAnchor>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionAnchor id="user-card">
              <UserCardPanel
                userId={id}
                username={displayName}
                card={cardOverview}
                isLoading={cardLoading}
              />
            </SectionAnchor>
            <SectionAnchor id="user-cashback">
              <UserCashbackCard userId={id} />
            </SectionAnchor>
          </div>
          {/* On the card tab rather than the overview, and next to the card
              panel: under Real-Time Funding a decline is an allowance problem,
              and the allowance is only legible beside the card it funds. */}
          <SectionAnchor id="user-rtf">
            <UserRtfCard userId={id} />
          </SectionAnchor>
          {/* Next to the spending table, because a rate set on one transaction
              beats this one and is edited from a row down there. */}
          <SectionAnchor id="user-card-cashback-rate">
            <UserCashbackRateCard
              userId={id}
              username={displayName}
              cashbackPercentage={user.cashbackPercentage}
            />
          </SectionAnchor>
          <div id="user-card-spending">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              Card spending
            </h2>
            <CardTransactionsTable userId={id} compact />
          </div>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <SectionAnchor id="user-rewards">
            <UserRewardsCard userId={id} />
          </SectionAnchor>
          {/* Directly under the tier it can override: a running trial is why
              the tier above may not match the points next to it. */}
          <SectionAnchor id="user-tier">
            <UserTierMembershipCard userId={id} />
          </SectionAnchor>

          <SectionAnchor id="user-tier-trial">
            <UserTierTrialCard userId={id} username={displayName} />
          </SectionAnchor>
          <SectionAnchor id="user-cashback-rate">
            <UserCashbackRateCard
              userId={id}
              username={displayName}
              cashbackPercentage={user.cashbackPercentage}
            />
          </SectionAnchor>
          <SectionAnchor id="user-rewards-cashback">
            <UserCashbackCard userId={id} />
          </SectionAnchor>
          {/* Both sides of the referral program, with the re-evaluate action
              for rewards the engine reversed or expired. */}
          <SectionAnchor id="user-referrals">
            <UserReferralCard userId={id} />
          </SectionAnchor>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          {/* First on the tab: a lockout ticket is answered by whether they can
              recover on their own, before anything else is worth reading. */}
          <SectionAnchor id="user-recovery">
            {/* No access help for a security close: the backend refuses every
                action on this card for it, and none of them would be right. */}
            {user.securityHold ? (
              <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Account access is not available: this account was closed for
                  security and cannot be recovered. No recovery code, email
                  change or two-factor reset can be sent for it. See the
                  profile for why.
                </span>
              </div>
            ) : (
              <UserRecoveryCard userId={id} username={displayName} />
            )}
          </SectionAnchor>
          {/* Above the chats: a Ref quoted in one resolves here without a lookup. */}
          <SectionAnchor id="user-errors">
            <UserErrorsCard userId={id} />
          </SectionAnchor>
          <SectionAnchor id="user-support">
            <UserSupportCard userId={id} userLabel={user?.username || undefined} email={user?.email} />
          </SectionAnchor>
          <SectionAnchor id="user-audit-log">
            <UserAuditLogCard userId={id} />
          </SectionAnchor>
        </TabsContent>

        <TabsContent value="errors">
          <UserErrors userId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
