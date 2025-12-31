"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TokenIconProps {
  symbol?: string;
  logoUrl?: string;
  size?: number;
  className?: string;
}

const DefaultTokenIcon = ({
  symbol,
  size,
}: {
  symbol: string;
  size: number;
}) => {
  const char = symbol.charAt(0).toUpperCase();
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-red-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
  ];
  const colorIndex = char.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];

  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "flex items-center justify-center rounded-full text-white font-bold",
        bgColor
      )}
    >
      {char}
    </div>
  );
};

export const TokenIcon = ({
  symbol,
  logoUrl,
  size = 44,
  className,
}: TokenIconProps) => {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={symbol || "Token"}
        width={size}
        height={size}
        className={cn("rounded-full", className)}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  // Fallback for common tokens if logoUrl is missing
  const getCommonLogo = (sym?: string) => {
    if (!sym) return null;
    const s = sym.toUpperCase();
    if (s === "USDC")
      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png";
    if (s === "USDT")
      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png";
    if (s === "ETH" || s === "WETH")
      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";
    if (s === "FUSE")
      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/fuse/info/logo.png";
    return null;
  };

  const commonLogo = getCommonLogo(symbol);
  if (commonLogo) {
    return (
      <img
        src={commonLogo}
        alt={symbol}
        width={size}
        height={size}
        className={cn("rounded-full", className)}
      />
    );
  }

  return (
    <div className={className}>
      <DefaultTokenIcon symbol={symbol || "T"} size={size} />
    </div>
  );
};



