"use client";

import { Balance } from "@/types";
import { Wallet, CreditCard, PiggyBank } from "lucide-react";

export default function BalancesCard({ balances }: { balances: Balance[] }) {
  return (
    <div className="bg-white shadow-sm border border-gray-100 overflow-hidden sm:rounded-xl">
      <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-base leading-6 font-semibold text-gray-900">
          Balances
        </h3>
      </div>
      <div className="px-4 py-4">
        {balances.length === 0 ? (
          <div className="p-4 text-gray-400 text-center text-sm">No balances found</div>
        ) : (
          <div className="space-y-4">
            {balances.map((balance, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-white shadow-sm mr-3">
                    {balance.accountType === "savings" ? (
                      <PiggyBank className="h-5 w-5 text-emerald-500" />
                    ) : balance.accountType === "card" ? (
                      <CreditCard className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Wallet className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {balance.currency}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {balance.accountType || "Wallet"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {balance.total} {balance.currency}
                  </p>
                  {balance.accountType === "card" && (
                    <p className="text-[10px] text-gray-500">
                      Avail: {balance.available} | Pend: {balance.pending}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
