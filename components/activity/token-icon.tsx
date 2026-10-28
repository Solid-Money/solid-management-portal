"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const TRUST_WALLET = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

/**
 * Logos for the rest of what the app's deposit screen takes, so a deposit of
 * one renders as itself rather than a letter. Trust Wallet's where it has one;
 * cbBTC and SLVx are the app's own marks, served from /public.
 */
const DEPOSIT_TOKEN_LOGOS: Record<string, string> = {
  PAXG: `${TRUST_WALLET}/ethereum/assets/0x45804880De22913dAFE09f4980848ECE6EcbAf78/logo.png`,
  SLVX: "/tokens/slvx.png",
  WBTC: `${TRUST_WALLET}/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png`,
  CBBTC: "/tokens/cbbtc.png",
  ZEC: `${TRUST_WALLET}/zcash/info/logo.png`,
  UNI: `${TRUST_WALLET}/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png`,
  NEAR: `${TRUST_WALLET}/near/info/logo.png`,
  ENA: `${TRUST_WALLET}/ethereum/assets/0x57e114B691Db790C35207b2e685D4A43181e6061/logo.png`,
  AAVE: `${TRUST_WALLET}/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png`,
  SOL: `${TRUST_WALLET}/solana/info/logo.png`,
  WLD: `${TRUST_WALLET}/ethereum/assets/0x163f8C2467924be0ae7B5347228CABF260318753/logo.png`,
  ARB: `${TRUST_WALLET}/arbitrum/info/logo.png`,
  OP: `${TRUST_WALLET}/optimism/info/logo.png`,
};

interface TokenIconProps {
  symbol?: string;
  logoUrl?: string;
  size?: number;
  className?: string;
}

export const DefaultTokenIcon = ({
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
  const [error, setError] = useState(false);

  if (logoUrl && !error) {
    return (
      <Image
        src={logoUrl}
        alt={symbol || "Token"}
        width={size}
        height={size}
        className={cn("rounded-full", className)}
        onError={() => setError(true)}
      />
    );
  }


  // Fallback for common tokens if logoUrl is missing
  const getCommonLogo = (sym?: string) => {
    if (!sym) return null;
    const s = sym.toUpperCase();
    if (DEPOSIT_TOKEN_LOGOS[s]) return DEPOSIT_TOKEN_LOGOS[s];
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
      <Image
        src={commonLogo}
        alt={symbol || "Token"}
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



