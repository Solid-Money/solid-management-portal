"use client";

import { useState } from "react";
import { subDays } from "date-fns";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { DateRangePicker } from "@/components/revenue/date-range-picker";
import { FeeRevenueChart } from "@/components/revenue/fee-revenue-chart";
import { KPICard } from "@/components/revenue/kpi-card";
import { useFeeRevenueDetail, useFeeRevenueOverview } from "@/hooks/use-fee-revenue";
import { cn } from "@/lib/utils";
import {
  FeeRevenueGroupBy,
  FeeRevenueProductRow,
  FeeRevenueType,
  FEE_REVENUE_COLORS,
} from "@/types/revenue";

const GROUP_BY_OPTIONS: { label: string; value: FeeRevenueGroupBy }[] = [
  { label: "Daily", value: "day" },
  { label: "Weekly", value: "week" },
  { label: "Monthly", value: "month" },
];

const formatUsd = (value: number) =>
  `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatCount = (value: number) => value.toLocaleString();

/**
 * A period-over-period change, and which way to colour it.
 *
 * Null when there is no baseline, which the caller renders as "—" rather than
 * "0%": the first period after a fee is switched on has nothing to compare to,
 * and 0% would read as "flat" on revenue that just started.
 */
const formatChange = (changePercent: number | null) => {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return { text: undefined, trend: undefined as "up" | "down" | "flat" | undefined };
  }
  const rounded = Math.round(changePercent * 10) / 10;
  return {
    text: `${rounded >= 0 ? "+" : ""}${rounded}%`,
    trend: rounded > 0 ? ("up" as const) : rounded < 0 ? ("down" as const) : ("flat" as const),
  };
};

/** Rail → how that fee actually reached us, for the detail rows. */
const RAIL_LABELS: Record<string, string> = {
  rain: "Rain",
  wirex: "Wirex",
  bank: "Bank",
  onchain: "On-chain",
};

/**
 * Product fee revenue.
 *
 * The table is the primary surface and the chart is secondary: every number on
 * the chart is in a row beneath it, which is what makes the whole view readable
 * without relying on colour. Opening a product row fetches the individual
 * charges behind its total, so a figure here can always be traced to the
 * transaction that produced it.
 */
export function ProductFeesView() {
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });
  const [groupBy, setGroupBy] = useState<FeeRevenueGroupBy>("day");
  const [expanded, setExpanded] = useState<FeeRevenueType | null>(null);

  const { data, isLoading, isError, isFetching } = useFeeRevenueOverview(
    dateRange.start,
    dateRange.end,
    groupBy,
  );

  const products = data?.products ?? [];
  const totals = data?.totals;
  const totalsChange = formatChange(totals?.changePercent ?? null);

  return (
    <div className="space-y-6">
      {/* One filter row above everything it scopes, so the tiles, the chart and
          the table always show the same slice. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Product Fees</h2>
          <p className="text-sm text-gray-500">
            What each product earns per tier. Fees are recorded as revenue when
            they are charged, at the tier the user held at the time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-200 bg-white p-0.5">
            {GROUP_BY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setGroupBy(option.value)}
                className={cn(
                  "cursor-pointer rounded px-3 py-1.5 text-sm transition-colors",
                  groupBy === option.value
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-50",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onRangeChange={(start, end) => setDateRange({ start, end })}
          />
        </div>
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Could not load fee revenue. The analytics service may be unavailable.
        </div>
      ) : null}

      {/* Held at reduced opacity while refetching rather than replaced by a
          skeleton, so the numbers don't flash and the layout doesn't jump. */}
      <div className={cn("space-y-6 transition-opacity", isFetching && "opacity-60")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <KPICard
            title="Total fees"
            value={isLoading ? "—" : formatUsd(totals?.revenue ?? 0)}
            change={totalsChange.text}
            trend={totalsChange.trend}
            description="Across every product, in the selected period"
          />
          <KPICard
            title="Fees charged"
            value={isLoading ? "—" : formatCount(totals?.feeCount ?? 0)}
            description="Individual charges, waived fees excluded"
          />
          <KPICard
            title="Previous period"
            value={isLoading ? "—" : formatUsd(totals?.previousRevenue ?? 0)}
            description="The equal-length window before this one"
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Revenue growth</h3>
          <p className="mb-4 text-sm text-gray-500">
            Fees charged per {groupBy === "day" ? "day" : groupBy}, stacked by product
          </p>
          {isLoading ? (
            <div className="flex h-[320px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <FeeRevenueChart
              growth={data?.growth ?? []}
              products={products}
              groupBy={groupBy}
            />
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">Fees by product</h3>
            <p className="text-sm text-gray-500">
              Open a product to see the charges behind its total
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Product
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fees
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Users
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                      No fee products configured.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <ProductRow
                      key={product.revenueType}
                      product={product}
                      isExpanded={expanded === product.revenueType}
                      onToggle={() =>
                        setExpanded(
                          expanded === product.revenueType ? null : product.revenueType,
                        )
                      }
                      startDate={dateRange.start}
                      endDate={dateRange.end}
                    />
                  ))
                )}
              </tbody>
              {products.length > 0 && !isLoading ? (
                <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                  <tr>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
                      {formatUsd(totals?.revenue ?? 0)}
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
                      {formatCount(totals?.feeCount ?? 0)}
                    </td>
                    {/* Users are deliberately not totalled: one person can pay a
                        swap fee and an FX fee, so a column sum would double-count
                        them and read as more payers than there are. */}
                    <td className="px-6 py-3 text-right text-sm text-gray-400">—</td>
                    <td className="px-6 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
                      {totalsChange.text ?? "—"}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductRow({
  product,
  isExpanded,
  onToggle,
  startDate,
  endDate,
}: {
  product: FeeRevenueProductRow;
  isExpanded: boolean;
  onToggle: () => void;
  startDate: Date;
  endDate: Date;
}) {
  const change = formatChange(product.changePercent);

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-gray-50"
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
            {/* The swatch carries the series identity; the name carries the
                meaning, so the row never depends on colour alone. */}
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: FEE_REVENUE_COLORS[product.revenueType] }}
            />
            <span className="text-sm font-medium text-gray-900">{product.name}</span>
          </div>
        </td>
        <td className="px-6 py-4 text-right text-sm font-medium tabular-nums text-gray-900">
          {formatUsd(product.revenue)}
        </td>
        <td className="px-6 py-4 text-right text-sm tabular-nums text-gray-600">
          {formatCount(product.feeCount)}
        </td>
        <td className="px-6 py-4 text-right text-sm tabular-nums text-gray-600">
          {formatCount(product.userCount)}
        </td>
        <td
          className={cn(
            "px-6 py-4 text-right text-sm tabular-nums",
            change.trend === "up" && "text-emerald-600",
            change.trend === "down" && "text-red-600",
            !change.trend && "text-gray-400",
          )}
        >
          {change.text ?? "—"}
        </td>
      </tr>
      {isExpanded ? (
        <tr>
          <td colSpan={5} className="bg-gray-50 px-6 py-4">
            <ProductFeeDetail
              revenueType={product.revenueType}
              startDate={startDate}
              endDate={endDate}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** The individual charges behind one product, paged. */
function ProductFeeDetail({
  revenueType,
  startDate,
  endDate,
}: {
  revenueType: FeeRevenueType;
  startDate: Date;
  endDate: Date;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useFeeRevenueDetail(
    revenueType,
    startDate,
    endDate,
    page,
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading charges…
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-sm text-red-700">
        Could not load the charges for this product.
      </p>
    );
  }

  const fees = data?.fees ?? [];

  if (fees.length === 0) {
    return (
      <p className="py-4 text-sm text-gray-500">
        No fees charged on this product in the selected period.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-white">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Charged
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Rail
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Tier
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Rate
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Base
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Fee
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fees.map((fee) => (
              <tr key={fee.eventId}>
                <td className="whitespace-nowrap px-4 py-2 text-gray-600">
                  {fee.chargedAt
                    ? new Date(fee.chargedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {fee.rail ? (RAIL_LABELS[fee.rail] ?? fee.rail) : "—"}
                  {fee.settlement === "Collected" ? (
                    <span className="ml-1 text-xs text-gray-400">(collected)</span>
                  ) : null}
                </td>
                <td className="px-4 py-2 capitalize text-gray-600">
                  {fee.tierName ?? "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                  {fee.percentage !== undefined
                    ? `${Number((fee.percentage * 100).toFixed(2))}%`
                    : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                  {fee.baseAmountUsd ? formatUsd(Number(fee.baseAmountUsd)) : "—"}
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums text-gray-900">
                  {formatUsd(Number(fee.feeAmountUsd))}
                </td>
                <td className="max-w-[220px] truncate px-4 py-2 text-gray-500">
                  {/* The on-chain hash where there is one, else the provider's
                      own id — either way, the thing to search for in support. */}
                  <span title={fee.transactionHash ?? fee.sourceId ?? undefined}>
                    {fee.transactionHash ?? fee.sourceId ?? "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {data.meta.page} of {data.meta.totalPages} · {formatCount(data.meta.total)}{" "}
            charges
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={data.meta.page <= 1}
              className="cursor-pointer rounded border border-gray-300 px-3 py-1 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setPage((current) => Math.min(current + 1, data.meta.totalPages))
              }
              disabled={data.meta.page >= data.meta.totalPages}
              className="cursor-pointer rounded border border-gray-300 px-3 py-1 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
