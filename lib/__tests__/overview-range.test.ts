import { describe, expect, it } from "vitest";
import {
  isLatestWeek,
  matchPreset,
  parseRange,
  presetRange,
  rangeError,
  rangeQuery,
  rangeSentence,
  spanLabel,
} from "@/lib/overview-range";

const TODAY = "2026-11-02";
const params = (query: string) => new URLSearchParams(query);

describe("presetRange", () => {
  it.each([
    ["today", "2026-11-02", "2026-11-02"],
    ["yesterday", "2026-11-01", "2026-11-01"],
    ["last7", "2026-10-26", "2026-11-01"],
    ["last30", "2026-10-03", "2026-11-01"],
    ["last90", "2026-08-04", "2026-11-01"],
    ["thisMonth", "2026-11-01", "2026-11-02"],
    ["lastMonth", "2026-10-01", "2026-10-31"],
  ] as const)("%s → %s … %s", (preset, from, to) => {
    expect(presetRange(preset, TODAY)).toEqual({ from, to });
  });

  it("handles last month across a year boundary", () => {
    expect(presetRange("lastMonth", "2027-01-15")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });
});

describe("parseRange", () => {
  it("defaults to the last 7 full days with compare on", () => {
    expect(parseRange(params(""), TODAY)).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
      preset: "last7",
      compare: true,
    });
  });

  it("keeps a custom range from the URL and recognises presets", () => {
    expect(parseRange(params("from=2026-10-10&to=2026-10-20"), TODAY)).toMatchObject({
      preset: "custom",
      from: "2026-10-10",
    });
    expect(parseRange(params("from=2026-10-01&to=2026-10-31"), TODAY).preset).toBe(
      "lastMonth",
    );
  });

  it("pulls a future end back to today", () => {
    expect(parseRange(params("from=2026-10-30&to=2026-12-01"), TODAY)).toMatchObject({
      from: "2026-10-30",
      to: "2026-11-02",
    });
  });

  it.each(["from=2026-11-05&to=2026-11-06", "from=2025-01-01&to=2026-11-01", "from=2026-02-30&to=2026-03-01", "from=x&to=y"])(
    "falls back to the default for %s",
    (query) => {
      expect(parseRange(params(query), TODAY)).toMatchObject({ preset: "last7" });
    },
  );

  it("reads compare=0", () => {
    expect(parseRange(params("compare=0"), TODAY).compare).toBe(false);
  });
});

describe("rangeQuery", () => {
  it("writes nothing for the default and round-trips anything else", () => {
    expect(rangeQuery({ from: "2026-10-26", to: "2026-11-01", preset: "last7", compare: true }, TODAY)).toBe("");
    const state = { from: "2026-10-10", to: "2026-10-20", preset: "custom" as const, compare: false };
    expect(parseRange(params(rangeQuery(state, TODAY)), TODAY)).toEqual(state);
  });
});

describe("labels", () => {
  it("says what the header says", () => {
    expect(
      rangeSentence({ from: "2026-10-26", to: "2026-11-01", preset: "last7", compare: true }, TODAY),
    ).toBe("Last 7 days, Oct 26 – Nov 1 (UTC), compared with the 7 days before");
    expect(spanLabel("2025-12-30", "2026-01-02", TODAY)).toBe("Dec 30, 2025 – Jan 2");
  });

  it("explains why a range cannot be applied", () => {
    expect(rangeError("2026-11-01", "2026-10-01", TODAY)).toMatch(/on or before/);
    expect(rangeError("2025-01-01", "2026-11-01", TODAY)).toMatch(/365/);
    expect(rangeError("2025-11-02", "2026-11-01", TODAY)).toBeNull();
    expect(matchPreset("2026-11-02", "2026-11-02", TODAY)).toBe("today");
  });
});

describe("isLatestWeek", () => {
  it("is true only for the seven days ending yesterday or today", () => {
    // Last 7 days: ends yesterday, and the charts run to today.
    expect(isLatestWeek({ days: 7, chartTo: TODAY, today: TODAY })).toBe(true);
    // Any other seven days, such as a week last year.
    expect(isLatestWeek({ days: 7, chartTo: "2025-01-07", today: TODAY })).toBe(false);
    expect(isLatestWeek({ days: 30, chartTo: TODAY, today: TODAY })).toBe(false);
  });
});
