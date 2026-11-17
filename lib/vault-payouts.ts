import type { VaultFeeAccountant } from "@/types/revenue";

/** One address the vault accountants pay their fees to. */
export interface VaultPayout {
  address: string;
  explorerUrl: string | null;
  /** Claimed plus unclaimed, in USD, across the accountants paying it. */
  valueUsd: number;
  /** The vaults paying it, e.g. "soUSD", once each. */
  vaults: string[];
  accountants: number;
}

/**
 * The payout addresses, most money first.
 *
 * The accountants come back sorted by vault name, so the first one is the
 * alphabetically first vault (soBTC), not the one that matters: taking its
 * payout put an address receiving dust at the top of the row while the
 * address holding nearly all the fees sat behind "+2 more". Ranking by the
 * fees each address has received or is owed puts the one an operator
 * actually wants first. A value that could not be read counts as nothing;
 * ties keep the accountants' order.
 */
export function rankVaultPayouts(accountants: VaultFeeAccountant[]): VaultPayout[] {
  const byAddress = new Map<string, VaultPayout>();
  for (const accountant of accountants) {
    if (!accountant.payoutAddress) continue;
    const key = accountant.payoutAddress.toLowerCase();
    let payout = byAddress.get(key);
    if (!payout) {
      payout = {
        address: accountant.payoutAddress,
        explorerUrl: accountant.payoutExplorerUrl,
        valueUsd: 0,
        vaults: [],
        accountants: 0,
      };
      byAddress.set(key, payout);
    }
    payout.valueUsd += (accountant.claimedUsd ?? 0) + (accountant.unclaimedUsd ?? 0);
    payout.explorerUrl ??= accountant.payoutExplorerUrl;
    payout.accountants += 1;
    if (!payout.vaults.includes(accountant.vault)) payout.vaults.push(accountant.vault);
  }
  // Array.prototype.sort is stable, so equal values keep first-seen order.
  return [...byAddress.values()].sort((a, b) => b.valueUsd - a.valueUsd);
}
