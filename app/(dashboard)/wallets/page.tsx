"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import WalletsBoard from "@/components/wallets/wallets-board";
import FundingLedger from "@/components/wallets/funding-ledger";
import RefillModal from "@/components/wallets/refill-modal";
import TreasuryAudit from "@/components/wallets/treasury-audit";
import AlertSettings from "@/components/wallets/alert-settings";
import { Button } from "@/components/ui/button";
import {
  getTreasurySettings,
  updateTreasurySettings,
} from "@/lib/wallets";
import {
  WALLET_FILTERS,
  WalletAssetPlan,
  WalletFilter,
  WalletTreasurySettings,
} from "@/types";

type Tab = "wallets" | "funding" | "history";

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
    blurb: "What we have actually spent topping wallets up.",
  },
  {
    value: "history",
    label: "History",
    blurb:
      "Who changed a threshold, who said they had sent a top-up, and when.",
  },
];

/** What changed, in the words the control uses, so the toast confirms the act. */
function describeSettingChange(
  next: WalletTreasurySettings,
  sent: Partial<WalletTreasurySettings>
): string {
  if (sent.pingOnUrgent !== undefined) {
    return next.pingOnUrgent
      ? "Urgent balance alerts will mention Mark Smargon"
      : "Urgent balance alerts will not mention anyone";
  }
  if (sent.criticalDays !== undefined) {
    return `Tokens are urgent at ${next.criticalDays} days of cover or less`;
  }
  if (sent.lowDays !== undefined) {
    return `Tokens are low at ${next.lowDays} days of cover or less`;
  }
  if (sent.alertIntervalMinutes !== undefined) {
    return `Slack will hear at most every ${next.alertIntervalMinutes} minutes`;
  }
  return "Saved";
}

export default function WalletsPage() {
  const [filter, setFilter] = useState<WalletFilter>("active");
  const [tab, setTab] = useState<Tab>("wallets");
  const [refillable, setRefillable] = useState<WalletAssetPlan[]>([]);
  const [refilling, setRefilling] = useState(false);
  const queryClient = useQueryClient();

  // Stable so the board's effect does not re-fire on every render of this page.
  const handleRefillable = useCallback(
    (items: WalletAssetPlan[]) => setRefillable(items),
    []
  );

  const { data: settings } = useQuery<WalletTreasurySettings>({
    queryKey: ["treasury-settings"],
    queryFn: getTreasurySettings,
  });

  const saveSettings = useMutation({
    mutationFn: updateTreasurySettings,
    onSuccess: (next, sent) => {
      queryClient.setQueryData(["treasury-settings"], next);
      // Both reads are judged against these numbers, so both are stale now.
      void queryClient.invalidateQueries({ queryKey: ["wallet-plans"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-audit"] });
      toast.success(describeSettingChange(next, sent));
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not save that setting"),
  });

  const active = TABS.find((option) => option.value === tab) ?? TABS[0];
  const nothingToFund = refillable.length === 0;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Treasury</h1>
            {tab === "wallets" && (
              <span
                // The tooltip is the whole point of leaving the button in place
                // when disabled: "nothing to do" is information, and a button
                // that disappears when the work is done leaves the reader
                // wondering whether it failed to load.
                title={
                  nothingToFund
                    ? "All wallets are refilled"
                    : `${refillable.length} token${
                        refillable.length === 1 ? "" : "s"
                      } need funding`
                }
              >
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={nothingToFund}
                  onClick={() => setRefilling(true)}
                >
                  Refill
                  {!nothingToFund && ` (${refillable.length})`}
                </Button>
              </span>
            )}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">{active.blurb}</p>
        </div>

        {tab === "wallets" && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as WalletFilter)
              }
              className="mt-1 block w-40 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {WALLET_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Whoever gets woken up should be able to stop it themselves. A
                mention nobody can switch off is one people learn to mute, and
                a muted channel costs more than a quiet one. */}
            <label className="flex items-center gap-2 text-xs text-gray-600">
              {saveSettings.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={settings?.pingOnUrgent ?? true}
                  onChange={(event) =>
                    saveSettings.mutate({ pingOnUrgent: event.target.checked })
                  }
                />
              )}
              Ping Mark Smargon for urgent balance alerts
            </label>

            <AlertSettings settings={settings} save={saveSettings} />
          </div>
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

      {/* Kept mounted across tabs: it owns the refill queue the button above
          opens, and unmounting it would empty that the moment somebody looked
          at the funding ledger. */}
      <div className={tab === "wallets" ? undefined : "hidden"}>
        <WalletsBoard filter={filter} onRefillableChange={handleRefillable} />
      </div>

      {tab === "funding" && <FundingLedger />}
      {tab === "history" && <TreasuryAudit />}

      <RefillModal
        items={refillable}
        open={refilling}
        onClose={() => setRefilling(false)}
      />
    </div>
  );
}
