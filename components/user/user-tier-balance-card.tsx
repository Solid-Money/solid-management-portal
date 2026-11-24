"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, PiggyBank, RefreshCw } from "lucide-react";

import { NotAvailableYet } from "@/components/referral-v4/not-available";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ReevaluateTierBalanceDialog from "@/components/user/reevaluate-tier-balance-dialog";
import {
  BreakdownTables,
  TierBalanceStat,
  TierBalanceTierBadge,
  TrackPanel,
} from "@/components/user/tier-balance-parts";
import { getUserTierBalance } from "@/lib/api";
import { isNotAvailable } from "@/lib/referral-v4";
import {
  TIER_BALANCE_ACCESS_REASON,
  TIER_BALANCE_EVENT_CAUSE,
  TIER_BALANCE_EVENT_TYPE,
  tierBalanceUsd,
} from "@/lib/tier-balance";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type {
  TierBalanceDayView,
  TierBalanceRouteDto,
  TierBalanceUserView,
} from "@/types";

const days = (value: number) =>
  `${formatNumber(value, 0, 0)} day${value === 1 ? "" : "s"}`;

/**
 * Which tier a day's lowest balance clears, against the thresholds on the
 * tracks (pinned while a tier is held, today's otherwise).
 */
function dayMeets(day: TierBalanceDayView, route: TierBalanceRouteDto) {
  if (day.minUsd === null) return null;
  if (day.minUsd >= route.ultra.thresholdUsd) return "ultra" as const;
  if (day.minUsd >= route.prime.thresholdUsd) return "prime" as const;
  return "core" as const;
}

/**
 * The Hold in Earn route for one user: whether they have access and why, the
 * tier it grants, each track, and — on the user page — the daily readings,
 * event log and granted periods it was judged on, with the Re-evaluate action.
 *
 * The route is computed even for a user without access, so support can see
 * what releasing it would mean for them. `compact` (the support inbox) keeps
 * the summary and tracks and links to the rest.
 */
