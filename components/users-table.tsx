"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { User, UsersResponse, UserFilters } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Search,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";

export default function UsersTable() {
  const router = useRouter();
  const [filters, setFilters] = useState<UserFilters>({
    search: "",
    sort: "createdAt",
    order: "desc",
    page: 1,
    limit: 10,
  });

  const debouncedSearch = useDebounce(filters.search, 500);

  const { data, isLoading, isError } = useQuery<UsersResponse>({
    queryKey: ["users", { ...filters, search: debouncedSearch }],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        sort: filters.sort,
        order: filters.order,
        page: filters.page.toString(),
        limit: filters.limit.toString(),
      });
      const res = await api.get(`/admin/v1/users?${params}`);
      return res.data;
    },
  });

  const handleSort = (field: string) => {
    setFilters((prev) => ({
      ...prev,
      sort: field,
      order: prev.sort === field && prev.order === "desc" ? "asc" : "desc",
    }));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const getSortField = (header: string): string => {
    const fieldMap: Record<string, string> = {
      username: 'username',
      email: 'email',
      walletaddress: 'walletAddress',
      totalbalance: 'totalBalance',
      savingsbalance: 'savingsBalance',
      cardbalance: 'cardBalance',
      walletbalance: 'walletBalance',
      referredby: 'referredBy',
      createdat: 'createdAt',
    };
    const normalized = header.toLowerCase().replace(/\s+/g, '');
    return fieldMap[normalized] || normalized;
  };

  if (isError) {
    return <div className="text-red-500">Error loading users</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative max-w-sm w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Search users..."
            value={filters.search}
            onChange={handleSearch}
          />
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Username",
                  "Email",
                  "Wallet Address",
                  "Total Balance",
                  "Savings Balance",
                  "Card Balance",
                  "Wallet Balance",
                  "Referred By",
                  "Created At",
                ].map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() =>
                      handleSort(getSortField(header))
                    }
                  >
                    <div className="flex items-center space-x-1">
                      <span>{header}</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-4 text-center">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-indigo-600" />
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-4 text-center text-gray-500"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                data?.data.map((user) => (
                  <tr
                    key={user._id}
                    onClick={() => router.push(`/users/${user._id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.username}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                      {user.walletAddress || "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-semibold">
                      {user.totalBalance !== undefined
                        ? `$${user.totalBalance.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.savingsBalance !== undefined
                        ? `$${user.savingsBalance.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.cardBalance !== undefined
                        ? `$${user.cardBalance.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.walletBalance !== undefined
                        ? `$${user.walletBalance.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.referredBy ? (
                        <div className="flex flex-col">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (user.referredBy) {
                                router.push(`/users/${user.referredBy.id}`);
                              }
                            }}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-medium"
                          >
                            {user.referredBy.username}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(user.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
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
    </div>
  );
}
