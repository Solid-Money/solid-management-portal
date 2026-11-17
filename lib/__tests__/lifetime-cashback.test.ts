import { describe, expect, it } from "vitest";
import { lifetimeCashbackValue } from "@/lib/lifetime-cashback";

const eurBlock = (cashbackLifetime?: number) => ({
  cashbackThisMonth: 4,
  cashbackPendingThisMonth: 1,
  cashbackLastMonth: 6.5,
  maxCashbackMonthly: 40,
  cashbackCapThisMonth: 40,
  cashbackHeadroomThisMonth: 35,
  ...(cashbackLifetime !== undefined && { cashbackLifetime }),
});

describe("lifetimeCashbackValue", () => {
  it("shows a dollar cardholder's lifetime on its own", () => {
    expect(lifetimeCashbackValue({ cashbackLifetime: 150 })).toBe("$150.00");
  });

  it("shows a euro cardholder's euros beside their dollars, never summed", () => {
    expect(
      lifetimeCashbackValue({
        cashbackLifetime: 150,
        cashbackEur: eurBlock(21.5),
      })
    ).toBe("$150.00 + €21.50");
  });

  it("shows euros alone for a euro cardholder who never earned dollars", () => {
    expect(
      lifetimeCashbackValue({ cashbackLifetime: 0, cashbackEur: eurBlock(21.5) })
    ).toBe("€21.50");
  });

  it("hides the stat when the dollar total is missing", () => {
    // An older backend, or a paid total it couldn't read — not zero dollars.
    expect(lifetimeCashbackValue({})).toBeUndefined();
    expect(
      lifetimeCashbackValue({ cashbackEur: eurBlock(21.5) })
    ).toBeUndefined();
  });

  it("hides the stat when the euro lane is reported without its total", () => {
    expect(
      lifetimeCashbackValue({ cashbackLifetime: 150, cashbackEur: eurBlock() })
    ).toBeUndefined();
  });
});
