"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  WalletStatusResponse,
  WalletInfo,
  ChainBalance,
  WalletFilter,
} from "@/types";
import {
  Loader2,
  Copy,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  ArrowDownToLine,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type BalanceStatus = "OK" | "LOW" | "CRITICAL" | "N/A";

// Which token columns to show for a wallet. A token column (balance + address)
// is hidden when it is blank (N/A) on every chain of that wallet, so wallets
// only surface the assets they actually hold (e.g. a soUSD-only payout wallet
// no longer shows empty USDC/USDT columns).
interface VisibleColumns {
  gas: boolean;
  usdc: boolean;
  usdt: boolean;
  soUsd: boolean;
}

const isActive = (status?: BalanceStatus): boolean =>
  status != null && status !== "N/A";

export default function WalletsTable({ filter }: { filter: WalletFilter }) {
  const [expandedWallets, setExpandedWallets] = useState<Set<string>>(
    new Set()
  );

  const { data, isLoading, error } = useQuery<WalletStatusResponse>({
    queryKey: ["wallets"],
    queryFn: async () => {
      const response = await api.get("/admin/v1/wallets/status");
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy");
    }
  };

  const truncateAddress = (address: string): string => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const toggleWallet = (walletName: string) => {
    const newExpanded = new Set(expandedWallets);
    if (newExpanded.has(walletName)) {
      newExpanded.delete(walletName);
    } else {
      newExpanded.add(walletName);
    }
    setExpandedWallets(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const baseClasses =
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case "OK":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "LOW":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case "CRITICAL":
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  // Compute which token columns are non-blank for at least one chain.
  const getVisibleColumns = (chains: ChainBalance[]): VisibleColumns => ({
    gas: chains.some((c) => isActive(c.gasStatus)),
    usdc: chains.some((c) => isActive(c.usdcStatus)),
    usdt: chains.some((c) => isActive(c.usdtStatus)),
    soUsd: chains.some((c) => isActive(c.soUsdStatus)),
  });

  const getStatusWithText = (status: string) => {
    switch (status) {
      case "OK":
        return (
          <span className="inline-flex items-center gap-1 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">OK</span>
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 text-yellow-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">Low</span>
          </span>
        );
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 text-red-700 animate-pulse">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-bold uppercase">Critical</span>
          </span>
        );
      default:
        return null;
    }
  };

  const amountClasses = (status?: BalanceStatus): string =>
    status === "CRITICAL"
      ? "text-red-900 font-bold"
      : status === "LOW"
      ? "text-yellow-700 font-medium"
      : "text-green-700";

  // A token balance cell (status + balance / threshold), or a dash when this
  // chain doesn't hold the token.
  const renderTokenCell = (
    status: BalanceStatus | undefined,
    balance: string | undefined,
    threshold: string | undefined,
    label: string
  ) => (
    <td className="px-4 py-2 text-sm">
      {isActive(status) ? (
        <div className="flex items-center gap-1.5">
          {getStatusWithText(status as string)}
          <span className={amountClasses(status)}>
            {parseFloat(balance ?? "0").toFixed(2)} {label}
          </span>
          <span className="text-gray-400 text-xs">/ {threshold}</span>
        </div>
      ) : (
        <span className="text-gray-400">-</span>
      )}
    </td>
  );

  // A token address cell with a copy button.
  const renderAddressCell = (address: string | undefined, isCritical: boolean) => (
    <td className="px-4 py-2 text-sm">
      {address && (
        <div className="flex items-center gap-1.5">
          <code
            className={`text-xs px-1.5 py-0.5 rounded ${
              isCritical
                ? "bg-red-100 text-red-900"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {truncateAddress(address)}
          </code>
          <button
            onClick={(e) => copyToClipboard(address, e)}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      )}
    </td>
  );

  const renderChainRow = (chain: ChainBalance, columns: VisibleColumns) => {
    const hasGas = isActive(chain.gasStatus);
    const hasUsdc = isActive(chain.usdcStatus);
    const hasUsdt = isActive(chain.usdtStatus);
    const hasSoUsd = isActive(chain.soUsdStatus);
    const isCritical =
      chain.gasStatus === "CRITICAL" ||
      chain.usdcStatus === "CRITICAL" ||
      chain.usdtStatus === "CRITICAL" ||
      chain.soUsdStatus === "CRITICAL";
    const isLow =
      chain.gasStatus === "LOW" ||
      chain.usdcStatus === "LOW" ||
      chain.usdtStatus === "LOW" ||
      chain.soUsdStatus === "LOW";

    const rowClasses = isCritical
      ? "border-t border-red-300 bg-red-50"
      : isLow
      ? "border-t border-yellow-200 bg-yellow-50"
      : "border-t border-green-100 bg-green-50";

    // Build helper text for LOW/CRITICAL statuses
    const getTopUpHelperText = () => {
      if (!isCritical && !isLow) return null;

      const needs: string[] = [];
      if (
        hasGas &&
        (chain.gasStatus === "LOW" || chain.gasStatus === "CRITICAL")
      ) {
        needs.push(`${chain.gasThreshold} ${chain.gasTokenSymbol}`);
      }
      if (
        hasSoUsd &&
        (chain.soUsdStatus === "LOW" || chain.soUsdStatus === "CRITICAL")
      ) {
        needs.push(`${chain.soUsdThreshold} soUSD`);
      }
      if (
        hasUsdc &&
        (chain.usdcStatus === "LOW" || chain.usdcStatus === "CRITICAL")
      ) {
        needs.push(`${chain.usdcThreshold} USDC`);
      }
      if (
        hasUsdt &&
        chain.usdtThreshold != null &&
        (chain.usdtStatus === "LOW" || chain.usdtStatus === "CRITICAL")
      ) {
        needs.push(`${chain.usdtThreshold} USDT`);
      }

      if (needs.length === 0) return null;

      return (
        <div
          className={`text-xs mt-1 ${
            isCritical ? "text-red-600 font-medium" : "text-yellow-600"
          }`}
        >
          💡 Send at least {needs.join(" and ")} on {chain.chainName}
        </div>
      );
    };

    return (
      <tr key={chain.chainId} className={rowClasses}>
        <td
          className={`px-4 py-2 text-sm ${
            isCritical ? "text-red-900 font-medium" : "text-gray-900"
          }`}
        >
          <div>
            <div className="flex items-center">
              {chain.chainName}
              {isCritical && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white animate-pulse">
                  URGENT
                </span>
              )}
            </div>
            {getTopUpHelperText()}
          </div>
        </td>
        {columns.gas && (
          <td className="px-4 py-2 text-sm">
            {hasGas ? (
              <div className="flex items-center gap-1.5">
                {getStatusWithText(chain.gasStatus)}
                <span className={amountClasses(chain.gasStatus)}>
                  {parseFloat(chain.gasBalance).toFixed(4)}{" "}
                  {chain.gasTokenSymbol}
                </span>
                <span className="text-gray-400 text-xs">
                  / {chain.gasThreshold}
                </span>
              </div>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </td>
        )}
        {columns.soUsd &&
          renderTokenCell(
            chain.soUsdStatus,
            chain.soUsdBalance,
            chain.soUsdThreshold,
            "soUSD"
          )}
        {columns.soUsd && renderAddressCell(chain.soUsdAddress, isCritical)}
        {columns.usdc &&
          renderTokenCell(
            chain.usdcStatus,
            chain.usdcBalance,
            chain.usdcThreshold,
            "USDC"
          )}
        {columns.usdc && renderAddressCell(chain.usdcAddress, isCritical)}
        {columns.usdt &&
          renderTokenCell(
            chain.usdtStatus,
            chain.usdtBalance,
            chain.usdtThreshold,
            "USDT"
          )}
        {columns.usdt && renderAddressCell(chain.usdtAddress, isCritical)}
      </tr>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">
          Failed to load wallet status. Please try again.
        </p>
      </div>
    );
  }

  if (!data || data.wallets.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
        <p className="text-gray-600">No wallets configured</p>
      </div>
    );
  }

  // A wallet is active unless explicitly marked inactive in the backend wallet
  // config. The page defaults to showing active wallets only.
  const filteredWallets = data.wallets.filter((wallet: WalletInfo) => {
    if (filter === "all") return true;
    const active = wallet.active !== false;
    return filter === "active" ? active : !active;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </p>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-gray-600">OK</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-gray-600">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-gray-600">Critical</span>
          </div>
        </div>
      </div>

      {filteredWallets.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
          <p className="text-gray-600">No {filter} wallets to display</p>
        </div>
      )}

      <div className="space-y-4">
        {filteredWallets.map((wallet: WalletInfo) => {
          const isExpanded = expandedWallets.has(wallet.name);
          const columns = getVisibleColumns(wallet.chains);
          const hasCritical = wallet.chains.some(
            (chain) =>
              chain.gasStatus === "CRITICAL" ||
              chain.usdcStatus === "CRITICAL" ||
              chain.usdtStatus === "CRITICAL" ||
              chain.soUsdStatus === "CRITICAL"
          );
          const hasLow = wallet.chains.some(
            (chain) =>
              chain.gasStatus === "LOW" ||
              chain.usdcStatus === "LOW" ||
              chain.usdtStatus === "LOW" ||
              chain.soUsdStatus === "LOW"
          );
          const needsTopUp = wallet.chains.some((chain) => chain.needsTopUp);
          const isAllOk = !hasCritical && !hasLow;

          return (
            <div
              key={wallet.name}
              className={`rounded-lg border overflow-hidden ${
                hasCritical
                  ? "border-red-400 bg-red-50 ring-2 ring-red-300"
                  : hasLow
                  ? "border-yellow-300 bg-yellow-50"
                  : "border-green-300 bg-green-50"
              }`}
            >
              <div
                className={`px-6 py-4 cursor-pointer transition-colors ${
                  hasCritical
                    ? "hover:bg-red-100"
                    : hasLow
                    ? "hover:bg-yellow-100"
                    : "hover:bg-green-100"
                }`}
                onClick={() => toggleWallet(wallet.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {hasCritical ? (
                      <AlertCircle className="h-6 w-6 text-red-600 animate-pulse" />
                    ) : hasLow ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    <div>
                      <h3
                        className={`text-lg font-medium ${
                          hasCritical
                            ? "text-red-900"
                            : hasLow
                            ? "text-yellow-900"
                            : "text-green-900"
                        }`}
                      >
                        {wallet.name}
                        {hasCritical && (
                          <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white animate-pulse">
                            🚨 CRITICAL
                          </span>
                        )}
                        {isAllOk && (
                          <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-600 text-white">
                            ✓ OK
                          </span>
                        )}
                      </h3>
                      <p
                        className={`text-sm mt-1 ${
                          hasCritical
                            ? "text-red-700"
                            : hasLow
                            ? "text-yellow-700"
                            : "text-green-700"
                        }`}
                      >
                        {wallet.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <code
                          className={`text-sm px-2 py-1 rounded ${
                            hasCritical
                              ? "text-red-700 bg-red-100"
                              : hasLow
                              ? "text-yellow-700 bg-yellow-100"
                              : "text-green-700 bg-green-100"
                          }`}
                        >
                          {truncateAddress(wallet.address)}
                        </code>
                        <button
                          onClick={(e) => copyToClipboard(wallet.address, e)}
                          className="text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200"
                          title="Send funds to this wallet address, not the token contract addresses listed below"
                        >
                          <ArrowDownToLine className="h-3 w-3" />
                          Transfer funds to this address
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasCritical ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-600 text-white">
                        Needs Immediate Attention
                      </span>
                    ) : needsTopUp ? (
                      <span className={getStatusBadge("LOW")}>
                        Needs Top-Up
                      </span>
                    ) : null}
                    <span className="text-gray-400">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-200 overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">
                          Chain
                        </th>
                        {columns.gas && (
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Gas
                          </th>
                        )}
                        {columns.soUsd && (
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            soUSD
                          </th>
                        )}
                        {columns.soUsd && (
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            soUSD Address
                          </th>
                        )}
                        {columns.usdc && (
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            USDC
                          </th>
                        )}
                        {columns.usdc && (
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            USDC Address
                          </th>
                        )}
                        {columns.usdt && (
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            USDT
                          </th>
                        )}
                        {columns.usdt && (
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            USDT Address
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {wallet.chains.map((chain) =>
                        renderChainRow(chain, columns)
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
