"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Gift,
  Loader2,
  PauseCircle,
  Zap,
} from "lucide-react";

import {
  useReferralV4Access,
  useReferralV4Config,
  useUserReferralsV4,
} from "@/hooks/use-referral-v4";
import {
  CANCELLABLE_V4_STATUSES,
  formatUtcDay,
  isNotAvailable,
  payoutScheduleLabel,
  referralV4Stage,
  referralV4Status,
  referralV4StepLabel,
} from "@/lib/referral-v4";
import { formatUsd } from "@/lib/utils";
import type {
  AdminReferralV4FriendRow,
  AdminReferralV4Reward,
  AdminUserReferralsV4,
  ReferralV4StepView,
  ReferralV4Terms,
  ReferralV4UpgradeView,
} from "@/types/referral-v4";
import CancelReferralV4RewardDialog from "@/components/user/cancel-referral-v4-reward-dialog";
import ReferralV4DebtsSection from "@/components/user/referral-v4-debts-section";
import { CardErrorBoundary } from "@/components/referral-v4/card-error-boundary";
import { NotAvailableYet } from "@/components/referral-v4/not-available";
import UserLink from "@/components/user-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Whole dollars without cents, anything else with them. */
function money(value: number | undefined): string {
  const amount = Number(value) || 0;
  return formatUsd(amount, Number.isInteger(amount) ? 0 : 2);
}

function percent(rate: number): string {
  return `${Math.round(rate * 1e4) / 100}%`;
}

