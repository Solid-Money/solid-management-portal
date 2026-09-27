"use client";

import { useState } from "react";
import WalletsBoard from "@/components/wallets/wallets-board";
import FundingLedger from "@/components/wallets/funding-ledger";
import ExternalAccounts from "@/components/wallets/external-accounts";
import { WALLET_FILTERS, WalletFilter } from "@/types";

type Tab = "wallets" | "funding";

const TABS: Array<{ value: Tab; label: string; blurb: string }> = [
  {
    value: "wallets",
    label: "Wallets",
    blurb:
      "Every wallet and pool we run in production, grouped by what stops " +
      "working when it empties. Open a wallet to see what it actually costs, " +
      "how long it has left, and who it has already blocked.",
  },
  {
    value: "funding",
    label: "Funding",
    blurb:
      "What we have actually spent topping wallets up, and the prepaid " +
      "accounts whose balance we cannot read from here.",
  },
];

export default function WalletsPage() {
  const [filter, setFilter] = useState<WalletFilter>("active");
  const [tab, setTab] = useState<Tab>("wallets");

  const active = TABS.find((option) => option.value === tab) ?? TABS[0];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Treasury</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">{active.blurb}</p>
        </div>
        {tab === "wallets" && (
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
        )}
      </div>

      <div className="mb-5 border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          {TABS.map((option) => (
            <button
              key={option.value}
              onClick={() => setTab(option.value)}
              className={`border-b-2 px-1 pb-2 text-sm ${
                tab === option.value
                  ? "border-indigo-600 font-medium text-indigo-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "wallets" ? (
        <WalletsBoard filter={filter} />
      ) : (
        <div className="space-y-6">
          {/* Above the ledger deliberately: this is the account that emptied
              without the page noticing, and it is the one an operator most
              needs prompting to go and look at. */}
          <section>
            <h2 className="mb-2 text-sm font-medium text-gray-900">
              Held with third parties
            </h2>
            <ExternalAccounts />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-medium text-gray-900">
              What we funded
            </h2>
            <FundingLedger />
          </section>
        </div>
      )}
    </div>
  );
}
