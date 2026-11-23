import { describe, expect, it } from "vitest";

import {
  formatSepaUsd,
  isValidPerkCode,
  kolPerkChanges,
  kolPerkCreateBody,
  kolPerkDraftError,
  kolReferralLinks,
  normalizeKolUsername,
  normalizePerkCode,
  perkBenefitsLabel,
  signupsLabel,
  type KolPerkDraft,
} from "@/lib/kols";
import type { KolPerk } from "@/types/kols";

const NOW = Date.parse("2026-11-23T12:00:00.000Z");

const draft = (overrides: Partial<KolPerkDraft> = {}): KolPerkDraft => ({
  name: "Artem — December",
  code: "ARTEM50",
  enabled: true,
  startsAt: "2026-11-23T00:00:00.000Z",
  endsAt: "2026-12-23T00:00:00.000Z",
  tierDiscountPct: "50",
  sepaFreeMonths: "1",
  sepaFreeCapUsd: "10000",
  maxSignups: "",
  ...overrides,
});

const perk = (overrides: Partial<KolPerk> = {}): KolPerk => ({
  id: "perk1",
  name: "Artem — December",
  code: "ARTEM50",
  kolId: "kol1",
  kolUsername: "artem.betev",
  enabled: true,
  status: "live",
  startsAt: "2026-11-23T00:00:00.000Z",
  endsAt: "2026-12-23T00:00:00.000Z",
  tierDiscountPct: 50,
  sepaFreeMonths: 1,
  sepaFreeCapUsd: 10000,
  maxSignups: null,
  version: 3,
  stats: {
    granted: 0,
    ineligible: 0,
    tierDiscountsClaimed: 0,
    tierDiscountsPaid: 0,
    sepaDeposits: 0,
    sepaCoveredUsd: 0,
    sepaWaivedFeeUsd: 0,
  },
  ...overrides,
});

describe("kolPerkDraftError", () => {
  it("accepts a complete draft", () => {
    expect(kolPerkDraftError(draft(), undefined, NOW)).toBeNull();
  });

  it("allows an empty code on create (one is generated), not on edit", () => {
    expect(kolPerkDraftError(draft({ code: "" }), undefined, NOW)).toBeNull();
    expect(kolPerkDraftError(draft({ code: "" }), undefined, NOW, perk())).toMatch(
      /code/,
    );
  });

  it.each([
    [{ name: "  " }, /name/],
    [{ code: "INUZB" }, /code/],
    [{ code: "ART-50" }, /code/],
    [{ endsAt: "2026-11-22T00:00:00.000Z" }, /after the start/],
    [{ endsAt: "2028-01-01T00:00:00.000Z" }, /at most 366 days/],
    [{ tierDiscountPct: "95" }, /at most 90%/],
    [{ tierDiscountPct: "12.5" }, /whole percentage/],
    [{ sepaFreeMonths: "13" }, /at most 12 months/],
    [{ sepaFreeCapUsd: "0" }, /cap above \$0/],
    [{ sepaFreeCapUsd: "10.001" }, /cap above \$0/],
    [{ tierDiscountPct: "0", sepaFreeMonths: "0" }, /discount, free SEPA/],
    [{ maxSignups: "0" }, /signup limit/],
  ])("refuses %o", (overrides, message) => {
    expect(kolPerkDraftError(draft(overrides), undefined, NOW)).toMatch(message);
  });

  it("accepts any cap to the cent, without float rounding", () => {
    expect(kolPerkDraftError(draft({ sepaFreeCapUsd: "0.29" }), undefined, NOW)).toBeNull();
    expect(kolPerkDraftError(draft({ sepaFreeCapUsd: "1.25" }), undefined, NOW)).toBeNull();
    expect(kolPerkDraftError(draft({ sepaFreeCapUsd: "1e-7" }), undefined, NOW)).toMatch(
      /cap above \$0/,
    );
  });

  it("ignores the cap when there are no free SEPA months", () => {
    expect(
      kolPerkDraftError(
        draft({ sepaFreeMonths: "0", sepaFreeCapUsd: "" }),
        undefined,
        NOW,
      ),
    ).toBeNull();
  });

  it("refuses switching on a perk that has ended, but allows other edits to it", () => {
    const ended = { endsAt: "2026-11-01T00:00:00.000Z", startsAt: "2026-10-01T00:00:00.000Z" };
    expect(kolPerkDraftError(draft(ended), undefined, NOW)).toMatch(/already ended/);
    expect(
      kolPerkDraftError(
        draft({ ...ended, name: "Renamed" }),
        undefined,
        NOW,
        perk({ ...ended, enabled: true }),
      ),
    ).toBeNull();
  });
});

