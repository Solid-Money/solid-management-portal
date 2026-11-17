import { describe, expect, it } from "vitest";
import { lifetimeCashbackValue } from "@/lib/lifetime-cashback";

describe("lifetimeCashbackValue", () => {
  it("shows a dollar cardholder's lifetime on its own", () => {
    expect(
      lifetimeCashbackValue({ cashbackLifetime: 150, cashbackLifetimeEur: 0 })
    ).toBe("$150.00");
  });

  it("shows euros beside dollars, never summed", () => {
    expect(
      lifetimeCashbackValue({ cashbackLifetime: 150, cashbackLifetimeEur: 21.5 })
    ).toBe("$150.00 + €21.50");
  });

  it("keeps euros earned before a switch to dollars", () => {
    // Whatever the currency now, the euro lifetime is reported and shown.
    expect(
      lifetimeCashbackValue({ cashbackLifetime: 12, cashbackLifetimeEur: 20 })
    ).toBe("$12.00 + €20.00");
  });

  it("shows euros alone for a euro cardholder who never earned dollars", () => {
    expect(
      lifetimeCashbackValue({ cashbackLifetime: 0, cashbackLifetimeEur: 21.5 })
    ).toBe("€21.50");
  });

  it("hides the stat when either total is missing", () => {
    // An older backend, or a total it couldn't read — not zero.
    expect(lifetimeCashbackValue({})).toBeUndefined();
    expect(
      lifetimeCashbackValue({ cashbackLifetimeEur: 21.5 })
    ).toBeUndefined();
    expect(lifetimeCashbackValue({ cashbackLifetime: 150 })).toBeUndefined();
  });
});
