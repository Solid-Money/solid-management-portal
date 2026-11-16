import { describe, expect, it } from "vitest";
import { cashbackPayoutLink } from "@/lib/cashback-payout";

const HASH = "0x5b1e0f6c3a7d2e9f8b4c1a0d6e3f2b7c9a8d1e0f4b3c2a1d0e9f8b7c6a5d4e3f";

describe("cashbackPayoutLink", () => {
  it("links a Base payout to Basescan", () => {
    expect(cashbackPayoutLink(HASH, 8453)).toEqual({
      url: `https://basescan.org/tx/${HASH}`,
      chainName: "Base",
    });
  });

  it("links a Fuse payout to the Fuse explorer", () => {
    expect(cashbackPayoutLink(HASH, 122)).toEqual({
      url: `https://explorer.fuse.io/tx/${HASH}`,
      chainName: "Fuse",
    });
  });

  it("reads a payout recorded without a chain as Fuse, where all of those went", () => {
    expect(cashbackPayoutLink(HASH, undefined)?.chainName).toBe("Fuse");
    expect(cashbackPayoutLink(HASH, null)?.chainName).toBe("Fuse");
  });

  it("links nothing that is not a transfer", () => {
    expect(cashbackPayoutLink(undefined, 8453)).toBeUndefined();
    expect(cashbackPayoutLink(null, 122)).toBeUndefined();
    expect(cashbackPayoutLink("", 122)).toBeUndefined();
    expect(cashbackPayoutLink("DEDUCTED_FROM_DEBT", undefined)).toBeUndefined();
  });

  it("links nothing on a chain cashback is not paid on", () => {
    expect(cashbackPayoutLink(HASH, 1)).toBeUndefined();
  });
});
