"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink } from "lucide-react";
import {
  formatAge,
  formatAmount,
  formatDateTime,
  formatWalletUsd,
  getFundingLedger,
  truncateAddress,
} from "@/lib/wallets";
import { FundingLedgerBucket } from "@/types";

const WINDOWS = [7, 30, 90];

/**
 * What funding the operation actually costs, across every wallet.
 *
 * Per-wallet burn answers "what does this wallet cost"; nothing answered "what
 * did we spend last week", which is the question behind funding ten wallets a
 * day without a number to point at. Assembled from the transfers themselves,
 * because a top-up is agreed in chat and leaves no other record.
 */
export default function FundingLedger() {
  const [windowDays, setWindowDays] = useState(30);
  const [grouping, setGrouping] = useState<"day" | "week">("day");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["funding-ledger", windowDays],
    queryFn: () => getFundingLedger(windowDays),
    staleTime: 5 * 60 * 1000,
  });

  const buckets = useMemo(
    () => (grouping === "day" ? data?.byDay : data?.byWeek) ?? [],
    [data, grouping]
  );

  if (isLoading) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        Reading every wallet&apos;s transfer history — this takes a moment.
      </p>
    );
  }

  if (isError) {
    return (
      <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        Could not build the ledger:{" "}
        {error instanceof Error ? error.message : "unknown error"}
      </p>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md bg-gray-100 p-1">
          {WINDOWS.map((option) => (
            <button
              key={option}
              onClick={() => setWindowDays(option)}
              className={`rounded px-3 py-1 text-sm ${
                windowDays === option
                  ? "bg-white font-medium text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {option} days
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-md bg-gray-100 p-1">
          {(["day", "week"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setGrouping(option)}
              className={`rounded px-3 py-1 text-sm capitalize ${
                grouping === option
                  ? "bg-white font-medium text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              per {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={`Funded in ${data.windowDays} days`}
          value={formatWalletUsd(data.totals.usd)}
          note={
            data.totals.unpricedCount > 0
              ? `at least — ${data.totals.unpricedCount} top-up${
                  data.totals.unpricedCount === 1 ? "" : "s"
                } could not be priced`
              : "every row priced"
          }
        />
        <Stat
          label="Top-ups"
          value={String(data.totals.count)}
          note={`across ${data.totals.walletsFunded} wallets`}
        />
        <Stat
          label="Per day"
          value={formatWalletUsd(data.totals.usd / data.windowDays)}
          note="average over the window"
        />
        <Stat
          label="Per week"
          value={formatWalletUsd((data.totals.usd / data.windowDays) * 7)}
          note="at the same average"
        />
      </div>

      {data.gaps.length > 0 && (
        <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Some wallets could not be read, so these totals are a floor
          </div>
          <ul className="mt-1 space-y-0.5">
            {data.gaps.map((gap, index) => (
              <li key={`${gap.walletName}:${gap.chainId ?? "all"}:${index}`}>
                {gap.walletName}
                {gap.chainId ? ` (chain ${gap.chainId})` : ""}: {gap.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title={`Funded per ${grouping}`}>
        {buckets.length === 0 ? (
          <Empty>No top-ups recorded in this window.</Empty>
        ) : (
          <BucketBars buckets={buckets} />
        )}
      </Section>

      <Section title="By wallet">
        {data.byWallet.length === 0 ? (
          <Empty>No top-ups recorded in this window.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Wallet</th>
                <th className="px-4 py-2">Top-ups</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.byWallet.map((row) => (
                <tr key={row.walletName}>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {row.walletName}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {row.count}
                    {row.unpricedCount > 0 && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({row.unpricedCount} unpriced)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {formatWalletUsd(row.usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Every top-up (${data.entries.length})`}>
        {data.entries.length === 0 ? (
          <Empty>No top-ups recorded in this window.</Empty>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Who sent it</th>
                  <th className="px-4 py-2">Wallet</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2 text-right">USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.entries.map((entry) => (
                  <tr key={entry.hash} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                      <div>{formatAge(entry.timestamp)}</div>
                      <div className="text-xs text-gray-400">
                        {formatDateTime(entry.timestamp)}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {entry.fromWalletName ? (
                        <span className="font-medium text-gray-900">
                          {entry.fromWalletName}
                        </span>
                      ) : (
                        <code className="font-mono text-xs text-gray-700">
                          {truncateAddress(entry.from)}
                        </code>
                      )}
                      <div className="text-xs text-gray-400">
                        {entry.chainName}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {entry.walletName}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {formatAmount(entry.amount)} {entry.symbol}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <a
                        href={entry.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-gray-900 hover:text-indigo-600"
                      >
                        {formatWalletUsd(entry.amountUsd)}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

/**
 * Bars rather than a chart library: the shape of the series is the whole
 * message — which days cost the most — and a bar per bucket carries it
 * without a dependency.
 */
function BucketBars({ buckets }: { buckets: FundingLedgerBucket[] }) {
  const peak = Math.max(...buckets.map((bucket) => bucket.usd), 1);

  return (
    <div className="space-y-1 px-4 py-3">
      {buckets.map((bucket) => (
        <div key={bucket.date} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-xs text-gray-500">
            {bucket.date}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
            <div
              className="h-full rounded bg-indigo-400"
              style={{ width: `${Math.max((bucket.usd / peak) * 100, 1)}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-gray-900">
            {formatWalletUsd(bucket.usd)}
          </span>
          <span className="w-20 shrink-0 text-right text-xs text-gray-400">
            {bucket.count} top-up{bucket.count === 1 ? "" : "s"}
          </span>
        </div>
      ))}
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
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <h2 className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-gray-900">{value}</div>
      {note && <div className="text-xs text-gray-400">{note}</div>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-gray-500">{children}</p>;
}
