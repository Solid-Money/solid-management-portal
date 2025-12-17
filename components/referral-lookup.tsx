"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { ReferralSearchResponse, User } from "@/types";
import {
  Search,
  Loader2,
  Copy,
  Check,
  Users,
  UserCircle,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";

export default function ReferralLookup() {
  const router = useRouter();
  const [referralCode, setReferralCode] = useState("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const debouncedCode = useDebounce(referralCode, 500);

  const { data, isLoading, isError, error } = useQuery<ReferralSearchResponse>({
    queryKey: ["referral-lookup", debouncedCode],
    queryFn: async () => {
      const res = await api.get(
        `/admin/v1/users/by-referral-code?referralCode=${encodeURIComponent(
          debouncedCode
        )}`
      );
      return res.data;
    },
    enabled: debouncedCode.length >= 3,
  });

  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(text);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const truncateAddress = (address: string): string => {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
            placeholder="Enter referral code..."
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Enter at least 3 characters to search
        </p>
      </div>

      {/* Loading State */}
      {isLoading && debouncedCode.length >= 3 && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">
            {(error as Error)?.message || "Failed to fetch referral data"}
          </span>
        </div>
      )}

      {/* No Results */}
      {data && !data.referrer && debouncedCode.length >= 3 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          <span className="text-yellow-700">
            No user found with referral code &quot;{debouncedCode}&quot;
          </span>
        </div>
      )}

      {/* Results */}
      {data?.referrer && (
        <>
          {/* Referrer Card */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="bg-indigo-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <UserCircle className="h-8 w-8 text-white" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Referrer</h2>
                  <p className="text-indigo-200 text-sm">
                    Owner of code: {data.referrer.referralCode}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">
                    Username
                  </label>
                  <p
                    className="font-medium text-indigo-600 cursor-pointer hover:underline"
                    onClick={() => router.push(`/users/${data.referrer!._id}`)}
                  >
                    {data.referrer.username}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">
                    Email
                  </label>
                  <p className="font-medium text-gray-900">
                    {data.referrer.email || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">
                    Total Balance
                  </label>
                  <p className="font-medium text-gray-900">
                    ${data.referrer.totalBalance?.toFixed(2) ?? "0.00"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">
                    Country
                  </label>
                  <p className="font-medium text-gray-900">
                    {data.referrer.country || "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Referred Users Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-gray-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Referred Users
                  </h2>
                  <p className="text-gray-500 text-sm">
                    {data.referredUsers.length} user
                    {data.referredUsers.length !== 1 ? "s" : ""} referred
                  </p>
                </div>
              </div>
            </div>

            {data.referredUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No users have used this referral code yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        "Username",
                        "Email",
                        "Wallet",
                        "Total Balance",
                        "Savings",
                        "Card",
                        "Wallet Balance",
                        "Country",
                        "Joined",
                      ].map((header) => (
                        <th
                          key={header}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.referredUsers.map((user: User) => (
                      <tr
                        key={user._id}
                        onClick={() => router.push(`/users/${user._id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-indigo-600">
                          {user.username}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {user.email || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {user.walletAddress ? (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs">
                                {truncateAddress(user.walletAddress)}
                              </span>
                              <button
                                onClick={(e) =>
                                  copyToClipboard(user.walletAddress!, e)
                                }
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                {copiedAddress === user.walletAddress ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3 text-gray-400" />
                                )}
                              </button>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold">
                          ${user.totalBalance?.toFixed(2) ?? "0.00"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          ${user.savingsBalance?.toFixed(2) ?? "0.00"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          ${user.cardBalance?.toFixed(2) ?? "0.00"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          ${user.walletBalance?.toFixed(2) ?? "0.00"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {user.country || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary Stats */}
            {data.referredUsers.length > 0 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">
                      {data.referredUsers.length}
                    </p>
                    <p className="text-xs text-gray-500 uppercase">
                      Total Referred
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      $
                      {data.referredUsers
                        .reduce((sum, u) => sum + (u.totalBalance || 0), 0)
                        .toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 uppercase">
                      Combined Balance
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      $
                      {data.referredUsers
                        .reduce((sum, u) => sum + (u.savingsBalance || 0), 0)
                        .toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 uppercase">
                      Combined Savings
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">
                      $
                      {(
                        data.referredUsers.reduce(
                          (sum, u) => sum + (u.totalBalance || 0),
                          0
                        ) / data.referredUsers.length
                      ).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 uppercase">
                      Avg Balance
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Toast */}
      {copiedAddress && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Check className="h-4 w-4 text-green-400" />
          <span className="text-sm">Address copied</span>
        </div>
      )}
    </div>
  );
}
