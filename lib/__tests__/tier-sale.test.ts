import { describe, expect, it } from "vitest";

import {
  type TierPricing,
  tierPricingError,
  tierSaleOffers,
  tierSaleOffersLabel,
  tierSaleStatus,
  tierSaleStatusLabel,
} from "@/lib/tier-sale";

// The Black Friday sale: Fri Nov 27 – Mon Nov 30 inclusive, so the window
// closes at the start of Dec 1.
const blackFriday = (overrides: Partial<Record<keyof TierPricing, unknown>> = {}) =>
  ({
    primeAnnualUsd: 199,
    ultraAnnualUsd: 999,
    primeSaleUsd: 159,
    ultraSaleUsd: 799,
    saleStartsAt: "2026-11-27T00:00:00.000Z",
    saleEndsAt: "2026-12-01T00:00:00.000Z",
    ...overrides,
  }) as TierPricing;

const noSale = (overrides: Partial<Record<keyof TierPricing, unknown>> = {}) =>
  blackFriday({
    primeSaleUsd: -1,
    ultraSaleUsd: -1,
    saleStartsAt: null,
    saleEndsAt: null,
    ...overrides,
  });

describe("tierPricingError", () => {
  it("accepts the Black Friday sale", () => {
    expect(tierPricingError(blackFriday())).toBeNull();
  });

  it("accepts no sale at all, with no window", () => {
    expect(tierPricingError(noSale())).toBeNull();
    expect(tierPricingError(noSale({ ultraAnnualUsd: -1 }))).toBeNull();
  });

  it("accepts a sale on one tier only", () => {
    expect(tierPricingError(blackFriday({ ultraSaleUsd: -1 }))).toBeNull();
    expect(tierPricingError(blackFriday({ ultraSaleUsd: 0 }))).toBeNull();
  });

  it("refuses a blank list price rather than reading it as 0 (not for sale)", () => {
    expect(tierPricingError(noSale({ primeAnnualUsd: "" }))).toMatch(
      /Set the Prime Annual Charge/,
    );
    expect(tierPricingError(noSale({ ultraAnnualUsd: "" }))).toMatch(
      /Set the Ultra Annual Charge/,
    );
  });

  it("refuses a blank sale price", () => {
    expect(tierPricingError(blackFriday({ primeSaleUsd: "" }))).toMatch(
      /Set the Prime Sale Price/,
    );
    expect(tierPricingError(blackFriday({ ultraSaleUsd: "" }))).toMatch(
      /Set the Ultra Sale Price/,
    );
  });

  it("refuses a sale price at or above the list price", () => {
    expect(tierPricingError(blackFriday({ primeSaleUsd: 199 }))).toMatch(
      /Prime Sale Price \(\$199\) has to be below the Prime Annual Charge \(\$199\)/,
    );
    expect(tierPricingError(blackFriday({ ultraSaleUsd: 1200 }))).toMatch(
      /Ultra Sale Price/,
    );
  });

  it("refuses a sale price on a tier that is not sold for cash", () => {
    expect(
      tierPricingError(blackFriday({ ultraAnnualUsd: -1, ultraSaleUsd: 799 })),
    ).toMatch(/Ultra is not sold for cash/);
    expect(
      tierPricingError(blackFriday({ ultraAnnualUsd: 0, ultraSaleUsd: 799 })),
    ).toMatch(/Ultra is not sold for cash/);
  });

  it("needs both dates once any sale price is set", () => {
    expect(tierPricingError(blackFriday({ saleStartsAt: null }))).toMatch(
      /needs both Sale Starts and Sale Ends/,
    );
    expect(tierPricingError(blackFriday({ saleEndsAt: "" }))).toMatch(
      /needs both Sale Starts and Sale Ends/,
    );
  });

  it("needs the end after the start", () => {
    expect(
      tierPricingError(
        blackFriday({ saleEndsAt: "2026-11-27T00:00:00.000Z" }),
      ),
    ).toMatch(/Sale Ends has to be after Sale Starts/);
    expect(
      tierPricingError(
        noSale({
          saleStartsAt: "2026-12-01T00:00:00.000Z",
          saleEndsAt: "2026-11-27T00:00:00.000Z",
        }),
      ),
    ).toMatch(/Sale Ends has to be after Sale Starts/);
  });
});

