"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TIER_BALANCE_TIER_LABELS,
  TIER_BALANCE_TIER_VARIANT,
  TIER_BALANCE_TRACK_STATUS,
  tierBalanceUsd,
} from "@/lib/tier-balance";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type {
  TierBalanceBreakdownDto,
  TierBalanceGrantTier,
  TierBalanceRouteDto,
  TierBalanceTrackDto,
} from "@/types";

/**
 * The pieces the Hold in Earn user card and its re-evaluate dialog both show:
 * a tier, a track, and what a balance is made of.
 */

export function TierBalanceStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
      {hint && <dd className="text-xs text-gray-500">{hint}</dd>}
    </div>
  );
}

export function TierBalanceTierBadge({ tier }: { tier: TierBalanceGrantTier }) {
  return (
    <Badge variant={TIER_BALANCE_TIER_VARIANT[tier] ?? "muted"}>
      {TIER_BALANCE_TIER_LABELS[tier] ?? tier}
    </Badge>
  );
}

export function TrackStatusBadge({ track }: { track: TierBalanceTrackDto }) {
  const status = TIER_BALANCE_TRACK_STATUS[track.status];
  return (
    <Badge variant={status?.variant ?? "muted"} title={status?.hint}>
      {status?.label ?? track.status}
    </Badge>
  );
}

/** The date that matters for a track in its state, or null. */
export function trackDate(track: TierBalanceTrackDto): string | null {
  switch (track.status) {
    case "building":
      return track.qualifiesOn ? `Unlocks ${track.qualifiesOn} (UTC)` : null;
    case "active":
      return track.unlockedAt
        ? `Unlocked ${formatDateTime(track.unlockedAt)}`
        : null;
    case "grace":
      return track.graceEndsAt
        ? `Ends ${formatDateTime(track.graceEndsAt)} unless back above`
        : null;
    case "cooldown":
      return track.reentryAt
        ? `Can unlock again ${formatDateTime(track.reentryAt)}`
        : null;
    default:
      return null;
  }
}

/** One tier's track: where it stands, against what, and when it moves next. */
export function TrackPanel({
  track,
  lookbackDays,
}: {
  track: TierBalanceTrackDto;
  lookbackDays: number;
}) {
  const status = TIER_BALANCE_TRACK_STATUS[track.status];
  const date = trackDate(track);
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-900">
          {TIER_BALANCE_TIER_LABELS[track.tier] ?? track.tier}
        </span>
        <TrackStatusBadge track={track} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <TierBalanceStat
          label={
            track.status === "active" || track.status === "grace"
              ? "Pinned threshold"
              : "Threshold"
          }
          value={tierBalanceUsd(track.thresholdUsd)}
        />
        <TierBalanceStat
          label="Short by"
          value={track.shortfallUsd > 0 ? tierBalanceUsd(track.shortfallUsd) : "—"}
        />
        <TierBalanceStat
          label="Progress"
          value={`${formatNumber(track.progressPct, 0, 0)}%`}
        />
        <TierBalanceStat
          label="Days held"
          value={`${formatNumber(track.daysHeld, 0, 0)} of ${formatNumber(
            lookbackDays,
            0,
            0,
          )}`}
        />
      </dl>
      {date && <p className="mt-2 text-xs font-medium text-gray-700">{date}</p>}
      {status && <p className="mt-1 text-xs text-gray-500">{status.hint}</p>}
    </div>
  );
}

const VAULT_LABELS: Array<{
  key: keyof TierBalanceBreakdownDto["byVault"];
  label: string;
}> = [
  { key: "usd", label: "soUSD" },
  { key: "eur", label: "soEUR" },
  { key: "eth", label: "soETH" },
  { key: "btc", label: "soBTC" },
  { key: "fuse", label: "soFUSE" },
];

/**
 * What a qualifying balance is made of: by source (Safe, Credit collateral,
 * locked soFUSE, less Credit debt) and by vault. Each source says whether the
 * rules count it, so a figure that does not add up explains itself.
 */
export function BreakdownTables({
  breakdown,
  rules,
}: {
  breakdown: TierBalanceBreakdownDto;
  rules?: TierBalanceRouteDto["rules"];
}) {
  const sources = [
    { label: "In the Safe", usd: breakdown.walletUsd, note: null },
    {
      label: "Credit collateral",
      usd: breakdown.creditCollateralUsd,
      note: rules && !rules.countsCreditCollateral ? "not counted" : null,
    },
    {
      label: "Locked soFUSE",
      usd: breakdown.lockedFuseUsd,
      note: rules && !rules.countsLockedFuse ? "not counted" : null,
    },
    {
      label: "Credit debt",
      usd: -breakdown.creditDebtUsd,
      note: rules && !rules.subtractsCreditDebt ? "not subtracted" : null,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">USD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => (
            <TableRow key={source.label}>
              <TableCell>
                {source.label}
                {source.note && (
                  <span className="ml-1 text-xs text-gray-400">
                    ({source.note})
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {source.usd < 0
                  ? `−${tierBalanceUsd(-source.usd)}`
                  : tierBalanceUsd(source.usd)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vault</TableHead>
            <TableHead className="text-right">USD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {VAULT_LABELS.map(({ key, label }) => (
            <TableRow key={key}>
              <TableCell>{label}</TableCell>
              <TableCell className="text-right">
                {tierBalanceUsd(breakdown.byVault?.[key])}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
