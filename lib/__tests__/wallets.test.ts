import { describe, expect, it, vi } from "vitest";
import {
  WALLET_ASSETS,
  monitoredAssets,
  readChainAsset,
} from "@/lib/wallets";
import type { ChainBalance } from "@/types";

// `@/lib/wallets` imports the API client, which starts Firebase on load; the
// helpers under test never call it. (Hoisted above the imports by vitest.)
vi.mock("@/lib/api", () => ({ default: {} }));

/** The Cashback Payout Wallet's Base row: soEUR plus ETH gas. */
const baseRow: ChainBalance = {
  chainId: 8453,
  chainName: "Base",
  gasBalance: "0.05",
  gasThreshold: "0.01",
  gasStatus: "OK",
  gasTokenSymbol: "ETH",
  usdcBalance: "0",
  usdcThreshold: "0",
  usdcStatus: "N/A",
  usdcAddress: "",
  soEurBalance: "1250.5",
  soEurThreshold: "500",
  soEurStatus: "OK",
  soEurAddress: "0xsoeur",
  needsTopUp: false,
};

describe("soEUR on a chain row", () => {
  it("is a tracked asset", () => {
    expect(WALLET_ASSETS).toContain("soEUR");
  });

  it("reads balance, threshold, status and token from the soEUR fields", () => {
    expect(readChainAsset(baseRow, "soEUR")).toEqual({
      asset: "soEUR",
      label: "soEUR",
      balance: "1250.5",
      threshold: "500",
      status: "OK",
      tokenAddress: "0xsoeur",
    });
  });

  it("is not monitored on a row that does not carry it", () => {
    const fuseRow: ChainBalance = {
      ...baseRow,
      chainId: 122,
      soEurBalance: undefined,
      soEurThreshold: undefined,
      soEurStatus: undefined,
      soEurAddress: undefined,
      soUsdBalance: "900",
      soUsdThreshold: "100",
      soUsdStatus: "OK",
    };

    expect(readChainAsset(fuseRow, "soEUR").status).toBe("N/A");
    expect(monitoredAssets(fuseRow).map((reading) => reading.asset)).toEqual(
      ["gas", "soUSD"]
    );
  });

  it("is listed with the other monitored assets, apart from soUSD", () => {
    expect(monitoredAssets(baseRow).map((reading) => reading.asset)).toEqual([
      "gas",
      "soEUR",
    ]);
  });
});
