"use client";

import { useQuery } from "@tanstack/react-query";
import { Coins, Loader2, PiggyBank, TrendingUp } from "lucide-react";

import { getUserSavings } from "@/lib/api";
import { SavingsVaultResult, VaultKey } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const VAULT_META: Record<
  VaultKey,
  { token: string; decimals: number; valueDecimals: number }
> = {
  USDC: { token: "soUSD", decimals: 2, valueDecimals: 2 },
  FUSE: { token: "soFUSE", decimals: 2, valueDecimals: 2 },
  ETH: { token: "soETH", decimals: 4, valueDecimals: 6 },
};

function toNumber(value?: string | number): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function usd(value?: string | number): string {
  return `$${toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A vault figure in the unit it is actually denominated in.
 *
 * Only soUSD reports dollars. soFUSE reports FUSE and soETH reports ETH, so
 * rendering either with a `$` overstated the position by the whole token price
 * — a 5,120 FUSE position (~$18) read as $5,120.
 */
function denominated(
  value: string | number | undefined,
  symbol: string,
  decimals: number
): string {
  if (symbol === "USD") return usd(value);
  return `${toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  })} ${symbol}`;
}

/** What the backend says this vault's figures are in, with a safe default. */
function unitOf(vault: SavingsVaultResult): string {
  return vault.underlyingSymbol ?? (vault.vault === "USDC" ? "USD" : vault.vault);
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

  // Every vault priced into dollars before totalling. Summing the raw figures
  // would add FUSE and ETH to dollars as if all three were the same unit.
  const totalUsd = vaults.reduce(
    (sum, vault) =>
      sum +
      toNumber(vault.summary?.totalValueUSD) * (vault.underlyingPriceUsd ?? 0),
    0
  );

  // A vault holding something we could not price is missing from that total,
  // so the total is shown as a floor rather than as the whole picture.
  const totalIsPartial = vaults.some(
    (vault) =>
      vault.underlyingPriceUsd == null &&
      toNumber(vault.summary?.totalValueUSD) > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-gray-400" />
          Savings
        </CardTitle>
        {!isLoading && vaults.length > 0 && (
          <span
            className="text-sm font-semibold text-gray-900"
            title={
              totalIsPartial
                ? "At least one vault could not be priced and is missing from this total."
                : undefined
            }
          >
            {totalIsPartial ? "≥ " : ""}
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
          vaults.map((result) => {
            const { vault, summary, error: vaultError } = result;
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

            const shares = toNumber(summary.balanceShares);
            const interest = toNumber(summary.interestEarnedUSD);
            const unit = unitOf(result);
            const price = result.underlyingPriceUsd;
            const amount = (value: string | number | undefined) =>
              denominated(value, unit, meta.valueDecimals);
            // The dollar line only earns its place where the figures above it
            // are not already dollars.
            const valueUsd =
              unit === "USD" || price == null
                ? null
                : toNumber(summary.totalValueUSD) * price;

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
                      {amount(summary.totalValueUSD)}
                    </p>
                    {valueUsd !== null && (
                      <p className="text-[11px] text-gray-500">
                        ≈ {usd(valueUsd)}
                      </p>
                    )}
                    {unit !== "USD" && price == null && (
                      <p className="text-[11px] text-amber-600">
                        No {unit} price
                      </p>
                    )}
                    <p className="flex items-center justify-end gap-1 text-[11px] text-gray-500">
                      <TrendingUp className="h-3 w-3" />
                      {summary.apyPercent.toFixed(2)}% APY
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                  <span>Deposited {amount(summary.actualDepositedUSD)}</span>
                  <span
                    className={
                      interest >= 0 ? "text-emerald-600" : "text-red-600"
                    }
                  >
                    Interest {amount(interest)}
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
