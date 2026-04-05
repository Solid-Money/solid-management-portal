"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { DepositSummary, DepositTitleGroup } from "@/types";
import {
  ArrowDownToLine,
  CreditCard,
  Loader2,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(dateStr));
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

const EXPLORER_URLS: Record<number, string> = {
  1: "https://etherscan.io",
  122: "https://explorer.fuse.io",
  8453: "https://basescan.org",
  42161: "https://arbiscan.io",
  137: "https://polygonscan.com",
};

function getExplorerTxUrl(hash: string, chainId: number | null): string {
  const base = EXPLORER_URLS[chainId ?? 122] ?? EXPLORER_URLS[122];
  return `${base}/tx/${hash}`;
}

const statusColors: Record<string, string> = {
  success: "bg-green-100 text-green-700",
  processing: "bg-yellow-100 text-yellow-700",
  pending: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
  cancelled: "bg-gray-100 text-gray-500",
  refunded: "bg-purple-100 text-purple-700",
};

function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}
    >
      {status}
    </span>
  );
}

function TitleRow({ item }: { item: DepositTitleGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer rounded px-1"
      >
        <div className="flex items-center gap-2 truncate mr-2">
          <ChevronDown
            className={`h-3 w-3 text-gray-400 transition-transform shrink-0 ${
              expanded ? "rotate-0" : "-rotate-90"
            }`}
          />
          <span className="text-gray-600 truncate">{item.title}</span>
          <StatusBadge status={item.status} />
        </div>
        <span className="text-gray-900 font-medium whitespace-nowrap">
          ${formatAmount(item.total)}{" "}
          <span className="text-gray-400">({item.count})</span>
        </span>
      </button>

      {expanded && item.transactions.length > 0 && (
        <div className="ml-6 mr-1 mb-2 mt-1 border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-medium">
                <td className="px-2 py-1.5">Date</td>
                <td className="px-2 py-1.5 text-right">Amount</td>
                <td className="px-2 py-1.5 text-right">Tx Hash</td>
              </tr>
            </thead>
            <tbody>
              {item.transactions.map((tx, i) => (
                <tr
                  key={tx.clientTxId || i}
                  className="border-t border-gray-50 hover:bg-gray-50/50"
                >
                  <td className="px-2 py-1.5 text-gray-500">
                    {formatDate(tx.createdAt)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-gray-900 font-medium">
                    {parseFloat(tx.amount || "0").toFixed(2)} {tx.symbol}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {tx.hash ? (
                      <a
                        href={getExplorerTxUrl(tx.hash, tx.chainId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-mono"
                      >
                        {truncateHash(tx.hash)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CategorySection({
  icon,
  label,
  total,
  count,
  byTitle,
}: {
  icon: React.ReactNode;
  label: string;
  total: number;
  count: number;
  byTitle: DepositTitleGroup[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-gray-900">{label}</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">
            ${formatAmount(total)}
          </p>
          <p className="text-[10px] text-gray-500">
            {count} {count === 1 ? "deposit" : "deposits"}
          </p>
        </div>
      </div>
      {byTitle.length > 0 && (
        <div className="ml-8 space-y-0.5">
          {byTitle.map((item) => (
            <TitleRow key={`${item.title}-${item.status}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DepositSummaryCard({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery<{ data: DepositSummary }>({
    queryKey: ["user-deposit-summary", userId],
    queryFn: async () => {
      const res = await api.get(`/admin/v1/users/${userId}/deposit-summary`);
      return res.data;
    },
  });

  const summary = data?.data;

  return (
    <div className="bg-white shadow-sm border border-gray-100 overflow-hidden sm:rounded-xl">
      <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-base leading-6 font-semibold text-gray-900">
          Deposit Summary
        </h3>
      </div>
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin h-5 w-5 text-indigo-600" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">Failed to load deposit summary</p>
        ) : summary ? (
          <div className="space-y-4">
            <CategorySection
              icon={
                <div className="p-1.5 rounded-full bg-emerald-50">
                  <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                </div>
              }
              label="Solid Deposits"
              total={summary.solidDeposits.total}
              count={summary.solidDeposits.count}
              byTitle={summary.solidDeposits.byTitle}
            />
            <div className="border-t border-gray-100" />
            <CategorySection
              icon={
                <div className="p-1.5 rounded-full bg-blue-50">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                </div>
              }
              label="Bridge Card Deposits"
              total={summary.bridgeCardDeposits.total}
              count={summary.bridgeCardDeposits.count}
              byTitle={summary.bridgeCardDeposits.byTitle}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No deposit data available</p>
        )}
      </div>
    </div>
  );
}
