'use client';

import { Balance } from '@/types';
import { Wallet, CreditCard, PiggyBank } from 'lucide-react';

export default function BalancesCard({ balances }: { balances: Balance[] }) {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Balances</h3>
      </div>
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
        {balances.length === 0 ? (
          <div className="p-4 text-gray-500 text-center">No balances found</div>
        ) : (
          <dl className="sm:divide-y sm:divide-gray-200">
            {balances.map((balance, index) => (
              <div key={index} className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  {balance.accountType === 'savings' ? (
                    <PiggyBank className="h-5 w-5 mr-2 text-green-500" />
                  ) : balance.accountType === 'card' ? (
                    <CreditCard className="h-5 w-5 mr-2 text-blue-500" />
                  ) : (
                    <Wallet className="h-5 w-5 mr-2 text-gray-500" />
                  )}
                  {balance.currency} {balance.accountType ? `(${balance.accountType})` : ''}
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="flex justify-between">
                    <span>Total: {balance.total}</span>
                    <span className="text-gray-500 text-xs">(Avail: {balance.available}, Pend: {balance.pending})</span>
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
