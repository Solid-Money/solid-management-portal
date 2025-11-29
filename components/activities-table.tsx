"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  AdminActivitiesResponse,
  ActivityFilters,
  ACTIVITY_TYPES,
  DEPOSIT_TYPES,
  ACTIVITY_STATUSES,
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
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ActivitiesTable() {
  const router = useRouter();
  const [filters, setFilters] = useState<ActivityFilters>({
    type: "",
    depositType: "",
    status: "",
    sort: "createdAt",
    order: "desc",
    page: 1,
    limit: 20,
  });
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  useEffect(() => {
    if (copiedAddress) {
      const timer = setTimeout(() => setCopiedAddress(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedAddress]);

  const { data, isLoading, isError } = useQuery<AdminActivitiesResponse>({
    queryKey: ["activities", filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: filters.limit.toString(),
        sort: filters.sort,
        order: filters.order,
      });
      if (filters.type) params.append("type", filters.type);
      if (filters.depositType) params.append("depositType", filters.depositType);
      if (filters.status) params.append("status", filters.status);

      const res = await api.get(`/admin/v1/activities?${params}`);
      return res.data;
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

  const handleFilterChange = (key: keyof ActivityFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
      // Reset depositType if type is changed to one that doesn't support it
      ...(key === "type" &&
      value !== "deposit" &&
      value !== "bridge" &&
      value !== "bridge_deposit"
        ? { depositType: "" }
        : {}),
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const getSortField = (header: string): string => {
    const fieldMap: Record<string, string> = {
      type: "type",
      amount: "amount",
      symbol: "symbol",
      status: "status",
      chain: "chainId",
      createdat: "createdAt",
    };
    const normalized = header.toLowerCase().replace(/\s+/g, "");
    return fieldMap[normalized] || normalized;
  };

  const truncateAddress = (address: string): string => {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeLabel = (type: string) => {
    const typeObj = ACTIVITY_TYPES.find((t) => t.value === type);
    return typeObj?.label || type;
  };

  const getChainName = (chainId?: number) => {
    if (!chainId) return "-";
    const chains: Record<number, string> = {
      1: "Ethereum",
      10: "Optimism",
      137: "Polygon",
      42161: "Arbitrum",
      8453: "Base",
    };
    return chains[chainId] || `Chain ${chainId}`;
  };

  if (isError) {
    return <div className="text-red-500">Error loading activities</div>;
  }

  const sortableHeaders = ["Type", "Amount", "Symbol", "Status", "Chain", "Created At"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          className="block px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          value={filters.type}
          onChange={(e) => handleFilterChange("type", e.target.value)}
        >
          {ACTIVITY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        {(filters.type === "deposit" ||
          filters.type === "bridge" ||
          filters.type === "bridge_deposit") && (
          <select
            className="block px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            value={filters.depositType}
            onChange={(e) => handleFilterChange("depositType", e.target.value)}
          >
            {DEPOSIT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        )}

        <select
          className="block px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          value={filters.status}
          onChange={(e) => handleFilterChange("status", e.target.value)}
        >
          {ACTIVITY_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Type",
                  "Amount",
                  "Symbol",
                  "Status",
                  "User",
                  "Chain",
                  "Hash",
                  "From",
                  "To",
                  "Deposit Type",
                  "Created At",
                ].map((header) => {
                  const sortField = getSortField(header);
                  const isSortable = sortableHeaders.includes(header);
                  const isActive = filters.sort === sortField;
                  return (
                    <th
                      key={header}
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        isSortable
                          ? "cursor-pointer hover:bg-gray-100 transition-colors"
                          : ""
                      } ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-gray-500"
                      }`}
                      onClick={() => isSortable && handleSort(sortField)}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{header}</span>
                        {isSortable &&
                          (isActive ? (
                            filters.order === "asc" ? (
                              <ArrowUp className="h-4 w-4" />
                            ) : (
                              <ArrowDown className="h-4 w-4" />
                            )
                          ) : (
                            <ArrowUpDown className="h-4 w-4 opacity-40" />
                          ))}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-4 text-center">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-indigo-600" />
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-4 text-center text-gray-500"
                  >
                    No activities found
                  </td>
                </tr>
              ) : (
                data?.data.map((activity) => (
                  <tr
                    key={activity._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getTypeLabel(activity.type)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {activity.amount}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {activity.symbol}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          activity.status
                        )}`}
                      >
                        {activity.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {activity.user ? (
                        <span
                          onClick={() =>
                            router.push(`/users/${activity.user?._id}`)
                          }
                          className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-medium"
                        >
                          {activity.user.username}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {getChainName(activity.chainId)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {activity.hash ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">
                            {truncateAddress(activity.hash)}
                          </span>
                          <button
                            onClick={(e) => copyToClipboard(activity.hash!, e)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Copy hash"
                          >
                            {copiedAddress === activity.hash ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                            )}
                          </button>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {activity.fromAddress ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">
                            {truncateAddress(activity.fromAddress)}
                          </span>
                          <button
                            onClick={(e) =>
                              copyToClipboard(activity.fromAddress!, e)
                            }
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Copy address"
                          >
                            {copiedAddress === activity.fromAddress ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                            )}
                          </button>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {activity.toAddress ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">
                            {truncateAddress(activity.toAddress)}
                          </span>
                          <button
                            onClick={(e) =>
                              copyToClipboard(activity.toAddress!, e)
                            }
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Copy address"
                          >
                            {copiedAddress === activity.toAddress ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                            )}
                          </button>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {(activity.type === "deposit" ||
                        activity.type === "bridge" ||
                        activity.type === "bridge_deposit") &&
                      activity.depositType ? (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            activity.depositType === "DIRECT"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {activity.depositType}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(activity.createdAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{" "}
                  <span className="font-medium">
                    {(data.meta.page - 1) * data.meta.limit + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(
                      data.meta.page * data.meta.limit,
                      data.meta.total
                    )}
                  </span>{" "}
                  of <span className="font-medium">{data.meta.total}</span>{" "}
                  results
                </p>
              </div>
              <div>
                <nav
                  className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                  aria-label="Pagination"
                >
                  <button
                    onClick={() => handlePageChange(filters.page - 1)}
                    disabled={filters.page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => handlePageChange(filters.page + 1)}
                    disabled={filters.page >= data.meta.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast notification */}
      {copiedAddress && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Check className="h-4 w-4 text-green-400" />
          <span className="text-sm">Copied to clipboard</span>
        </div>
      )}
    </div>
  );
}