/** The program's terms in one line, read live from config. */
function termsLine(terms: ReferralV4Terms): string {
  const schedule = payoutScheduleLabel(
    terms.spendShare.payoutWeekday,
    terms.spendShare.payoutHourUtc,
  );
  return [
    `Welcome ${money(terms.welcome.referrerUsd)} + ${money(
      terms.welcome.friendUsd,
    )} for ${money(terms.welcome.spendTargetUsd)} at ${
      terms.welcome.merchantTarget
    } shops in ${terms.welcome.windowDays} days`,
    `big spender ${money(terms.bigSpender.referrerUsd)} + ${money(
      terms.bigSpender.friendUsd,
    )} for ${money(terms.bigSpender.spendTargetUsd)} in ${
      terms.bigSpender.windowDays
    } days`,
    `upgrade ${money(terms.upgrade.primeUsd)} Prime / ${money(
      terms.upgrade.ultraUsd,
    )} Ultra`,
    `${percent(terms.spendShare.rate)} of spend up to ${money(
      terms.spendShare.capPerFriendUsd,
    )} per friend`,
    `${terms.holdDays}-day hold`,
    schedule && `paid ${schedule}`,
    terms.clawback &&
      (terms.clawback.enabled
        ? `clawback within ${terms.clawback.watchDays} days of crediting`
        : "clawback off"),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** When the step's next thing happens, or happened. */
function stepWhen(step: {
  status: string;
  deadlineAt?: string;
  unlocksAt?: string;
  creditedAt?: string;
  earnedAt?: string;
  reversedAt?: string;
}): string | null {
  switch (step.status) {
    case "in_progress":
    case "locked":
      return step.deadlineAt ? `by ${formatUtcDay(step.deadlineAt)}` : null;
    case "on_hold":
      return step.unlocksAt ? `unlocks ${formatUtcDay(step.unlocksAt)}` : null;
    case "credited":
    case "paid":
      return step.creditedAt
        ? `credited ${formatUtcDay(step.creditedAt)}`
        : null;
    case "limit_reached":
    case "under_review":
      return step.earnedAt ? `earned ${formatUtcDay(step.earnedAt)}` : null;
    case "reversed":
      return step.reversedAt
        ? `reversed ${formatUtcDay(step.reversedAt)}`
        : null;
    default:
      return null;
  }
}

function StepChip({ step }: { step?: ReferralV4StepView }) {
  if (!step) return <span className="text-gray-400">—</span>;
  const status = referralV4Status(step.status);
  const when = stepWhen(step);
  const showProgress =
    (step.status === "in_progress" || step.status === "locked") &&
    typeof step.targetUsd === "number";

  return (
    <div className="space-y-0.5">
      <Badge variant={status.variant}>{status.label}</Badge>
      <p className="text-[11px] font-medium text-gray-800">
        {money(step.amountUsd)}
      </p>
      {showProgress && (
        <p className="text-[11px] whitespace-nowrap text-gray-500">
          {money(step.progressUsd)} of {money(step.targetUsd)}
          {typeof step.merchantTarget === "number" &&
            ` · ${step.merchantCount ?? 0}/${step.merchantTarget} shops`}
        </p>
      )}
      {when && (
        <p className="text-[11px] whitespace-nowrap text-gray-500">{when}</p>
      )}
      <OffsetNote usd={step.offsetUsd} />
    </div>
  );
}

/** The part of a bonus that went to repaying a reversed one, if any. */
function OffsetNote({ usd }: { usd?: number }) {
  if (!usd || usd <= 0) return null;
  return (
    <p className="text-[11px] text-amber-700">
      {money(usd)} repaid a reversed bonus
    </p>
  );
}

function UpgradeChip({ upgrade }: { upgrade?: ReferralV4UpgradeView }) {
  if (!upgrade) return <span className="text-gray-400">—</span>;
  const status = referralV4Status(upgrade.status);
  const when = stepWhen(upgrade);

  return (
    <div className="space-y-0.5">
      <Badge variant={status.variant}>{status.label}</Badge>
      <p className="text-[11px] font-medium text-gray-800">
        {money(upgrade.amountUsd)}
        {upgrade.tier && (
          <span className="font-normal text-gray-500">
            {" "}
            · {upgrade.tier === "ultra" ? "Ultra" : "Prime"}
            {upgrade.via ? ` (${upgrade.via})` : ""}
          </span>
        )}
      </p>
      {upgrade.via === "lock" && upgrade.lockEligibleAt && !upgrade.earnedAt && (
        <p className="text-[11px] whitespace-nowrap text-gray-500">
          lock counts {formatUtcDay(upgrade.lockEligibleAt)}
        </p>
      )}
      {when && (
        <p className="text-[11px] whitespace-nowrap text-gray-500">{when}</p>
      )}
      <OffsetNote usd={upgrade.offsetUsd} />
    </div>
  );
}

function CapBar({ earned, cap }: { earned: number; cap: number }) {
  const share = cap > 0 ? Math.min(100, (earned / cap) * 100) : 0;
  return (
    <div className="w-28">
      <div className="h-1.5 rounded-full bg-gray-100">
        <div
          className={`h-1.5 rounded-full ${
            share >= 100 ? "bg-indigo-500" : "bg-emerald-500"
          }`}
          style={{ width: `${share}%` }}
        />
      </div>
      <p className="mt-0.5 text-[11px] whitespace-nowrap text-gray-600">
        {money(earned)} of {money(cap)}
      </p>
    </div>
  );
}

function CountryCell({ row }: { row: AdminReferralV4FriendRow }) {
  const id = row.idCountry;
  const residence = row.country;
  return (
    <div className="space-y-0.5 whitespace-nowrap">
      <p className="font-mono text-gray-700">
        {id ?? residence ?? "—"}
        {id && residence && id !== residence && (
          <span className="text-gray-400"> · res. {residence}</span>
        )}
      </p>
      {id && <p className="text-[10px] text-gray-400">ID document</p>}
      {row.countryExcluded && <Badge variant="warning">Excluded</Badge>}
    </div>
  );
}

function ProgramBadge({ program }: { program: string }) {
  return program === "v4" ? (
    <Badge variant="info">v4</Badge>
  ) : (
    <Badge variant="muted">Legacy</Badge>
  );
}

/** A legacy friend's reward, in place of the three v4 step columns. */
function LegacyCell({ row }: { row: AdminReferralV4FriendRow }) {
  const legacy = row.legacy;
  return (
    <div className="space-y-0.5 text-[11px] text-gray-600">
      <p>
        <span className="font-medium text-gray-800">
          {legacy?.status ?? legacy?.stage ?? row.stage}
        </span>
        {typeof legacy?.rewardUsd === "number" &&
          ` · ${money(legacy.rewardUsd)} ${legacy.payoutToken ?? "soFUSE"}`}
      </p>
      {typeof legacy?.spendUsd === "number" &&
        typeof legacy?.spendTargetUsd === "number" && (
          <p>
            {formatUsd(legacy.spendUsd)} of {money(legacy.spendTargetUsd)}
            {typeof legacy.merchantTarget === "number" &&
              ` · ${legacy.merchantCount ?? 0}/${legacy.merchantTarget} shops`}
          </p>
        )}
      {legacy?.paidAt && <p>paid {formatUtcDay(legacy.paidAt)}</p>}
      {!legacy?.paidAt && legacy?.payoutEtaAt && (
        <p>pays {formatUtcDay(legacy.payoutEtaAt)}</p>
      )}
      <p className="text-gray-400">
        Legacy program — see Referral cashback below
      </p>
    </div>
  );
}

/** Every reward from one friend, with Cancel on the uncredited ones. */
function RewardsTable({
  rewards,
  friendLabel,
  canCancel,
}: {
  rewards: AdminReferralV4Reward[];
  friendLabel: string;
  canCancel: boolean;
}) {
  if (rewards.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No rewards earned from this friend yet.
      </p>
    );
  }

  return (
    <table className="min-w-full text-xs">
      <thead className="text-gray-500">
        <tr>
          <th className="px-2 py-1 text-left font-medium">Reward</th>
          <th className="px-2 py-1 text-left font-medium">Side</th>
          <th className="px-2 py-1 text-right font-medium">Amount</th>
          <th className="px-2 py-1 text-left font-medium">Status</th>
          <th className="px-2 py-1 text-left font-medium">Dates (UTC)</th>
          <th className="px-2 py-1 text-left font-medium">Notes</th>
          <th className="px-2 py-1" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rewards.map((reward) => {
          const status = referralV4Status(reward.status);
          const dates = [
            reward.earnedAt && `earned ${formatUtcDay(reward.earnedAt)}`,
            reward.unlocksAt &&
              reward.status === "on_hold" &&
              `unlocks ${formatUtcDay(reward.unlocksAt)}`,
            reward.creditedAt &&
              `credited ${formatUtcDay(reward.creditedAt)}`,
            reward.cancelledAt &&
              `cancelled ${formatUtcDay(reward.cancelledAt)}`,
            reward.reversedAt &&
              `reversed ${formatUtcDay(reward.reversedAt)}`,
          ].filter(Boolean);
          const offset = reward.debtOffsetUsd ?? 0;
          const reversed = reward.status === "reversed";

          return (
            <tr key={reward.id} className="align-top">
              <td className="px-2 py-1.5 font-medium text-gray-800">
                {referralV4StepLabel(reward.step)}
              </td>
              <td className="px-2 py-1.5 text-gray-600">{reward.side}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap text-gray-900">
                {money(reward.amountUsd)}
                {(reward.boostMultiplier ?? 1) > 1 && (
                  <span className="ml-1 text-[10px] text-indigo-600">
                    ×{reward.boostMultiplier} boost
                  </span>
                )}
              </td>
              <td className="px-2 py-1.5">
                <Badge variant={status.variant}>{status.label}</Badge>
              </td>
              <td className="px-2 py-1.5 text-gray-500">
                {dates.length ? dates.join(" · ") : "—"}
              </td>
              <td className="px-2 py-1.5 text-gray-600">
                {reward.reviewReason && <p>Review: {reward.reviewReason}</p>}
                {reward.cancelReason && (
                  <p className="text-red-700">“{reward.cancelReason}”</p>
                )}
                {reversed && (
                  <p className="text-red-700">
                    Refunded below the bar after crediting — debt booked
                  </p>
                )}
                {offset > 0 && (
                  <p className="text-amber-700">
                    {money(offset)} repaid a reversed bonus
                  </p>
                )}
                {!reward.reviewReason &&
                  !reward.cancelReason &&
                  !reversed &&
                  offset <= 0 &&
                  "—"}
              </td>
              <td className="px-2 py-1.5 text-right">
                {canCancel && CANCELLABLE_V4_STATUSES.has(reward.status) && (
                  <CancelReferralV4RewardDialog
                    reward={reward}
                    friendLabel={friendLabel}
                  />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Stat({
  label,
  value,
  detail,
  warn = false,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p
        className={`text-sm font-semibold ${
          warn ? "text-amber-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {detail && <p className="text-[11px] text-gray-500">{detail}</p>}
    </div>
  );
}

function ReferrerSection({
  data,
  canCancel,
  reviewWindowDays,
}: {
  data: AdminUserReferralsV4;
  canCancel: boolean;
  /** From the config; undefined while it loads. */
  reviewWindowDays?: number;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const { asReferrer } = data;
  const { bonusLimit } = asReferrer;
  const totals = asReferrer.totals ?? {
    earnedUsd: 0,
    thisMonthUsd: 0,
    onHoldUsd: 0,
    pendingSpendShareUsd: 0,
    nextPayoutAt: "",
  };
  const friends = asReferrer.friends ?? [];
  const overThreshold =
    asReferrer.monthQualifiedCount > asReferrer.reviewThreshold;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase text-gray-500">
        As a referrer
      </h3>
      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-6">
        <Stat
          label="Bonus limit"
          value={bonusLimit ? `${bonusLimit.used} of ${bonusLimit.limit}` : "Off"}
          detail={
            bonusLimit && bonusLimit.waiting > 0
              ? `${bonusLimit.waiting} waiting for the limit to grow`
              : bonusLimit
                ? "welcome bonuses used"
                : undefined
          }
          warn={!!bonusLimit && bonusLimit.waiting > 0}
        />
        <Stat
          label={
            reviewWindowDays
              ? `Qualified, last ${reviewWindowDays} days`
              : "Qualified, review window"
          }
          value={`${asReferrer.monthQualifiedCount} / ${asReferrer.reviewThreshold}`}
          detail={
            overThreshold ? (
              <Link
                href="/referral-v4-review"
                className="text-amber-700 underline"
              >
                Over the review threshold
              </Link>
            ) : (
              "against the review threshold"
            )
          }
          warn={overThreshold}
        />
        <Stat label="Earned" value={formatUsd(totals.earnedUsd)} detail="lifetime, v4 + legacy" />
        <Stat label="This month" value={formatUsd(totals.thisMonthUsd)} detail="UTC month" />
        <Stat label="On hold" value={formatUsd(totals.onHoldUsd)} detail="earned, not credited" />
        <Stat
          label="Next payout"
          value={formatUtcDay(totals.nextPayoutAt)}
          detail={`${formatUsd(totals.pendingSpendShareUsd)} spend share so far`}
        />
      </div>

      {friends.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nobody has signed up with this user&apos;s code yet.
        </p>
      ) : (
        <div className="max-h-[32rem] overflow-auto rounded-lg border border-gray-100">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
              <tr>
                <th className="w-6 px-2 py-2" />
                <th className="px-3 py-2 text-left font-medium">Friend</th>
                <th className="px-3 py-2 text-left font-medium">Joined</th>
                <th className="px-3 py-2 text-left font-medium">Country</th>
                <th className="px-3 py-2 text-left font-medium">Stage</th>
                <th className="px-3 py-2 text-left font-medium">Welcome</th>
                <th className="px-3 py-2 text-left font-medium">
                  Big spender
                </th>
                <th className="px-3 py-2 text-left font-medium">Upgrade</th>
                <th className="px-3 py-2 text-left font-medium">
                  Spend share
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  Earned vs cap
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {friends.map((row) => {
                const open = expanded.has(row.referredUserId);
                const stage = referralV4Stage(row.stage);
                const label = row.username || "this friend";
                return (
                  <Fragment key={row.referredUserId}>
                    <tr
                      className="cursor-pointer align-top hover:bg-gray-50"
                      onClick={() => toggle(row.referredUserId)}
                    >
                      <td className="px-2 py-2 text-gray-400">
                        {open ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <UserLink
                            userId={row.referredUserId}
                            username={row.username}
                          />
                          <ProgramBadge program={row.program} />
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                        {formatUtcDay(row.joinedAt)}
                      </td>
                      <td className="px-3 py-2">
                        <CountryCell row={row} />
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={stage.variant}>{stage.label}</Badge>
                      </td>
                      {row.program === "legacy" ? (
                        <td className="px-3 py-2" colSpan={3}>
                          <LegacyCell row={row} />
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2">
                            <StepChip step={row.welcome} />
                          </td>
                          <td className="px-3 py-2">
                            <StepChip step={row.bigSpender} />
                          </td>
                          <td className="px-3 py-2">
                            <UpgradeChip upgrade={row.upgrade} />
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                        {row.program === "v4" ? (
                          <>
                            <p className="font-medium">
                              {formatUsd(row.spendShare?.earnedUsd ?? 0)}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {formatUsd(row.spendShare?.thisWeekUsd ?? 0)} this
                              week
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <CapBar earned={row.earnedUsd} cap={row.capUsd} />
                        {row.onHoldUsd > 0 && (
                          <p className="text-[11px] text-amber-700">
                            +{formatUsd(row.onHoldUsd)} on hold
                          </p>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-gray-50/60">
                        <td />
                        <td className="px-3 py-2" colSpan={9}>
                          <RewardsTable
                            rewards={row.rewards ?? []}
                            friendLabel={label}
                            canCancel={canCancel}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** This user's own invite: who referred them and what it has earned. */
function FriendSection({
  row,
  canCancel,
}: {
  row: AdminReferralV4FriendRow | null;
  canCancel: boolean;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase text-gray-500">
        As a referred friend
      </h3>
      {!row ? (
        <p className="text-sm text-gray-500">
          Not referred, or not tracked by the referral engine.
        </p>
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-100 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-gray-700">
            <span>Invited by</span>
            <UserLink userId={row.referrerId} />
            <ProgramBadge program={row.program} />
            <span className="text-gray-500">
              · joined {formatUtcDay(row.joinedAt)}
            </span>
            <Badge variant={referralV4Stage(row.stage).variant}>
              {referralV4Stage(row.stage).label}
            </Badge>
            {row.countryExcluded && (
              <Badge variant="warning">
                Excluded country {row.idCountry ?? row.country ?? ""}
              </Badge>
            )}
          </div>
          {row.program === "legacy" ? (
            <LegacyCell row={row} />
          ) : (
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="mb-1 text-[11px] uppercase text-gray-500">
                  Welcome
                </p>
                <StepChip step={row.welcome} />
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase text-gray-500">
                  Big spender
                </p>
                <StepChip step={row.bigSpender} />
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase text-gray-500">
                  Upgrade (referrer)
                </p>
                <UpgradeChip upgrade={row.upgrade} />
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase text-gray-500">
                  Referrer earned
                </p>
                <CapBar earned={row.earnedUsd} cap={row.capUsd} />
              </div>
            </div>
          )}
          {(row.rewards ?? []).length > 0 && (
            <div className="rounded-md border border-gray-100 bg-gray-50/60 p-2">
              <RewardsTable
                rewards={row.rewards}
                friendLabel={row.username || "this user"}
                canCancel={canCancel}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Referral program v4 from both sides: this user as a referrer — bonus limit,
 * review-threshold count, totals and every friend with their welcome, big
 * spender, upgrade and spend-share progress — and their own invite.
 *
 * A row expands to the rewards behind it, with Cancel on the ones earned but
 * not yet credited (on hold, over the bonus limit, under review) for admins
 * who can review. Legacy friends (signed up before launch) are listed too,
 * with their legacy status; their full detail and re-evaluate action stay on
 * the Referral cashback card. Debts from reversed bonuses close the card, with
 * Write off on the open ones for the same admins.
 */
export default function UserReferralV4Card({ userId }: { userId: string }) {
  return (
    <CardErrorBoundary title="Referral v4 — card credit">
      <ReferralV4CardBody userId={userId} />
    </CardErrorBoundary>
  );
}

function ReferralV4CardBody({ userId }: { userId: string }) {
  const { data, isLoading, error } = useUserReferralsV4(userId);
  const access = useReferralV4Access();
  const canCancel = access.data?.canReview === true;
  // Writing off a debt forgoes money owed, so it takes the card-credit
  // permission the backend checks, not the review one.
  const canWriteOff = access.data?.canManageCredit === true;
  const notAvailable = !!error && isNotAvailable(error);
  const terms = data?.terms;
  const reviewWindowDays = useReferralV4Config().data?.reviewWindowDays;
  const openDebtUsd = (Array.isArray(data?.debts) ? data.debts : [])
    .filter((debt) => debt.status === "open")
    .reduce((sum, debt) => sum + (Number(debt.remainingUsd) || 0), 0);

  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-gray-400" />
          Referral v4 — card credit
        </CardTitle>
        {terms && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {terms.boost && (
              <Badge variant="info">
                <Zap />
                {terms.boost.name} ×{terms.boost.multiplier}
              </Badge>
            )}
            {openDebtUsd > 0 && (
              <Badge variant="warning">Owes {formatUsd(openDebtUsd)}</Badge>
            )}
            {terms.paused && (
              <Badge variant="danger">
                <PauseCircle />
                Payouts paused
              </Badge>
            )}
            {terms.enabled ? (
              <Badge variant="success">
                Open to new signups
                {terms.launchAt ? ` from ${formatUtcDay(terms.launchAt)}` : ""}
              </Badge>
            ) : (
              <Badge variant="muted">Closed to new signups</Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : notAvailable ? (
          <NotAvailableYet what="Referral v4" />
        ) : error || !data ? (
          <p className="text-sm text-red-600">Failed to load referral v4.</p>
        ) : (
          <div className="space-y-5">
            {terms?.welcome && terms.bigSpender && terms.upgrade && terms.spendShare && (
              <p className="text-xs text-gray-500">{termsLine(terms)}</p>
            )}
            {data.asReferrer && (
              <ReferrerSection
                data={data}
                canCancel={canCancel}
                reviewWindowDays={reviewWindowDays}
              />
            )}
            <FriendSection row={data.asFriend ?? null} canCancel={canCancel} />
            {Array.isArray(data.debts) && (
              <ReferralV4DebtsSection
                debts={data.debts}
                canWriteOff={canWriteOff}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
