'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { User, Balance, Activity } from '@/types';
import BalancesCard from '@/components/balances-card';
import ActivityList from '@/components/activity-list';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['user', id],
    queryFn: async () => {
      const res = await api.get(`/accounts/v1/admin/users/${id}`);
      return res.data;
    },
  });

  const { data: balances, isLoading: balancesLoading } = useQuery<{ data: Balance[] }>({
    queryKey: ['user-balances', id],
    queryFn: async () => {
      const res = await api.get(`/accounts/v1/admin/users/${id}/balances`);
      return res.data;
    },
  });

  const { data: activity, isLoading: activityLoading } = useQuery<{ data: Activity[] }>({
    queryKey: ['user-activity', id],
    queryFn: async () => {
      const res = await api.get(`/accounts/v1/admin/users/${id}/activity`);
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
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/users" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{user.username || user.email}</h1>
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {user.status || 'Unknown'}
        </span>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">User Details</h3>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.email}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Wallet Address</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">{user.walletAddress || '-'}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Joined</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{new Date(user.createdAt).toLocaleString()}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Country</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.country || '-'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BalancesCard balances={balances?.data || []} />
        <ActivityList activities={activity?.data || []} />
      </div>
    </div>
  );
}
