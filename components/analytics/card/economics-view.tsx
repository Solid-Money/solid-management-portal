"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Panel } from "@/components/analytics/panel";
import { useAnalyticsFilters } from "@/components/analytics/analytics-filters";
import { EmptyPanel, RailLabel, formatCount } from "@/components/analytics/card/card-shared";
import { useCardEconomics } from "@/hooks/use-card-analytics";
import { cn, formatUsd } from "@/lib/utils";
import { COST_INPUT_FIELDS } from "@/types/analytics";
import type { CardRailEconomics } from "@/types/card-analytics";

const FX_BASIS_LABEL: Record<CardRailEconomics["revenue"]["fxBasis"], string> = {
  reported: "from Rain's reports",
  estimated: "estimated from our ledger",
  mixed: "partly reported, partly estimated",
};

/**
 * What each card rail earns us and costs us over the window.
 *
 * Revenue is the issuer FX payout attributable to the window plus our own card
 * fees; costs are the contract inputs from Cost inputs applied to the window's
 * volumes. An input nobody has entered leaves its line unpriced — it is named,
 * not counted as zero, so the margin never looks better than it is.
 */
export function CardEconomicsView() {
  const { queryString, filters } = useAnalyticsFilters();
  const { data, isLoading, error } = useCardEconomics(queryString());

  const missingLabels = (data?.missingInputs ?? []).map(
    (key) => COST_INPUT_FIELDS.find((field) => field.key === key)?.label ?? key
  );

  return (
    <div className="space-y-6">
      {missingLabels.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p>
            {missingLabels.length} cost input{missingLabels.length === 1 ? " is" : "s are"} not
            set ({missingLabels.join(", ")}), so those lines are unpriced and the
            contribution below is overstated. Enter them under{" "}
            <Link href="/costs-config" className="font-medium underline">
              Cost inputs
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {isLoading || error || !data ? (
          <Panel
            title="Rail economics"
            question="What does each rail earn and cost us?"
            isLoading={isLoading}
            error={error}
          >
            <EmptyPanel>No data.</EmptyPanel>
          </Panel>
        ) : (
          data.rails.map((rail) => (
            <Panel
              key={rail.rail}
              title={`${rail.rail === "rain" ? "Rain" : "Wirex"} economics`}
              question={`What does ${rail.rail === "rain" ? "Rain" : "Wirex"} earn and cost us, ${filters.startDate} to ${filters.endDate}?`}
              source="derived"
              updatedAt={data.generatedAt}
            >
              <RailEconomics rail={rail} />
            </Panel>
          ))
        )}
      </div>
    </div>
  );
}

function RailEconomics({ rail }: { rail: CardRailEconomics }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <RailLabel rail={rail.rail} className="font-medium text-gray-900" />
        <span className="text-xs text-gray-500">
          {formatUsd(rail.settledSpendUsd)} settled · {formatCount(rail.activeCards)} active cards
        </span>
      </div>

      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-50">
          <tr>
            <td className="py-1.5 text-gray-700">
              Issuer FX payout
              <span className="block text-[11px] text-gray-400">
                {FX_BASIS_LABEL[rail.revenue.fxBasis]}
              </span>
            </td>
            <td className="py-1.5 text-right tabular-nums text-gray-900">
              {formatUsd(rail.revenue.fxPayoutUsd)}
            </td>
          </tr>
          <tr>
            <td className="py-1.5 text-gray-700">Our own card fees</td>
            <td className="py-1.5 text-right tabular-nums text-gray-900">
              {formatUsd(rail.revenue.ownFeesUsd)}
            </td>
          </tr>
          <tr className="font-medium">
            <td className="py-1.5 text-gray-900">Revenue</td>
            <td className="py-1.5 text-right tabular-nums text-gray-900">
              {formatUsd(rail.revenue.totalUsd)}
            </td>
          </tr>
          {rail.costs.map((cost) => (
            <tr key={cost.key}>
              <td className="py-1.5 text-gray-700">
                {cost.label}
                <span className="block text-[11px] text-gray-400">
                  {cost.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 })} ×{" "}
                  {cost.unitUsd === null ? "unset" : formatUsd(cost.unitUsd)}
                </span>
              </td>
              <td
                className={cn(
                  "py-1.5 text-right tabular-nums",
                  cost.usd === null ? "text-amber-700" : "text-gray-900"
                )}
              >
                {cost.usd === null ? "Not set" : `−${formatUsd(cost.usd)}`}
              </td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2 text-gray-900">
              Contribution
              {rail.costsIncomplete ? (
                <span className="block text-[11px] font-normal text-amber-700">
                  Overstated: some costs are not set
                </span>
              ) : null}
            </td>
            <td
              className={cn(
                "py-2 text-right tabular-nums",
                rail.contributionUsd >= 0 ? "text-emerald-700" : "text-red-700"
              )}
            >
              {formatUsd(rail.contributionUsd)}
            </td>
          </tr>
        </tbody>
      </table>

      <dl className="grid grid-cols-3 gap-3 rounded-md bg-gray-50 p-3 text-xs">
        <div>
          <dt className="text-gray-500">Revenue / active card</dt>
          <dd className="text-sm font-medium text-gray-900">
            {rail.revenuePerActiveCardUsd === null ? "—" : formatUsd(rail.revenuePerActiveCardUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Known cost / active card</dt>
          <dd className="text-sm font-medium text-gray-900">
            {rail.costPerActiveCardUsd === null ? "—" : formatUsd(rail.costPerActiveCardUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Revenue per $ spent</dt>
          <dd className="text-sm font-medium text-gray-900">
            {rail.revenueBpsOfSpend === null ? "—" : `${rail.revenueBpsOfSpend.toFixed(1)} bps`}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default CardEconomicsView;
