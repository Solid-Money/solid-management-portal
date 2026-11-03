import { describe, expect, it } from "vitest";
import {
  axisUsd,
  change,
  niceCeil,
  compactUsd,
  formatDuration,
  formatRatio,
  intentLabel,
} from "@/lib/overview-format";

describe("overview formatting", () => {
  it.each([
    [834, "$834"],
    [5_528.9, "$5.5K"],
    [151_600, "$151.6K"],
    [999_960, "$1.0M"],
    [1_240_000, "$1.2M"],
    [Number.NaN, "$0"],
  ])("compactUsd(%d) = %s", (value, text) => {
    expect(compactUsd(value)).toBe(text);
  });

  it("shows change against the previous period, or nothing to compare", () => {
    expect(change(151_600, 130_400)).toMatchObject({ text: "▲ 16%", tone: "up" });
    expect(change(359, 421)).toMatchObject({ text: "▼ 15%", tone: "down" });
    expect(change(834, 293).text).toBe("▲ 185%");
    expect(change(5, 0)).toEqual({ ratio: null, text: null, tone: "flat" });
    expect(change(1000, 1001).text).toBe("0%");
  });

  it("formats ratios, waits and intents", () => {
    expect(formatRatio(0.4286)).toBe("43%");
    expect(formatRatio(0.4353)).toBe("44%");
    expect(formatRatio(null)).toBe("—");
    expect(formatDuration(14)).toBe("14 s");
    expect(formatDuration(600)).toBe("10 min");
    expect(formatDuration(9_000)).toBe("2.5 h");
    expect(intentLabel("card_declined")).toBe("Card declined");
    expect(intentLabel("kyc")).toBe("KYC");
  });

  it("keeps axis ticks round", () => {
    expect(axisUsd(15_000)).toBe("$15K");
    expect(axisUsd(9_000)).toBe("$9K");
    expect(axisUsd(4_500)).toBe("$4.5K");
    expect(niceCeil(44_400)).toBe(50_000);
    expect(niceCeil(36_000)).toBe(50_000);
    expect(niceCeil(24_000)).toBe(25_000);
  });
});
