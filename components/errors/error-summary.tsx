"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import { ErrorGroupsTable } from "@/components/errors/error-groups-table";
import type { ErrorsViewState } from "@/hooks/use-errors-view-state";
import {
  ERROR_KEYS,
  getErrorStats,
  percentChange,
  rangeLabel,
  resolveRange,
  type ErrorGroupsQuery,
} from "@/lib/errors";
import { formatNumber } from "@/lib/utils";

const count = (value?: number) =>
  value === undefined ? undefined : formatNumber(value, 0, 0);

interface ErrorSummaryProps {
  state: ErrorsViewState;
  groupsQuery: ErrorGroupsQuery;
  onPageChange: (page: number) => void;
  onOpen: (fingerprint: string) => void;
}

/**
 * The headline: how much went wrong in the window and how it compares with
 * the window before, then every cause, one row each.
 *
 * The tiles cover every error in the window — the stats endpoint takes no
 * other filter — and say so, so a filtered table under unfiltered tiles is
 * not read as a contradiction.
 */
export function ErrorSummary({
  state,
  groupsQuery,
  onPageChange,
  onOpen,
}: ErrorSummaryProps) {
  const { data: stats } = useQuery({
    queryKey: ERROR_KEYS.stats({ range: state.range }),
    queryFn: () => getErrorStats(resolveRange(state.range)),
    placeholderData: keepPreviousData,
  });

  const scope = `${rangeLabel(state.range)}, all errors`;
  const errorsChange = stats && percentChange(stats.total, stats.previous.total);
  const usersChange =
    stats && percentChange(stats.usersAffected, stats.previous.usersAffected);
  const moneyChange =
    stats &&
    percentChange(stats.moneyFlowFailures, stats.previous.moneyFlowFailures);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpiCard
          title="Errors"
          value={count(stats?.total)}
          scope={scope}
          change={errorsChange?.label}
          trend={errorsChange?.trend}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Users affected"
          value={count(stats?.usersAffected)}
          scope={scope}
          change={usersChange?.label}
          trend={usersChange?.trend}
          invertTrendColor
        />
        <AnalyticsKpiCard
          title="Need engineering"
          value={count(stats?.needEngineering)}
          scope={`${rangeLabel(state.range)}, causes only a code fix can solve`}
        />
        <AnalyticsKpiCard
          title="Money flows failing"
          value={count(stats?.moneyFlowFailures)}
          scope={`${rangeLabel(state.range)}, failed money movements`}
          change={moneyChange?.label}
          trend={moneyChange?.trend}
          invertTrendColor
        />
      </div>

      <ErrorGroupsTable
        query={groupsQuery}
        onPageChange={onPageChange}
        onOpen={(fingerprint) => onOpen(fingerprint)}
      />
    </div>
  );
}
