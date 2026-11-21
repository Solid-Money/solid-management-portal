import { describe, expect, it } from "vitest";

import { rankVaultPayouts } from "@/lib/vault-payouts";
import type { VaultFeeAccountant } from "@/types/revenue";

const REVENUE_WALLET = "0x845703b9ffAdfbEBaDc6a9E23E1DDe39Fdec6A6b";
const BTC_ETH_PAYOUT = "0x3B694d634981Ace4B64a27c48bffe19f1447779B";
const LIFI_WALLET = "0x6c404c244e1aD2E1CE525492EbBd4a9C12E458aa";

const accountant = (
  vault: string,
  chainId: number,
  payoutAddress: string | null,
  claimedUsd: number | null,
  unclaimedUsd: number | null
): VaultFeeAccountant => ({
  vault,
  chainId,
  chainName: null,
  accountant: "0x0000000000000000000000000000000000000001",
  accountantExplorerUrl: null,
  payoutAddress,
  payoutExplorerUrl: payoutAddress ? `https://explorer/${payoutAddress}` : null,
  asset: { symbol: "USDC", address: null, decimals: 6 },
  unclaimed: null,
  claimed: null,
  claimCount: null,
  lastClaimAt: null,
  lastClaimTxHash: null,
  lastClaimExplorerUrl: null,
  usdPrice: null,
  unclaimedUsd,
  claimedUsd,
});

describe("rankVaultPayouts", () => {
  it("puts the address holding the most fees first, not the first vault's", () => {
    // The order the API returns: by vault name, so soBTC comes first.
    const payouts = rankVaultPayouts([
      accountant("soBTC", 1, BTC_ETH_PAYOUT, 0, 0),
      accountant("soBTC", 8453, BTC_ETH_PAYOUT, 0, 0),
      accountant("soETH", 122, BTC_ETH_PAYOUT, 0, 5.4),
      accountant("soEUR", 8453, LIFI_WALLET, 0, 6.3),
      accountant("soFUSE", 122, REVENUE_WALLET, 120, 2353),
      accountant("soUSD", 122, REVENUE_WALLET, 300.97, 1272.84),
      accountant("soUSD", 1, REVENUE_WALLET, 0, 15.24),
    ]);

    expect(payouts.map((p) => [p.address, p.vaults, p.accountants])).toEqual([
      [REVENUE_WALLET, ["soFUSE", "soUSD"], 3],
      [LIFI_WALLET, ["soEUR"], 1],
      [BTC_ETH_PAYOUT, ["soBTC", "soETH"], 3],
    ]);
    expect(payouts[0].valueUsd).toBeCloseTo(4062.05, 2);
    expect(payouts[0].explorerUrl).toBe(`https://explorer/${REVENUE_WALLET}`);
  });

  it("treats a value it could not read as nothing and skips unknown payouts", () => {
    const payouts = rankVaultPayouts([
      accountant("soBTC", 1, BTC_ETH_PAYOUT, null, null),
      accountant("soETH", 1, null, 50, 50),
      accountant("soUSD", 122, REVENUE_WALLET, 1, null),
    ]);

    expect(payouts.map((p) => [p.address, p.valueUsd])).toEqual([
      [REVENUE_WALLET, 1],
      [BTC_ETH_PAYOUT, 0],
    ]);
  });

  it("matches an address in any case and keeps first-seen order on a tie", () => {
    const payouts = rankVaultPayouts([
      accountant("soBTC", 1, BTC_ETH_PAYOUT, 0, 0),
      accountant("soETH", 1, BTC_ETH_PAYOUT.toLowerCase(), 0, 0),
      accountant("soEUR", 8453, LIFI_WALLET, 0, 0),
    ]);

    expect(payouts.map((p) => [p.address, p.accountants])).toEqual([
      [BTC_ETH_PAYOUT, 2],
      [LIFI_WALLET, 1],
    ]);
  });
});
