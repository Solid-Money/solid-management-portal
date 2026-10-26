"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Search } from "lucide-react";

import AiApiSettingsEditor from "@/components/ai-api/settings-editor";
import AiApiUsageChart from "@/components/ai-api/usage-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserLink from "@/components/user-link";
import { useAiApiOverview, useAiApiUsers } from "@/hooks/use-ai-api";
import { formatTokens, PAUSE_REASON_LABELS } from "@/lib/ai-api";
import { formatUsd } from "@/lib/utils";

type RangeKey = "month" | "7d" | "30d";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

/** A range as the API takes it: from midnight UTC, to now. */
function rangeParams(key: RangeKey): { from?: string; to?: string } {
  if (key === "month") return {};
  const days = key === "7d" ? 7 : 30;
  const now = new Date();
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)),
  );
  return { from: from.toISOString() };
}

function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warning";
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "warning" ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

function UsersTable() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useAiApiUsers({ search, page });

  // Search as the admin stops typing, not on every key.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Username, email, Safe address or user id"
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2 text-right">Keys</th>
              <th className="px-4 py-2 text-right">Billed this month</th>
              <th className="px-4 py-2 text-right">Requests</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {search ? "No users with keys match." : "No one has a key yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.userId}
                  onClick={() => router.push(`/ai-api/${row.userId}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-2">
                    <UserLink userId={row.userId} username={row.username} />
                  </td>
                  <td className="px-4 py-2 text-gray-600">{row.email ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{row.keys}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatUsd(row.spentThisMonthUsd)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {row.requestsThisMonth.toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {row.paused ? (
                      <Badge variant="warning">
                        {row.pausedReason
                          ? PAUSE_REASON_LABELS[row.pausedReason]
                          : "Paused"}
                      </Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {meta.total.toLocaleString()} users · page {meta.page} of {meta.totalPages}
            {isFetching ? " · loading…" : ""}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="cursor-pointer"
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Config → AI API: what users spend through their AI API keys, what that has
 * been charged and paid back, who holds keys, and the models and prices
 * behind it all.
 */
export default function AiApiPage() {
  const [range, setRange] = useState<RangeKey>("month");
  const params = useMemo(() => rangeParams(range), [range]);
  const { data, isLoading, isFetching } = useAiApiOverview(params);
  const overview = data?.data;

  // Upstream cost against what users are billed: the gap is usage beyond
  // a key's limit, which the gateway served but nobody can be charged for.
  const unbilledUsd = overview
    ? Math.max(0, overview.usage.costUsd - overview.usage.billedUsd)
    : 0;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI API</h1>
            <p className="text-sm text-gray-500">
              API keys for AI agents, paid from the Wallet on Base every few
              dollars of usage, with cashback into USD Yield. Days are UTC.
            </p>
          </div>
        </div>
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {RANGES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              className={`cursor-pointer rounded px-3 py-1.5 text-sm font-medium ${
                range === option.key
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !overview ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          <div
            className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${
              isFetching ? "opacity-60" : ""
            }`}
          >
            <Stat
              label="Billed to users"
              value={formatUsd(overview.usage.billedUsd)}
              hint={`${overview.usage.requests.toLocaleString()} requests · ${formatTokens(
                overview.usage.tokens,
              )} tokens`}
            />
            <Stat
              label="Charged from Wallets"
              value={formatUsd(overview.charges.chargedUsd)}
              hint={`${overview.charges.count.toLocaleString()} charges · ${formatUsd(
                overview.charges.openUsd,
              )} waiting in ${overview.charges.openCount.toLocaleString()}`}
            />
            <Stat
              label="Cashback"
              value={formatUsd(overview.cashback.bookedUsd)}
              hint={`${formatUsd(overview.cashback.paidUsd)} paid · ${formatUsd(
                overview.cashback.pendingUsd,
              )} pending`}
            />
            <Stat
              label="Keys"
              value={overview.keys.active.toLocaleString()}
              hint={`${overview.keys.users.toLocaleString()} users hold keys · ${overview.usage.activeUsers.toLocaleString()} used them in range`}
            />
          </div>

          {overview.pausedAccounts > 0 ||
          overview.charges.failingCount > 0 ||
          unbilledUsd > 0.005 ||
          overview.usage.estimatedRequests > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Paused accounts"
                value={overview.pausedAccounts.toLocaleString()}
                hint="Every key stopped: Wallet empty, no mandate, or an admin"
                tone={overview.pausedAccounts > 0 ? "warning" : undefined}
              />
              <Stat
                label="Charges failing"
                value={overview.charges.failingCount.toLocaleString()}
                hint="Refused at least once and waiting on a retry"
                tone={overview.charges.failingCount > 0 ? "warning" : undefined}
              />
              <Stat
                label="Served past a limit"
                value={formatUsd(unbilledUsd)}
                hint="Upstream cost above what keys' limits let us bill"
                tone={unbilledUsd > 0.005 ? "warning" : undefined}
              />
              <Stat
                label="Estimated requests"
                value={overview.usage.estimatedRequests.toLocaleString()}
                hint="Metered from size because the stream ended early"
              />
            </div>
          ) : null}

          <Section title="Billed per day">
            <AiApiUsageChart data={overview.byDay} />
          </Section>

          <Section title="By model" description="What each model was used for, at our prices.">
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Model</th>
                    <th className="px-4 py-2 text-right">Requests</th>
                    <th className="px-4 py-2 text-right">Tokens</th>
                    <th className="px-4 py-2 text-right">Cost</th>
                    <th className="px-4 py-2 text-right">Billed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overview.byModel.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        No usage in this range.
                      </td>
                    </tr>
                  ) : (
                    overview.byModel.map((row) => (
                      <tr key={row.model}>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">{row.name}</div>
                          {row.name !== row.model ? (
                            <div className="font-mono text-xs text-gray-500">{row.model}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right">{row.requests.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{formatTokens(row.tokens)}</td>
                        <td className="px-4 py-2 text-right">{formatUsd(row.costUsd)}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatUsd(row.billedUsd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}

      <Section
        title="Users with keys"
        description="Ordered by what they have been billed this month. Open one to see their keys and charges."
      >
        <UsersTable />
      </Section>

      <Section title="Settings">
        <AiApiSettingsEditor />
      </Section>
    </div>
  );
}