describe("kolPerkCreateBody", () => {
  it("normalises the code and sends no cap without free months", () => {
    expect(
      kolPerkCreateBody(
        draft({ code: " artem50 ", sepaFreeMonths: "0", maxSignups: "500" }),
        "kol1",
      ),
    ).toEqual({
      name: "Artem — December",
      code: "ARTEM50",
      enabled: true,
      startsAt: "2026-11-23T00:00:00.000Z",
      endsAt: "2026-12-23T00:00:00.000Z",
      tierDiscountPct: 50,
      sepaFreeMonths: 0,
      sepaFreeCapUsd: 0,
      maxSignups: 500,
      kolId: "kol1",
    });
  });

  it("leaves the code out when empty, to have one generated", () => {
    expect(kolPerkCreateBody(draft({ code: "" }))).not.toHaveProperty("code");
  });
});

describe("kolPerkChanges", () => {
  it("sends only what changed", () => {
    expect(kolPerkChanges(perk(), draft())).toEqual({});
    expect(
      kolPerkChanges(
        perk(),
        draft({ tierDiscountPct: "40", enabled: false, maxSignups: "1000" }),
      ),
    ).toEqual({ tierDiscountPct: 40, enabled: false, maxSignups: 1000 });
  });

  it("clears the signup limit with null", () => {
    expect(kolPerkChanges(perk({ maxSignups: 100 }), draft())).toEqual({
      maxSignups: null,
    });
  });
});

describe("helpers", () => {
  it("builds both referral links", () => {
    const links = kolReferralLinks("ARTEM50");
    expect(links.website).toMatch(/\/refer\?ref=ARTEM50$/);
    expect(links.app).toMatch(/\/invite\/ARTEM50$/);
  });

  it("labels benefits", () => {
    expect(perkBenefitsLabel(perk())).toBe(
      "50% off first year · 1 month free SEPA (up to $10,000)",
    );
    expect(perkBenefitsLabel(perk({ sepaFreeMonths: 0 }))).toBe("50% off first year");
    expect(perkBenefitsLabel(perk({ tierDiscountPct: 0, sepaFreeMonths: 3 }))).toBe(
      "3 months free SEPA (up to $10,000)",
    );
  });

  it("keeps the cents of a free SEPA amount only when it has them", () => {
    expect(formatSepaUsd(10000)).toBe("$10,000");
    expect(formatSepaUsd(0.29)).toBe("$0.29");
    expect(formatSepaUsd(1234.5)).toBe("$1,234.50");
    expect(perkBenefitsLabel(perk({ sepaFreeCapUsd: 0.29 }))).toBe(
      "50% off first year · 1 month free SEPA (up to $0.29)",
    );
  });

  it("formats codes, usernames and signups", () => {
    expect(normalizePerkCode(" artem50 ")).toBe("ARTEM50");
    expect(isValidPerkCode("ARTEM50")).toBe(true);
    expect(isValidPerkCode("ART50")).toBe(false);
    expect(normalizeKolUsername(" @Artem.Betev ")).toBe("artem.betev");
    expect(signupsLabel(12, null)).toBe("12");
    expect(signupsLabel(12, 500)).toBe("12 / 500");
  });
});
