"use client";

import { useState } from "react";
import WalletsTable from "@/components/wallets-table";
import { WALLET_FILTERS, WalletFilter } from "@/types";

export default function WalletsPage() {
  const [filter, setFilter] = useState<WalletFilter>("active");

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Wallets</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as WalletFilter)}
          className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
        >
          {WALLET_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <WalletsTable filter={filter} />
    </div>
  );
}