describe("tierSaleOffers", () => {
  it("lists the tiers whose sale price would be charged", () => {
    expect(tierSaleOffers(blackFriday())).toEqual([
      { tier: "Prime", saleUsd: 159, listUsd: 199 },
      { tier: "Ultra", saleUsd: 799, listUsd: 999 },
    ]);
  });

  it("leaves out a tier with no sale, an invalid one, or no cash price", () => {
    expect(tierSaleOffers(blackFriday({ ultraSaleUsd: -1 }))).toEqual([
      { tier: "Prime", saleUsd: 159, listUsd: 199 },
    ]);
    expect(tierSaleOffers(blackFriday({ primeSaleUsd: 250 }))).toEqual([
      { tier: "Ultra", saleUsd: 799, listUsd: 999 },
    ]);
    expect(tierSaleOffers(blackFriday({ ultraAnnualUsd: -1 }))).toEqual([
      { tier: "Prime", saleUsd: 159, listUsd: 199 },
    ]);
    expect(tierSaleOffers(blackFriday({ primeSaleUsd: "" }))).toEqual([
      { tier: "Ultra", saleUsd: 799, listUsd: 999 },
    ]);
  });
});

describe("tierSaleStatus", () => {
  it.each([
    ["2026-11-26T23:59:59.000Z", "scheduled"],
    ["2026-11-27T00:00:00.000Z", "live"],
    ["2026-11-30T23:59:59.000Z", "live"],
    ["2026-12-01T00:00:00.000Z", "ended"],
  ])("at %s is %s", (at, expected) => {
    expect(tierSaleStatus(blackFriday(), Date.parse(at)).kind).toBe(expected);
  });

  it("is no sale without a tier on offer or without a well-formed window", () => {
    const at = Date.parse("2026-11-28T12:00:00.000Z");
    expect(tierSaleStatus(noSale(), at).kind).toBe("none");
    expect(
      tierSaleStatus(
        blackFriday({ primeSaleUsd: -1, ultraSaleUsd: -1 }),
        at,
      ).kind,
    ).toBe("none");
    expect(tierSaleStatus(blackFriday({ saleEndsAt: null }), at).kind).toBe(
      "none",
    );
    expect(
      tierSaleStatus(
        blackFriday({ saleEndsAt: "2026-11-26T00:00:00.000Z" }),
        at,
      ).kind,
    ).toBe("none");
  });
});

describe("labels", () => {
  it("reads the status in UTC", () => {
    const pricing = blackFriday();
    expect(
      tierSaleStatusLabel(
        tierSaleStatus(pricing, Date.parse("2026-11-20T00:00:00.000Z")),
      ),
    ).toBe("Scheduled: starts Nov 27, 2026, 00:00 UTC, ends Dec 1, 2026, 00:00 UTC");
    expect(
      tierSaleStatusLabel(
        tierSaleStatus(pricing, Date.parse("2026-11-28T00:00:00.000Z")),
      ),
    ).toBe("Live until Dec 1, 2026, 00:00 UTC");
    expect(
      tierSaleStatusLabel(
        tierSaleStatus(pricing, Date.parse("2026-12-02T00:00:00.000Z")),
      ),
    ).toBe("Ended Dec 1, 2026, 00:00 UTC");
    expect(tierSaleStatusLabel({ kind: "none" })).toBe("No sale");
  });

  it("spells out first year and renewal", () => {
    expect(tierSaleOffersLabel(tierSaleOffers(blackFriday()))).toBe(
      "Prime $159 first year, then $199/yr · Ultra $799 first year, then $999/yr",
    );
  });
});
