"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { DefaultTokenIcon } from "@/components/activity/token-icon";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import { ListedToken, TokenChain } from "@/types";

/** Every chain's name, falling back to its id for one the backend did not list. */
export function chainNameOf(chains: TokenChain[], chainId: number): string {
  return (
    chains.find((chain) => chain.chainId === chainId)?.name ??
    `Chain ${chainId}`
  );
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Whether a row answers a search: by ticker, name, contract or either id. */
export function matchesTokenSearch(token: ListedToken, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    token.symbol,
    token.name,
    token.address,
    token.commonId,
    token.tokenId,
  ]
    .filter((value): value is string => !!value)
    .some((value) => value.toLowerCase().includes(needle));
}

/**
 * A token's logo, drawn exactly from the URL the app will load. A plain `img`
 * rather than `next/image`, which only loads from the hosts it was configured
 * for and would refuse most logo URLs an admin pastes.
 */
export function TokenLogo({
  symbol,
  logoURI,
  size = 32,
  className,
}: {
  symbol: string;
  logoURI?: string;
  size?: number;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!logoURI || failedUrl === logoURI) {
    return (
      <div className={className}>
        <DefaultTokenIcon symbol={symbol || "T"} size={size} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- any https host an admin pastes; the preview must load what the app will
    <img
      src={logoURI}
      alt={symbol}
      width={size}
      height={size}
      className={cn(
        "shrink-0 rounded-full bg-gray-100 object-cover",
        className
      )}
      style={{ width: size, height: size }}
      onError={() => setFailedUrl(logoURI)}
    />
  );
}

/** The contract, shortened, with copy and a link to the chain's explorer. */
export function ContractAddress({
  address,
  chain,
}: {
  address: string;
  chain?: TokenChain;
}) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-gray-600">
      {shortAddress(address)}
      <CopyButton value={address} label="Contract address" />
      {chain?.explorerUrl ? (
        <a
          href={`${chain.explorerUrl}/token/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-gray-600"
          aria-label={`Open on ${chain.name}'s explorer`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </span>
  );
}
