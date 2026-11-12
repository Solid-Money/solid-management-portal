import { describe, expect, it } from "vitest";

import {
  feePromotionChanges,
  feePromotionDraftError,
  feePromotionStatus,
  freeDepositsLabel,
  nextStatusChange,
  windowInstant,
} from "@/lib/fee-promotions";

const NOW = Date.parse("2026-11-20T12:00:00.000Z");

const draft = (overrides: Partial<Parameters<typeof feePromotionDraftError>[0]> = {}) => ({
  name: "Free SEPA deposits",
  enabled: true,
  startsAt: "2026-11-15T00:00:00.000Z",
  endsAt: "2027-01-01T00:00:00.000Z",
  freeCountPerUser: "3",
  ...overrides,
});

describe("feePromotionStatus", () => {
  const window = {
    enabled: true,
    startsAt: "2026-12-01T00:00:00.000Z",
    endsAt: "2027-01-01T00:00:00.000Z",
  };

  it.each([
    ["2026-11-30T23:59:59.000Z", "scheduled"],
    ["2026-12-01T00:00:00.000Z", "live"],
    ["2026-12-31T23:59:59.000Z", "live"],
    ["2027-01-01T00:00:00.000Z", "ended"],
  ])("at %s is %s", (at, expected) => {
    expect(feePromotionStatus(window, Date.parse(at))).toBe(expected);
  });

  it("is off whenever it is switched off", () => {
    expect(feePromotionStatus({ ...window, enabled: false }, NOW)).toBe("disabled");
  });
});

describe("feePromotionDraftError", () => {
  it("accepts the campaign as briefed", () => {
    expect(feePromotionDraftError(draft(), undefined, NOW)).toBeNull();
  });

  it.each([
    [{ name: "  " }, /name/],
    [{ freeCountPerUser: "0" }, /1 to 50/],
    [{ freeCountPerUser: "51" }, /1 to 50/],
    [{ freeCountPerUser: "2.5" }, /1 to 50/],
    [{ freeCountPerUser: "" }, /1 to 50/],
    [{ startsAt: null }, /both the start and the end/],
    [{ endsAt: "2026-11-15T00:00:00.000Z" }, /end has to be after the start/],
    [{ endsAt: "2027-12-31T00:00:00.000Z" }, /at most 366 days/],
  ])("refuses %o", (override, message) => {
    expect(feePromotionDraftError(draft(override), undefined, NOW)).toMatch(message);
  });

  it("refuses to switch on a window that has ended, but lets it be saved off", () => {
    const ended = { startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z" };
    expect(feePromotionDraftError(draft(ended), undefined, NOW)).toMatch(/already ended/);
    expect(feePromotionDraftError(draft({ ...ended, enabled: false }), undefined, NOW)).toBeNull();
  });

  describe("on a promotion left on past its end", () => {
    const ended = { startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z" };
    const current = { enabled: true, endsAt: ended.endsAt };

    it("still lets it be renamed or recounted, as the backend does", () => {
      expect(
        feePromotionDraftError(draft({ ...ended, name: "Renamed", freeCountPerUser: "5" }), undefined, NOW, current),
      ).toBeNull();
    });

    it("refuses moving its end to another moment already past", () => {
      expect(
        feePromotionDraftError(draft({ ...ended, endsAt: "2026-11-02T00:00:00.000Z" }), undefined, NOW, current),
      ).toMatch(/already passed/);
    });

    it("refuses switching one on that was off", () => {
      expect(
        feePromotionDraftError(draft(ended), undefined, NOW, { ...current, enabled: false }),
      ).toMatch(/already ended/);
    });
  });

  it("uses the limits the backend sent", () => {
    expect(
      feePromotionDraftError(draft({ freeCountPerUser: "6" }), { maxFreeCountPerUser: 5, maxDays: 366 }, NOW),
    ).toMatch(/1 to 5/);
  });
});

describe("feePromotionChanges", () => {
  const current = {
    name: "Free SEPA deposits",
    enabled: false,
    startsAt: "2026-11-15T00:00:00.000Z",
    endsAt: "2027-01-01T00:00:00.000Z",
    freeCountPerUser: 3,
  };

  it("sends only what changed", () => {
    expect(feePromotionChanges(current, draft({ enabled: true }))).toEqual({ enabled: true });
  });

  it("sends nothing when nothing changed", () => {
    expect(feePromotionChanges(current, draft({ enabled: false }))).toEqual({});
  });

  it("compares instants, not strings", () => {
    expect(
      feePromotionChanges(current, draft({ enabled: false, startsAt: "2026-11-15T00:00:00Z" })),
    ).toEqual({});
  });

  it("sends a new count as a number", () => {
    expect(feePromotionChanges(current, draft({ enabled: false, freeCountPerUser: "5" }))).toEqual({
      freeCountPerUser: 5,
    });
  });
});

describe("freeDepositsLabel", () => {
  it("counts", () => {
    expect(freeDepositsLabel(1)).toBe("1 free deposit");
    expect(freeDepositsLabel(3)).toBe("3 free deposits");
  });
});

describe("windowInstant", () => {
  const stored = "2026-11-15T12:00:30.000Z";

  it("keeps a stored instant with seconds while its minute is untouched", () => {
    expect(windowInstant("2026-11-15T12:00", stored)).toBe(stored);
  });

  it("reads an edited input as typed, in UTC", () => {
    expect(windowInstant("2026-11-15T13:00", stored)).toBe("2026-11-15T13:00:00.000Z");
  });

  it("reads a new promotion's input, and nothing for an empty one", () => {
    expect(windowInstant("2026-11-15T12:00")).toBe("2026-11-15T12:00:00.000Z");
    expect(windowInstant("", stored)).toBeNull();
  });

  it("leaves an untouched window out of the change set", () => {
    const current = {
      name: "Free SEPA deposits",
      enabled: true,
      startsAt: stored,
      endsAt: "2027-01-01T00:00:45.000Z",
      freeCountPerUser: 3,
    };
    expect(
      feePromotionChanges(current, {
        name: "Renamed",
        enabled: true,
        startsAt: windowInstant("2026-11-15T12:00", current.startsAt),
        endsAt: windowInstant("2027-01-01T00:00", current.endsAt),
        freeCountPerUser: "3",
      }),
    ).toEqual({ name: "Renamed" });
  });
});

describe("nextStatusChange", () => {
  const on = (startsAt: string, endsAt: string) => ({ enabled: true, startsAt, endsAt });

  it("is the nearest start or end still ahead", () => {
    expect(
      nextStatusChange(
        [
          on("2026-11-15T00:00:00.000Z", "2027-01-01T00:00:00.000Z"),
          on("2026-12-01T00:00:00.000Z", "2026-12-02T00:00:00.000Z"),
        ],
        NOW,
      ),
    ).toBe(Date.parse("2026-12-01T00:00:00.000Z"));
  });

  it("ignores promotions that are off, and is null once every window is past", () => {
    expect(
      nextStatusChange(
        [
          { ...on("2026-12-01T00:00:00.000Z", "2026-12-02T00:00:00.000Z"), enabled: false },
          on("2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z"),
        ],
        NOW,
      ),
    ).toBeNull();
  });
});
