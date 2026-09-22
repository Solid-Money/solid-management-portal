"use client";

import { useState } from "react";
import WalletsBoard from "@/components/wallets/wallets-board";
import { WALLET_FILTERS, WalletFilter } from "@/types";

export default function WalletsPage() {
  const [filter, setFilter] = useState<WalletFilter>("active");

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Treasury</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Every wallet and pool we run in production, grouped by what stops
            working when it empties. Open a wallet to see what it actually
            consumes, how long it has left, and who it has already blocked.
          </p>
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as WalletFilter)}
          className="mt-1 block w-40 shrink-0 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          {WALLET_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <WalletsBoard filter={filter} />
    </div>
  );
}
