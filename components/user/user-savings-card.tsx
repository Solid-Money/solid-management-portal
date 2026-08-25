"use client";

import { useQuery } from "@tanstack/react-query";
import { Coins, Loader2, PiggyBank, TrendingUp } from "lucide-react";

import { getUserSavings } from "@/lib/api";
import { SavingsVaultResult, VaultKey } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const VAULT_META: Record<
  VaultKey,
  { token: string; unit: string; decimals: number }
> = {
  USDC: { token: "soUSD", unit: "USDC", decimals: 2 },
  FUSE: { token: "soFUSE", unit: "FUSE", decimals: 2 },
  ETH: { token: "soETH", unit: "ETH", decimals: 4 },
};

function usd(value?: string | number): string {
  const num = Number(value ?? 0);
  return `$${(Number.isFinite(num) ? num : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * The three savings vaults, read from the same service the app's savings screen
 * uses — so the balance, the interest earned and the APY here are the exact
 * numbers the customer is looking at when they ask about them.
 *
 * Vaults that fail to read report the failure in place: one vault's RPC being
 * down must not leave the other two looking like zeroes.
 */
export default function UserSavingsCard({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery<{ data: SavingsVaultResult[] }>({
    queryKey: ["user-savings", userId],
    queryFn: async () => (await getUserSavings(userId)).data,
  });

  const vaults = data?.data ?? [];
  const totalUsd = vaults.reduce(
    (sum, vault) => sum + Number(vault.summary?.totalValueUSD ?? 0),
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-gray-400" />
          Savings
        </CardTitle>
        {!isLoading && vaults.length > 0 && (
          <span className="text-sm font-semibold text-gray-900">
            {usd(totalUsd)}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load savings.</p>
        ) : vaults.length === 0 ? (
          <p className="text-sm text-gray-500">No savings data available.</p>
        ) : (
          vaults.map(({ vault, summary, error: vaultError }) => {
            const meta = VAULT_META[vault];
            if (!summary) {
              return (
                <div
                  key={vault}
                  className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-700"
                >
                  <span className="font-medium">{meta.token}</span> could not be
                  read{vaultError ? `: ${vaultError}` : "."}
                </div>
              );
            }

            const shares = Number(summary.balanceShares || 0);
            const interest = Number(summary.interestEarnedUSD || 0);

            return (
              <div
                key={vault}
                className="rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {vault === "FUSE" ? (
                      <Coins className="h-4 w-4 text-amber-500" />
                    ) : vault === "ETH" ? (
                      <Coins className="h-4 w-4 text-slate-500" />
                    ) : (
                      <PiggyBank className="h-4 w-4 text-emerald-500" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {summary.vaultToken}
                      </p>
                      <p className="text-xs text-gray-500">
                        {shares.toFixed(meta.decimals)} shares
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {usd(summary.totalValueUSD)}
                    </p>
                    <p className="flex items-center justify-end gap-1 text-[11px] text-gray-500">
                      <TrendingUp className="h-3 w-3" />
                      {summary.apyPercent.toFixed(2)}% APY
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                  <span>Deposited {usd(summary.actualDepositedUSD)}</span>
                  <span
                    className={
                      interest >= 0 ? "text-emerald-600" : "text-red-600"
                    }
                  >
                    Interest {usd(interest)}
                  </span>
                  <span>{summary.activityCount} activities</span>
                  {summary.lastDepositAt && (
                    <span>
                      Last deposit{" "}
                      {new Date(summary.lastDepositAt).toLocaleDateString()}
                    </span>
                  )}
                  {shares === 0 && <Badge variant="muted">Empty</Badge>}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
