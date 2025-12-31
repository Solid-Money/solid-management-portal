"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { User, Balance, Activity } from "@/types";
import BalancesCard from "@/components/balances-card";
import ActivityList from "@/components/activity-list";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["user", id],
    queryFn: async () => {
      const res = await api.get(`/admin/v1/users/${id}`);
      return res.data;
    },
  });

  const { data: balances, isLoading: balancesLoading } = useQuery<{
    data: Balance[];
  }>({
    queryKey: ["user-balances", id],
    queryFn: async () => {
      const res = await api.get(`/admin/v1/users/${id}/balances`);
      return res.data;
    },
  });

  const { data: activity, isLoading: activityLoading } = useQuery<{
    docs: Activity[];
  }>({
    queryKey: ["user-activity", id],
    queryFn: async () => {
      const res = await api.get(`/admin/v1/users/${id}/activity`, {
        params: { limit: 100 },
      });
      return res.data;
    },
  });

  if (userLoading || balancesLoading || activityLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center space-x-4 mb-6">
        <Link href="/users" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {user.username || user.email}
        </h1>
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            user.status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {user.status || "Unknown"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-5 space-y-6 overflow-y-auto pr-2">
          <div className="bg-white shadow-sm border border-gray-100 overflow-hidden sm:rounded-xl">
            <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-base leading-6 font-semibold text-gray-900">
                User Details
              </h3>
            </div>
            <div className="px-4 py-4">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-gray-500 uppercase">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900 truncate">
                    {user.email}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Wallet Address
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono truncate">
                    {user.walletAddress || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Joined</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Country</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {user.country || "-"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Safe Address
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono truncate">
                    {user.safeAddress || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Referral Code
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {user.referralCode || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Code Used
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {user.referralCodeUsed || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Referred By
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 truncate">
                    {user.referredBy ? (
                      <Link
                        href={`/users/${user.referredBy.id}`}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {user.referredBy.username}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <BalancesCard balances={balances?.data || []} />
        </div>

        <div className="lg:col-span-7 h-full min-h-0">
          <ActivityList activities={activity?.docs || []} />
        </div>
      </div>
    </div>
  );
}
