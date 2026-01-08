"use client";

import { Balance } from "@/types";
import { Wallet, CreditCard, PiggyBank } from "lucide-react";

export default function BalancesCard({ balances }: { balances: Balance[] }) {
  // Ensure we always have savings and wallet accounts shown even if they have 0 balance
  const defaultBalances: Balance[] = [
    {
      accountType: "savings",
      currency: "USDC",
      available: 0,
      pending: 0,
      total: 0,
    },
    {
      accountType: "wallet",
      currency: "USDC",
      available: 0,
      pending: 0,
      total: 0,
    },
  ];

  // Merge provided balances with defaults
  const displayBalances = [...defaultBalances];

  balances.forEach((balance) => {
    const type = balance.accountType?.toLowerCase() || "wallet";
    const existingIndex = displayBalances.findIndex(
      (b) => (b.accountType?.toLowerCase() || "wallet") === type
    );

    if (existingIndex !== -1) {
      displayBalances[existingIndex] = balance;
    } else {
      displayBalances.push(balance);
    }
  });

  return (
    <div className="bg-white shadow-sm border border-gray-100 overflow-hidden sm:rounded-xl">
      <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-base leading-6 font-semibold text-gray-900">
          Balances
        </h3>
      </div>
      <div className="px-4 py-4">
        <div className="space-y-4">
          {displayBalances.map((balance, index) => (
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
                  {balance.total.toFixed(2)} {balance.currency}
                </p>
                {balance.accountType === "card" && (
                  <p className="text-[10px] text-gray-500">
                    Avail: {balance.available.toFixed(2)} | Pend: {balance.pending.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
