"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  CardTransactionsResponse,
  CardTransactionFilters,
  CardTransaction,
  CARD_TRANSACTION_STATUSES,
} from "@/types";
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
} from "lucide-react";

export default function CardTransactionsTable() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardTransactionFilters>({
    status: "",
    sort: "createdAt",
    order: "desc",
    page: 1,
    limit: 20,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["card-transactions", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", filters.page.toString());
      params.set("limit", filters.limit.toString());
      params.set("sort", filters.sort);
      params.set("order", filters.order);
      if (filters.status) params.set("status", filters.status);

      const response = await api.get<CardTransactionsResponse>(
        `/admin/v1/card-transactions?${params.toString()}`
      );
      return response.data;
    },
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
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "posted":
        return "bg-green-100 text-green-800";
      case "authorized":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "declined":
      case "denied":
        return "bg-red-100 text-red-800";
      case "reversed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getCashbackStatusColor = (status?: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800";
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      case "Failed":
        return "bg-red-100 text-red-800";
      case "PermanentlyFailed":
        return "bg-red-200 text-red-900";
      default:
        return "bg-gray-100 text-gray-500";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error loading card transactions. Please try again.
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
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
          <div className="ml-auto text-sm text-gray-500">
            {data?.meta.total ?? 0} total transactions
          </div>
        </div>
      </div>

      {/* Table */}
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
                Cashback Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cashback Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tx ID
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
                </td>
              </tr>
            ) : data?.data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No card transactions found
                </td>
              </tr>
            ) : (
              data?.data.map((tx: CardTransaction) => (
                <tr
                  key={tx._id || tx.transactionId}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(tx.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="font-medium">
                      {tx.merchantName || "Unknown Merchant"}
                    </div>
                    {tx.merchantLocation && (
                      <div className="text-xs text-gray-500">
                        {tx.merchantLocation}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatAmount(tx.amount, tx.currency)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        tx.status
                      )}`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {tx.cashback ? (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCashbackStatusColor(
                          tx.cashback.status
                        )}`}
                      >
                        {tx.cashback.status}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {tx.cashback?.fuseAmount ? (
                      <div>
                        <span className="font-medium">
                          {parseFloat(tx.cashback.fuseAmount).toFixed(4)} FUSE
                        </span>
                        {tx.cashback.payoutTxHash && (
                          <a
                            href={`https://explorer.fuse.io/tx/${tx.cashback.payoutTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-indigo-600 hover:text-indigo-800"
                          >
                            <ExternalLink className="h-3 w-3 inline" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <span className="font-mono text-xs">
                        {truncateAddress(tx.transactionId)}
                      </span>
                      <button
                        onClick={(e) => copyToClipboard(tx.transactionId, e)}
                        className="text-gray-400 hover:text-gray-600"
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

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {data.meta.page} of {data.meta.totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(data.meta.page - 1)}
              disabled={data.meta.page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(data.meta.page + 1)}
              disabled={data.meta.page >= data.meta.totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
