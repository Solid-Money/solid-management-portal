import { describe, expect, it, vi } from "vitest";
import {
  WALLET_ASSETS,
  assetCostPerDay,
  assetHistoryNote,
  assetOwedNow,
  assetReading,
  assetRefillPlan,
  assetRunwayDays,
  monitoredAssets,
  readChainAsset,
} from "@/lib/wallets";
import type {
  ChainBalance,
  WalletAssetFlow,
  WalletAssetPlan,
  WalletOwedNow,
  WalletRefillPlan,
} from "@/types";

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

describe("an asset's figures come from one read", () => {
  const owed: WalletOwedNow = {
    kind: "card-refunds",
    count: 1,
    amount: 8000,
    clearAmount: 0,
    failedCount: 0,
    unpricedCount: 0,
  };
  const refill = { refillAmount: 18000 } as WalletRefillPlan;
  // An older flow read, taken while a refund was still queued.
  const flow = {
    balance: "10000",
    owedNow: owed,
    plan: refill,
    daysOfRunway: 2,
  } as WalletAssetFlow;
  // The board-wide plan, read after the refund paid: nothing owed, no refill.
  const plan = { balance: "2000", verdict: "OK" } as WalletAssetPlan;

  it("does not fill a plan's empty fields from the flow", () => {
    expect(assetOwedNow(plan, flow)).toBeUndefined();
    expect(assetRefillPlan(plan, flow)).toBeUndefined();
    expect(assetRunwayDays(plan, flow)).toBeUndefined();
    expect(assetReading(plan, flow)?.balance).toBe("2000");
  });

  it("falls back to the flow only when there is no plan", () => {
    expect(assetOwedNow(undefined, flow)).toBe(owed);
    expect(assetRefillPlan(undefined, flow)).toBe(refill);
    expect(assetRunwayDays(undefined, flow)).toBe(2);
    expect(assetReading(undefined, flow)?.balance).toBe("10000");
  });
});

describe("an asset's daily cost", () => {
  const flow = {
    realCostPerDay: 1000,
    outflowPerDay: 400,
    isFloat: false,
  } as WalletAssetFlow;

  it("is the plan's, and a plan with none quotes none", () => {
    // History too short for a cost: the runway says "not draining", so an
    // older flow's cost or outflow must not appear beside it.
    const plan = { snapshotCount: 3, isFloat: false } as WalletAssetPlan;
    expect(assetCostPerDay(plan, flow)).toEqual({
      measured: undefined,
      estimate: undefined,
      isFloat: false,
    });
    expect(
      assetCostPerDay({ ...plan, realCostPerDay: 27 } as WalletAssetPlan, flow)
        .measured
    ).toBe(27);
  });

  it("comes from the flow only when there is no plan", () => {
    expect(assetCostPerDay(undefined, flow).measured).toBe(1000);
    const unmeasured = { ...flow, realCostPerDay: undefined };
    expect(assetCostPerDay(undefined, unmeasured).estimate).toBe(400);
    // On a float, outflow is a user's money leaving: never a cost estimate.
    expect(
      assetCostPerDay(undefined, { ...unmeasured, isFloat: true }).estimate,
    ).toBeUndefined();
  });
});

describe("an asset whose transfer history is incomplete", () => {
  // The Cashback Payout Wallet's Base soUSD while its top-ups were still
  // being read in: no cost measured, judged against the configured 1,000.
  const note =
    "Top-ups on Base are only on record since 2026-11-22 09:00 UTC while " +
    "the rest of the history is read in, so no cost per day is measured " +
    "from them: a top-up missing from the history would read as money spent.";
  const plan = {
    snapshotCount: 140,
    transferHistory: { complete: false, note },
  } as WalletAssetPlan;

  it("says why, from the same read as the verdict", () => {
    expect(assetHistoryNote(plan)).toBe(note);
  });

  it("says nothing when the history is complete or not reported", () => {
    expect(
      assetHistoryNote({
        ...plan,
        transferHistory: { complete: true },
      } as WalletAssetPlan),
    ).toBeUndefined();
    // A backend from before the field existed.
    expect(
      assetHistoryNote({ snapshotCount: 140 } as WalletAssetPlan),
    ).toBeUndefined();
  });

  it("does not borrow an older flow's gap beside a plan that has none", () => {
    const flow = {
      transferHistory: { complete: false, note: "older read" },
    } as WalletAssetFlow;
    expect(
      assetHistoryNote({ snapshotCount: 140 } as WalletAssetPlan, flow),
    ).toBeUndefined();
    expect(assetHistoryNote(undefined, flow)).toBe("older read");
  });
});