export default function UserTierBalanceCard({
  userId,
  compact = false,
}: {
  userId: string;
  compact?: boolean;
}) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["user-tier-balance", userId],
    queryFn: async () => (await getUserTierBalance(userId)).data.data,
    enabled: Boolean(userId),
  });

  return (
    <Card className="@container">
      <CardHeader className="flex-wrap">
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-emerald-600" />
          Hold in Earn route
        </CardTitle>
        <CardAction>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="cursor-pointer text-gray-500"
          >
            <RefreshCw className={isFetching ? "animate-spin" : undefined} />
            Refresh
          </Button>
          {data && <ReevaluateTierBalanceDialog userId={userId} />}
        </CardAction>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the route…
          </div>
        ) : isError ? (
          isNotAvailable(error) ? (
            <NotAvailableYet what="The Hold in Earn route" />
          ) : (
            <p className="text-sm text-gray-500">
              Could not read this user&apos;s Hold in Earn route.
            </p>
          )
        ) : data ? (
          <TierBalanceDetails userId={userId} view={data} compact={compact} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function TierBalanceDetails({
  userId,
  view,
  compact,
}: {
  userId: string;
  view: TierBalanceUserView;
  compact: boolean;
}) {
  const { route } = view;
  const access = TIER_BALANCE_ACCESS_REASON[view.accessReason];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={view.hasAccess ? "success" : "muted"}>
          {view.hasAccess ? "Has access" : "No access"}
        </Badge>
        <span className="text-gray-600">
          {access?.label ?? view.accessReason}
        </span>
        {view.accessReason === "not-tagged" && (
          <Link
            href="/internal-team"
            className="font-medium text-indigo-600 hover:underline"
          >
            Tag on Internal team
          </Link>
        )}
      </div>
      {!view.hasAccess && (
        <p className="text-xs text-gray-500">
          Computed anyway: this is what the route would grant them with
          access. It grants nothing while they have none.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @lg:grid-cols-4">
        <TierBalanceStat
          label="Route grants"
          value={<TierBalanceTierBadge tier={route.grantsTier} />}
        />
        <TierBalanceStat
          label="Holds current tier"
          value={route.holdsCurrentTier ? "Yes" : "No"}
          hint={
            route.holdsCurrentTier
              ? "Their tier would be lower without it"
              : undefined
          }
        />
        <TierBalanceStat
          label="Current balance"
          value={tierBalanceUsd(route.currentUsd)}
          hint={
            route.measuredAt
              ? formatDateTime(route.measuredAt)
              : "Not measured yet"
          }
        />
        <TierBalanceStat
          label={`Lowest in ${days(route.lookbackDays)}`}
          value={tierBalanceUsd(route.lowestUsd)}
          hint="Measured days only"
        />
      </dl>

      <p className="text-xs text-gray-500">
        Lookback {days(route.lookbackDays)} · grace {days(route.graceDays)} ·
        re-entry {days(route.reentryDays)} · Credit collateral{" "}
        {route.rules.countsCreditCollateral ? "counted" : "not counted"} · Credit
        debt {route.rules.subtractsCreditDebt ? "subtracted" : "not subtracted"}{" "}
        · locked soFUSE{" "}
        {route.rules.countsLockedFuse ? "counted" : "not counted"}
      </p>

      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
        <TrackPanel track={route.ultra} lookbackDays={route.lookbackDays} />
        <TrackPanel track={route.prime} lookbackDays={route.lookbackDays} />
      </div>

      {compact ? (
        <Link
          href={`/users/${userId}?tab=rewards#user-tier-balance`}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
        >
          Daily readings and history on the user page
          <ExternalLink className="h-3 w-3" />
        </Link>
      ) : (
        <>
          <Section title="Latest balance, by source and vault">
            {route.breakdown ? (
              <BreakdownTables breakdown={route.breakdown} rules={route.rules} />
            ) : (
              <p className="text-xs text-gray-500">Not measured yet.</p>
            )}
          </Section>

          <Section
            title={`Daily readings (newest first, ${days(view.days.length)})`}
          >
            <DaysTable view={view} />
          </Section>

          <Section title="Event log">
            <EventsTable view={view} />
          </Section>

          <Section title="Granted periods">
            {view.periods.length === 0 ? (
              <p className="text-xs text-gray-500">
                The route has never granted this user a tier.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.periods.map((period) => (
                    <TableRow key={`${period.tier}-${period.from}`}>
                      <TableCell>
                        <TierBalanceTierBadge tier={period.tier} />
                      </TableCell>
                      <TableCell>{formatDateTime(period.from)}</TableCell>
                      <TableCell>
                        {period.to ? formatDateTime(period.to) : "Now"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-medium text-gray-500 uppercase">
        {title}
      </h4>
      {children}
    </div>
  );
}

function DaysTable({ view }: { view: TierBalanceUserView }) {
  if (view.days.length === 0) {
    return <p className="text-xs text-gray-500">No readings yet.</p>;
  }
  return (
    <div className="max-h-96 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day (UTC)</TableHead>
            <TableHead className="text-right">Lowest</TableHead>
            <TableHead>Clears</TableHead>
            <TableHead className="text-right">Last</TableHead>
            <TableHead className="text-right">Samples</TableHead>
            <TableHead>Lowest at</TableHead>
            <TableHead className="text-right">Safe</TableHead>
            <TableHead className="text-right">Collateral</TableHead>
            <TableHead className="text-right">Locked</TableHead>
            <TableHead className="text-right">Debt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.days.map((day) => {
            const meets = dayMeets(day, view.route);
            return (
              <TableRow key={day.dayKey}>
                <TableCell className="font-medium">{day.dayKey}</TableCell>
                <TableCell className="text-right">
                  {tierBalanceUsd(day.minUsd)}
                </TableCell>
                <TableCell>
                  {meets === null ? (
                    "—"
                  ) : meets === "core" ? (
                    <span className="text-xs text-gray-500">Below Prime</span>
                  ) : (
                    <TierBalanceTierBadge tier={meets} />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {tierBalanceUsd(day.lastUsd)}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(day.samples, 0, 0)}
                  {!day.complete && (
                    <Badge variant="warning" className="ml-1">
                      {formatNumber(day.incompleteSamples, 0, 0)} incomplete
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-gray-500">
                  {day.minAt ? formatDateTime(day.minAt) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {tierBalanceUsd(day.breakdown?.walletUsd)}
                </TableCell>
                <TableCell className="text-right">
                  {tierBalanceUsd(day.breakdown?.creditCollateralUsd)}
                </TableCell>
                <TableCell className="text-right">
                  {tierBalanceUsd(day.breakdown?.lockedFuseUsd)}
                </TableCell>
                <TableCell className="text-right">
                  {tierBalanceUsd(day.breakdown?.creditDebtUsd)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function EventsTable({ view }: { view: TierBalanceUserView }) {
  if (view.events.length === 0) {
    return <p className="text-xs text-gray-500">Nothing has happened yet.</p>;
  }
  return (
    <div className="max-h-80 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Event</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="text-right">Threshold</TableHead>
            <TableHead>Cause</TableHead>
            <TableHead>By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.events.map((event, index) => {
            const type = TIER_BALANCE_EVENT_TYPE[event.type];
            return (
              <TableRow key={`${event.at}-${event.tier}-${event.type}-${index}`}>
                <TableCell>
                  {formatDateTime(event.at)}
                  <span className="block text-xs text-gray-400">
                    day {event.dayKey}
                  </span>
                </TableCell>
                <TableCell>
                  <TierBalanceTierBadge tier={event.tier} />
                </TableCell>
                <TableCell>
                  <Badge variant={type?.variant ?? "muted"}>
                    {type?.label ?? event.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {tierBalanceUsd(event.balanceUsd)}
                </TableCell>
                <TableCell className="text-right">
                  {tierBalanceUsd(event.thresholdUsd)}
                </TableCell>
                <TableCell>
                  {event.cause
                    ? (TIER_BALANCE_EVENT_CAUSE[event.cause] ?? event.cause)
                    : "—"}
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal text-gray-500">
                  {event.adminEmail ?? "System"}
                  {event.reason && (
                    <span className="block text-gray-600">
                      “{event.reason}”
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
