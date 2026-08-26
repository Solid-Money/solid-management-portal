"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  CardTransactionsResponse,
  CardTransactionFilters,
  CardTransaction,
  CARD_TRANSACTION_STATUSES,
  CARD_FEE_STATUS_LABELS,
} from "@/types";
import {
  cardFeeStatusVariant,
  cardStatusVariant,
  cashbackStatusVariant,
  chargedFeeTotal,
  describeCardFee,
  formatCashbackAmount,
} from "@/lib/card-transactions";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Search,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

interface CardTransactionsTableProps {
  /**
   * Scope to one user. Set on the user page, where the endpoint resolves every
   * issuer customer id the user has ever had — so a Bridge→Rain migration
   * still shows one continuous spend history.
   */
  userId?: string;
  /** Drop the username column and shrink the page, for the user page. */
  compact?: boolean;
}

export default function CardTransactionsTable({
  userId,
  compact = false,
}: CardTransactionsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardTransactionFilters>({
    status: "",
    search: "",
    sort: "createdAt",
    order: "desc",
    page: 1,
    limit: compact ? 10 : 20,
  });

  const debouncedSearch = useDebounce(filters.search, 400);

  const { data, isLoading, error } = useQuery({
    queryKey: ["card-transactions", userId ?? "all", { ...filters, search: debouncedSearch }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", filters.page.toString());
      params.set("limit", filters.limit.toString());
      params.set("sort", filters.sort);
      params.set("order", filters.order);
      if (filters.status) params.set("status", filters.status);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const path = userId
        ? `/admin/v1/users/${userId}/card-transactions`
        : "/admin/v1/card-transactions";

      const response = await api.get<CardTransactionsResponse>(
        `${path}?${params.toString()}`
      );
      return response.data;
    },
    placeholderData: keepPreviousData,
  });

  const handleSort = (field: string) => {
    setFilters((prev) => ({
      ...prev,
      sort: field,
      order: prev.sort === field && prev.order === "desc" ? "asc" : "desc",
      page: 1,
    }));
  };

  const handleFilterChange = (
    key: keyof CardTransactionFilters,
    value: string
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const truncateAddress = (address: string): string => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatAmount = (amount?: string, currency?: string) => {
    if (!amount) return "-";
    const num = parseFloat(amount);
    return `${num < 0 ? "-" : ""}$${Math.abs(num).toFixed(2)} ${
      currency || ""
    }`;
  };

  const renderSortIcon = (field: string) => {
    if (filters.sort !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-gray-400" />;
    }
    return filters.order === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1 text-indigo-600" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1 text-indigo-600" />
    );
  };

  /**
   * Fees charged through Rain for this spend. Charged rows show what the user
   * paid; waived and failed rows are shown too, greyed — "no fee" and "we
   * failed to collect the fee" are very different answers to a support ticket.
   */
  const renderFees = (tx: CardTransaction) => {
    const fees = tx.fees ?? [];
    if (fees.length === 0) return <span className="text-gray-400">—</span>;

    const total = chargedFeeTotal(tx);

    return (
      <div className="space-y-1">
        {total > 0 && (
          <div className="font-medium text-gray-900">${total.toFixed(2)}</div>
        )}
        {fees.map((fee, index) => (
          <div key={`${fee.category}-${index}`} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Badge variant={cardFeeStatusVariant(fee.status)}>
                {CARD_FEE_STATUS_LABELS[fee.status] ?? fee.status}
              </Badge>
              {fee.foreignCurrency && (
                <span className="text-[10px] uppercase text-gray-500">
                  {fee.foreignCurrency}
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-500">
              {describeCardFee(fee)}
            </span>
            {fee.lastError && (
              <span className="text-[10px] text-red-600">{fee.lastError}</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderCashback = (tx: CardTransaction) => {
    const amount = formatCashbackAmount(tx.cashback);
    if (!amount) return <span className="text-gray-400">—</span>;

    return (
      <div>
        <span className="font-medium">{amount.amount}</span>
        {amount.usd && (
          <span className="ml-1 text-xs text-gray-500">{amount.usd}</span>
        )}
        {tx.cashback?.payoutTxHash && (
          <a
            href={`https://explorer.fuse.io/tx/${tx.cashback.payoutTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-indigo-600 hover:text-indigo-800"
            title="View payout on Fuse explorer"
          >
            <ExternalLink className="h-3 w-3 inline" />
          </a>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error loading card transactions. Please try again.
      </div>
    );
  }

  const columnCount = compact ? 7 : 8;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
              {CARD_TRANSACTION_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Merchant or transaction id
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                placeholder="e.g. Netflix"
                className="w-56 pl-8"
              />
            </div>
          </div>
          <div className="ml-auto text-sm text-gray-500">
            {data?.meta.total ?? 0} total transactions
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center">
                  Date
                  {renderSortIcon("createdAt")}
                </div>
              </th>
              {!compact && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Merchant
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center">
                  Amount
                  {renderSortIcon("amount")}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center">
                  Status
                  {renderSortIcon("status")}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Card Fees
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cashback
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tx ID
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
                </td>
              </tr>
            ) : data?.data.length === 0 ? (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No card transactions found
                </td>
              </tr>
            ) : (
              data?.data.map((tx: CardTransaction) => (
                <tr
                  key={tx._id || tx.transactionId}
                  className="hover:bg-gray-50 align-top"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(tx.createdAt)}
                  </td>
                  {!compact && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {tx.user ? (
                        <Link
                          href={`/users/${tx.user._id}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                        >
                          {tx.user.username}
                        </Link>
                      ) : (
                        <span className="text-gray-400 italic">Deleted User</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="font-medium">
                      {tx.merchantName || "Unknown Merchant"}
                    </div>
                    {tx.merchantLocation && (
                      <div className="text-xs text-gray-500">
                        {tx.merchantLocation}
                      </div>
                    )}
                    {tx.category && (
                      <div className="text-[10px] uppercase text-gray-400">
                        {tx.category}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatAmount(tx.settledAmount ?? tx.amount, tx.currency)}
                    {tx.settledAmount && tx.settledAmount !== tx.amount && (
                      <div className="text-[10px] text-gray-500">
                        auth {formatAmount(tx.amount, tx.currency)}
                      </div>
                    )}
                    {/* The merchant-currency side of a converted purchase —
                        the same condition that produces an FX fee. */}
                    {tx.localAmount && tx.localCurrency && (
                      <div className="text-[10px] text-gray-500">
                        merchant {Number(tx.localAmount).toFixed(2)}{" "}
                        {tx.localCurrency}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={cardStatusVariant(tx.status)}>
                      {tx.status}
                    </Badge>
                    {tx.declinedReason && (
                      <p className="mt-1 max-w-40 text-[10px] text-red-600">
                        {tx.declinedReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{renderFees(tx)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {tx.cashback ? (
                      <div className="space-y-1">
                        <Badge
                          variant={cashbackStatusVariant(tx.cashback.status)}
                        >
                          {tx.cashback.status}
                        </Badge>
                        {renderCashback(tx)}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <span className="font-mono text-xs">
                        {truncateAddress(tx.transactionId)}
                      </span>
                      <button
                        onClick={(e) => copyToClipboard(tx.transactionId, e)}
                        className="text-gray-400 hover:text-gray-600 cursor-pointer"
                        title="Copy transaction id"
                      >
                        {copiedId === tx.transactionId ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {data.meta.page} of {data.meta.totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(data.meta.page - 1)}
              disabled={data.meta.page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(data.meta.page + 1)}
              disabled={data.meta.page >= data.meta.totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
