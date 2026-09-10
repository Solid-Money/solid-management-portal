"use client";

import { Info } from "lucide-react";
import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import { Panel } from "@/components/analytics/panel";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters";
import { CardDailyStackedChart } from "@/components/analytics/card/card-daily-stacked-chart";
import { useCardDaily } from "@/hooks/use-analytics";
import { formatNumber, formatUsd } from "@/lib/utils";
import { CARD_RAILS, type CardDailySeries } from "@/types/analytics";

export function CardSpendingView() {
  const { queryString, filters } = useAnalyticsFilters();
  const { data, isLoading, error } = useCardDaily(queryString());

  const scope = `${filters.startDate} to ${filters.endDate}`;
  const deposits = data?.deposits;
  const spend = data?.spend;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpiCard
          title="Card deposits"
          metric="cardDeposit"
          value={deposits ? formatUsd(deposits.totals.totalUsd) : undefined}
          scope={`Money onto cards, ${scope}`}
          source={deposits?.meta.source}
          updatedAt={deposits?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Card spending"
          metric="cardSpending"
          value={spend ? formatUsd(spend.totals.totalUsd) : undefined}
          scope={`Settled purchases, both rails, ${scope}`}
          source={spend?.meta.source}
          updatedAt={spend?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Purchases"
          value={
            spend ? formatNumber(spend.totals.totalCount, 0, 0) : undefined
          }
          scope="Settled card purchases in the period"
          source={spend?.meta.source}
          updatedAt={spend?.meta.updatedAt}
        />
        <AnalyticsKpiCard
          title="Average ticket"
          value={
            spend
              ? spend.totals.totalCount > 0
                ? formatUsd(spend.totals.totalUsd / spend.totals.totalCount)
                : formatUsd(0)
              : undefined
          }
          scope="Spend ÷ purchases. Coffee or rent?"
          source="derived"
          updatedAt={spend?.meta.updatedAt}
        />
      </div>

      <Panel
        title="Card deposits per day"
        question="How much money is going onto cards, and on which rail?"
        source={deposits?.meta.source}
        updatedAt={deposits?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
        actions={deposits ? <RailSplit series={deposits} /> : null}
      >
        {deposits ? (
          <div className="space-y-4">
            <CardDailyStackedChart
              series={deposits}
              emptyLabel="No card deposits in this period."
            />
            {deposits.unavailableRails.map((rail) => (
              <RailNote key={rail.rail} reason={rail.reason} />
            ))}
            <p className="text-xs leading-relaxed text-gray-500">
              Rain reports collateral in cents; the figures here are converted
              to dollars. Withdrawals back off the card are excluded rather than
              netted — a deposit and a withdrawal on the same day are two
              events, not a smaller deposit. Deprecated bridge.xyz cards are
              excluded everywhere on this tab.
            </p>
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Card spend per day"
        question="How much is being spent on cards, and on which rail?"
        source={spend?.meta.source}
        updatedAt={spend?.meta.updatedAt}
        isLoading={isLoading}
        error={error}
        actions={spend ? <RailSplit series={spend} /> : null}
      >
        {spend ? (
          <div className="space-y-4">
            <CardDailyStackedChart
              series={spend}
              emptyLabel="No settled card spend in this period."
            />
            <p className="text-xs leading-relaxed text-gray-500">
              Settled purchases only, in USD. Declines, reversals and refunds
              are excluded rather than netted, which is the same definition the
              referral spend bar uses — so a figure here and a friend&apos;s
              qualifying spend cannot disagree. Both rails come from the one
              card transaction ledger: Wirex amounts are stored in dollars with
              the merchant&apos;s own currency alongside, so a Polish grocery
              run counts as its dollar value and not as 118.
            </p>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

/**
 * The rail split as a single line, beside the chart title.
 *
 * The stacked bars answer "how did this move over time"; a reader also wants
 * "how much of this is Wirex" without reading every segment, and a share is
 * quicker than two totals.
 */
function RailSplit({ series }: { series: CardDailySeries }) {
  const unavailable = new Set(
    series.unavailableRails.map((entry) => entry.rail)
  );
  const total = series.totals.totalUsd;

  const parts = CARD_RAILS.filter((rail) => !unavailable.has(rail.id)).map(
    (rail) => {
      const usd = rail.id === "rain" ? series.totals.rainUsd : series.totals.wirexUsd;
      return {
        ...rail,
        usd,
        share: total > 0 ? (usd / total) * 100 : null,
      };
    }
  );

  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-3 text-xs">
      {parts.map((part) => (
        <span key={part.id} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: part.color }}
          />
          <span className="text-gray-600">{part.label}</span>
          <span className="font-medium text-gray-900">
            {formatUsd(part.usd, 0)}
          </span>
          {part.share !== null ? (
            <span className="text-gray-400">
              {part.share.toFixed(0)}%
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

/** Why a rail is absent from a chart, stated rather than left as a gap. */
function RailNote({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
      <p className="text-xs leading-relaxed text-gray-600">{reason}</p>
    </div>
  );
}

export default CardSpendingView;
