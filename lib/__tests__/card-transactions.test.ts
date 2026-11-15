import { describe, expect, it } from "vitest";
import {
  cashbackCurrencyOf,
  cashbackPayoutLink,
  formatCashbackAmount,
  formatCashbackMoney,
  formatCashbackTotals,
  sumByCashbackCurrency,
} from "@/lib/card-transactions";

describe("cashbackCurrencyOf", () => {
  it("reads a row with no currency as USD", () => {
    expect(cashbackCurrencyOf({})).toBe("USD");
    expect(cashbackCurrencyOf(undefined)).toBe("USD");
    expect(cashbackCurrencyOf({ currency: null })).toBe("USD");
  });

  it("reads EUR only for EUR", () => {
    expect(cashbackCurrencyOf({ currency: "EUR" })).toBe("EUR");
    expect(cashbackCurrencyOf({ currency: "USD" })).toBe("USD");
    expect(cashbackCurrencyOf({ currency: "GBP" })).toBe("USD");
  });
});

describe("formatCashbackAmount", () => {
  it("shows a USD row in soUSD and dollars, as before", () => {
    expect(
      formatCashbackAmount({ soUsdAmount: "1.5", soUsdRate: "1.02" })
    ).toEqual({ amount: "1.5000 soUSD", value: "$1.53" });
  });

  it("still shows a historical FUSE payout", () => {
    expect(
      formatCashbackAmount({ fuseAmount: "100", fuseUsdPrice: "0.02" })
    ).toEqual({ amount: "100.0000 FUSE", value: "$2.00" });
  });

  it("shows a EUR row in soEUR, worth soEurAmount * soEurRate euros", () => {
    expect(
      formatCashbackAmount({
        currency: "EUR",
        soEurAmount: "2.000000",
        soEurRate: "1.05",
      })
    ).toEqual({ amount: "2.0000 soEUR", value: "€2.10" });
  });

  it("shows the soEUR the transfer moved, not the pre-debt payout", () => {
    // 2 soEUR earned, 1 collected against a debt, 1 sent.
    expect(
      formatCashbackAmount({
        currency: "EUR",
        soEurAmount: "2",
        sentSoEurAmount: "1",
        soEurRate: "1.05",
      })
    ).toEqual({ amount: "1.0000 soEUR", value: "€1.05" });
  });

  it("keeps a stored zero transfer as zero", () => {
    expect(
      formatCashbackAmount({
        currency: "EUR",
        soEurAmount: "2",
        sentSoEurAmount: "0",
        soEurRate: "1.05",
      })
    ).toEqual({ amount: "0.0000 soEUR", value: "€0.00" });
  });

  it("never reads a EUR row's figure as dollars", () => {
    // A stray soUSD field on a EUR row must not turn it into a dollar payout.
    expect(
      formatCashbackAmount({
        currency: "EUR",
        soUsdAmount: "3",
        soUsdRate: "1",
      })
    ).toBeNull();
  });

  it("leaves the value out when a EUR row has no rate", () => {
    expect(
      formatCashbackAmount({ currency: "EUR", soEurAmount: "2" })
    ).toEqual({ amount: "2.0000 soEUR", value: null });
  });

  it("is null for an unpaid row", () => {
    expect(formatCashbackAmount({ currency: "EUR" })).toBeNull();
    expect(formatCashbackAmount({})).toBeNull();
    expect(formatCashbackAmount(undefined)).toBeNull();
  });
});

describe("cashbackPayoutLink", () => {
  it("links a soEUR payout on Base to Basescan", () => {
    expect(
      cashbackPayoutLink({ payoutTxHash: "0xabc", payoutChainId: 8453 })
    ).toEqual({
      href: "https://basescan.org/tx/0xabc",
      title: "View payout on Basescan",
    });
  });

  it("links any other payout to the Fuse explorer", () => {
    expect(cashbackPayoutLink({ payoutTxHash: "0xdef" })).toEqual({
      href: "https://explorer.fuse.io/tx/0xdef",
      title: "View payout on Fuse explorer",
    });
  });

  it("has no link for a payout deducted from a debt, or none at all", () => {
    expect(
      cashbackPayoutLink({
        payoutTxHash: "DEDUCTED_FROM_DEBT",
        payoutChainId: 8453,
      })
    ).toBeNull();
    expect(cashbackPayoutLink({})).toBeNull();
    expect(cashbackPayoutLink(undefined)).toBeNull();
  });
});

describe("formatCashbackMoney", () => {
  it("shows each currency in its own symbol", () => {
    expect(formatCashbackMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatCashbackMoney(1234.5, "EUR")).toBe("€1,234.50");
  });
});

describe("formatCashbackTotals", () => {
  it("reads a dollar-only total exactly as before", () => {
    expect(formatCashbackTotals(150, 0)).toBe("$150.00");
    expect(formatCashbackTotals(0, 0)).toBe("$0.00");
  });

  it("shows euros alone when there are no dollars", () => {
    expect(formatCashbackTotals(0, 12.4)).toBe("€12.40");
  });

  it("puts the two side by side, never summed", () => {
    expect(formatCashbackTotals(150, 12.4)).toBe("$150.00 + €12.40");
  });
});

describe("sumByCashbackCurrency", () => {
  it("keeps euro rows out of the dollar sum", () => {
    const rows = [
      { owed: 10 },
      { currency: "USD", owed: 5 },
      { currency: "EUR", owed: 7 },
      { currency: "EUR", owed: null },
      { owed: undefined },
    ];

    expect(sumByCashbackCurrency(rows, (row) => row.owed)).toEqual({
      usd: 15,
      eur: 7,
    });
  });
});
