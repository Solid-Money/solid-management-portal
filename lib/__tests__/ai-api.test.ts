import { describe, expect, it } from "vitest";
import {
  autoPriceStatus,
  formatFirstToken,
  formatRates,
  formatTokensPerSecond,
  NEAR_LIMIT_PERCENT,
  netMultiple,
  usedPercent,
} from "@/lib/ai-api";

describe("AI API formatting", () => {
  it.each([
    [85, "85 tok/s"],
    [84.6, "85 tok/s"],
    [1_240.2, "1,240 tok/s"],
    [null, "—"],
    [undefined, "—"],
    [Number.NaN, "—"],
  ])("formatTokensPerSecond(%s) = %s", (value, text) => {
    expect(formatTokensPerSecond(value)).toBe(text);
  });

  it.each([
    [1_200, "1.2 s"],
    [1_249, "1.2 s"],
    [350, "0.4 s"],
    [12_000, "12.0 s"],
    [null, "—"],
    [undefined, "—"],
  ])("formatFirstToken(%s) = %s", (ms, text) => {
    expect(formatFirstToken(ms)).toBe(text);
  });

  it.each([
    [0.82, 82],
    [0.29, 29],
    [0.796, 80],
    [1, 100],
    [0, 0],
    [Number.NaN, 0],
  ])("usedPercent(%s) = %s", (share, percent) => {
    expect(usedPercent(share)).toBe(percent);
  });

  it("flags a key from 80% of its limit", () => {
    expect(usedPercent(0.8) >= NEAR_LIMIT_PERCENT).toBe(true);
    expect(usedPercent(0.79) >= NEAR_LIMIT_PERCENT).toBe(false);
  });
});

describe("AI API pricing from AntSeed", () => {
  const reference = {
    inputUsdPerMTok: 0.02,
    outputUsdPerMTok: 0.15,
    cachedInputUsdPerMTok: 0.01,
    sellers: 3,
  };
  const prices = {
    inputUsdPerMTok: 0.08,
    outputUsdPerMTok: 0.6,
    cachedInputUsdPerMTok: 0.04,
  };

  it("writes three rates on one line", () => {
    expect(formatRates(prices)).toBe("in $0.08 · out $0.6 · cached $0.04");
  });

  it.each([
    [4, [0.5, 0.5, 0.5], 2],
    [3, [0.25, 0.5], 1.5],
    [1.5, [0.5], 0.75],
    [4, [], 4],
  ])("nets %s× after the top of %j cashback as %s×", (markup, rates, net) => {
    expect(netMultiple(markup, rates)).toBe(net);
  });

  it("says what users pay and AntSeed's typical rate", () => {
    const { text, warn } = autoPriceStatus(
      { upstreamModel: "glm-5.3", listed: true, reference, prices },
      "GLM-5.3",
      true,
    );
    expect(warn).toBe(false);
    expect(text).toContain("Users pay in $0.08 · out $0.6 · cached $0.04.");
    expect(text).toContain(
      "AntSeed's typical rate: in $0.02 · out $0.15 · cached $0.01, across 3 sellers.",
    );
  });

  it("says the fixed prices apply until it is saved or read", () => {
    expect(autoPriceStatus(undefined, "glm-5.3", true).text).toMatch(
      /fixed prices above apply until its rates are read/,
    );
    expect(
      autoPriceStatus(
        { upstreamModel: "glm-5.3", listed: true, reference, prices },
        "glm-5.3-air",
        true,
      ).text,
    ).toMatch(/as soon as this is saved/);
  });

  it("warns when AntSeed stopped listing it", () => {
    const { text, warn } = autoPriceStatus(
      { upstreamModel: "glm-5.3", listed: false, reference, prices },
      "glm-5.3",
      true,
    );
    expect(warn).toBe(true);
    expect(text).toMatch(/keeps its last price/);
  });

  it("says a model AntSeed only sells for free keeps its last price", () => {
    const free = { ...reference, inputUsdPerMTok: 0, outputUsdPerMTok: 0, cachedInputUsdPerMTok: 0, sellers: 0 };
    expect(
      autoPriceStatus(
        { upstreamModel: "glm-5.3", listed: true, reference: free, prices },
        "glm-5.3",
        true,
      ).text,
    ).toMatch(/gives it away right now, so it keeps its last price/);
  });
});
