/**
 * Where a cashback payout went, and its explorer link.
 *
 * Cashback is paid in soUSD from Base first, and from Fuse when Base cannot
 * cover a payout. The backend records the chain with the hash
 * (`payoutChainId` on a cashback row, `cashbackChainId` on an AI API charge).
 * A row paid before the chain was recorded has none, and every one of those
 * went out on Fuse.
 */

/** Fuse, where every cashback payout went before the chain was recorded. */
export const LEGACY_CASHBACK_PAYOUT_CHAIN_ID = 122;

const PAYOUT_EXPLORERS: Record<number, { chainName: string; url: string }> = {
  8453: { chainName: "Base", url: "https://basescan.org" },
  122: { chainName: "Fuse", url: "https://explorer.fuse.io" },
};

export interface CashbackPayoutLink {
  url: string;
  chainName: string;
}

/**
 * The explorer link for a payout, or undefined when there is no transfer to
 * link: not paid yet, or settled against debt (`DEDUCTED_FROM_DEBT`), or on a
 * chain cashback is never paid on.
 */
export function cashbackPayoutLink(
  txHash: string | null | undefined,
  chainId: number | null | undefined,
): CashbackPayoutLink | undefined {
  if (!txHash || !/^0x[0-9a-fA-F]+$/.test(txHash)) return undefined;
  const explorer = PAYOUT_EXPLORERS[chainId ?? LEGACY_CASHBACK_PAYOUT_CHAIN_ID];
  if (!explorer) return undefined;
  return {
    url: `${explorer.url}/tx/${txHash}`,
    chainName: explorer.chainName,
  };
}
