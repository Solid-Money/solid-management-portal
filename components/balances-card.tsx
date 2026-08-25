"use client";

import { Balance } from "@/types";
import { Coins, CreditCard, PiggyBank, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Every account a user holds money in, in the order the app presents them.
 * Rows are shown even at zero so "they have no soETH" and "we failed to read
 * soETH" are not the same blank space.
 */
const ACCOUNT_ORDER = [
  "card",
  "savings",
  "fuse-savings",
  "eth-savings",
  "wallet",
] as const;

const ACCOUNT_LABELS: Record<string, string> = {
  card: "Card",
  savings: "soUSD Savings",
  "fuse-savings": "soFUSE Savings",
  "eth-savings": "soETH Savings",
  wallet: "Wallet",
};

function iconFor(accountType?: string) {
  switch (accountType) {
    case "card":
      return <CreditCard className="h-5 w-5 text-blue-500" />;
    case "savings":
      return <PiggyBank className="h-5 w-5 text-emerald-500" />;
    case "fuse-savings":
      return <Coins className="h-5 w-5 text-amber-500" />;
    case "eth-savings":
      return <Coins className="h-5 w-5 text-slate-500" />;
    default:
      return <Wallet className="h-5 w-5 text-gray-500" />;
  }
}

function formatAmount(value: number, currency: string): string {
  // Non-USD assets keep more precision: 0.0042 ETH must not round to 0.00.
  const decimals = currency === "soETH" || currency === "ETH" ? 6 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}

export default function BalancesCard({ balances }: { balances: Balance[] }) {
  const byType = new Map(
    balances.map((balance) => [balance.accountType ?? "wallet", balance])
  );

  // Anything the backend returns that isn't one of the known accounts still
  // gets a row rather than being silently dropped.
  const extras = balances.filter(
    (balance) =>
      !ACCOUNT_ORDER.includes(
        (balance.accountType ?? "wallet") as (typeof ACCOUNT_ORDER)[number]
      )
  );

  const rows = [
    ...ACCOUNT_ORDER.map((accountType) => byType.get(accountType)).filter(
      (balance): balance is Balance => Boolean(balance)
    ),
    ...extras,
  ];

  const totalUsd = rows.reduce(
    (sum, balance) => sum + (balance.usdValue ?? 0),
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balances</CardTitle>
        <span className="text-sm font-semibold text-gray-900">
          ${totalUsd.toFixed(2)}
        </span>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No balances available.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((balance, index) => {
              const accountType = balance.accountType ?? "wallet";
              const label =
                balance.label ?? ACCOUNT_LABELS[accountType] ?? accountType;

              return (
                <div
                  key={`${accountType}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-white p-2 shadow-sm">
                      {iconFor(accountType)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {label}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-gray-500">
                          {balance.currency}
                        </p>
                        {balance.provider && (
                          <Badge variant="muted">{balance.provider}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {formatAmount(balance.total, balance.currency)}{" "}
                      {balance.currency}
                    </p>
                    {/* The USD line only earns its place when the row is not
                        already denominated in dollars. */}
                    {balance.usdValue !== undefined &&
                      balance.currency !== "USD" &&
                      balance.currency !== "USDC" &&
                      balance.currency !== "soUSD" && (
                        <p className="text-[11px] text-gray-500">
                          $
                          {balance.usdValue.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
