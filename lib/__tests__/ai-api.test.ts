import { describe, expect, it } from "vitest";
import {
  walletShortLabel,
  autoPriceStatus,
  formatFirstToken,
  formatRates,
  formatTokensPerSecond,
  isFreeModelPrices,
  isFreeModelRow,
  lowestNetAtReference,
  modelSaveEffects,
  NEAR_LIMIT_PERCENT,
  netMultiple,
  sameUpstream,
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

describe("free models", () => {
  const prices = (input: string, output: string, cachedInput = "", cacheWrite = "") => ({
    input,
    output,
    cachedInput,
    cacheWrite,
  });

  it("is free by the backend's test: everything 0, empty cached prices falling back to input", () => {
    expect(isFreeModelPrices(prices("0", "0"))).toBe(true);
    expect(isFreeModelPrices(prices("0", "0", "0", "0"))).toBe(true);
    expect(isFreeModelPrices(prices(" 0.00 ", "0", "0"))).toBe(true);
  });

  it.each([
    ["an input price", prices("0.01", "0")],
    ["an output price", prices("0", "0.4")],
    ["a cached price", prices("0", "0", "0.001")],
    ["a cache-write price", prices("0", "0", "", "0.1")],
    ["an empty input", prices("", "0")],
    ["text that isn't a price", prices("free", "0")],
  ])("is not free with %s", (_, row) => {
    expect(isFreeModelPrices(row)).toBe(false);
  });
});

describe("what saving the models table changes", () => {
  const row = (id: string, input: string, output: string, enabled = true) => ({
    id,
    name: id,
    enabled,
    input,
    output,
    cachedInput: "",
    cacheWrite: "",
  });
  const opusPaid = row("claude-opus-5-5", "0.38", "1.2");
  const opusFree = row("claude-opus-5-5", "0", "0");
  const deepseek = row("deepseek", "0", "0");

  it("changes nothing when another admin's save was refetched during an unrelated edit", () => {
    // Editing began with Opus priced; another admin made it free since. This
    // admin changed only cashback, so the models table isn't saved.
    const effects = modelSaveEffects({
      draft: [opusPaid, deepseek],
      base: [opusPaid, deepseek],
      saved: [opusFree, deepseek],
    });
    expect(effects.savesModels).toBe(false);
    expect(effects.toFree).toEqual([]);
    expect(effects.toPaid).toEqual([]);
    expect(effects.refusedNow).toEqual(["claude-opus-5-5", "deepseek"]);
    expect(effects.refusedAfterSave).toEqual(effects.refusedNow);
  });

  it("names the key moves and new refusals when the table is saved", () => {
    const effects = modelSaveEffects({
      draft: [opusFree, deepseek],
      base: [opusPaid, deepseek],
      saved: [opusPaid, deepseek],
    });
    expect(effects.savesModels).toBe(true);
    expect(effects.toFree).toEqual(["claude-opus-5-5"]);
    expect(effects.toPaid).toEqual([]);
    expect(effects.refusedNow).toEqual(["deepseek"]);
    expect(effects.refusedAfterSave).toEqual(["claude-opus-5-5", "deepseek"]);
  });

  it("compares against what is saved now, which the save replaces", () => {
    // Another admin made Opus free; this admin edited DeepSeek, so the save
    // writes the whole table and puts Opus's price back.
    const deepseekPriced = row("deepseek", "0.1", "0.3");
    const effects = modelSaveEffects({
      draft: [opusPaid, deepseekPriced],
      base: [opusPaid, deepseek],
      saved: [opusFree, deepseek],
    });
    expect(effects.toPaid).toEqual(["claude-opus-5-5", "deepseek"]);
    expect(effects.refusedAfterSave).toEqual([]);
  });

  it("announces no move for a model the save switches off", () => {
    const effects = modelSaveEffects({
      draft: [row("claude-opus-5-5", "0", "0", false)],
      base: [opusPaid],
      saved: [opusPaid],
    });
    expect(effects.toFree).toEqual([]);
    expect(effects.refusedAfterSave).toEqual([]);
  });

  it("counts a model priced from AntSeed by its auto prices, not the fixed ones typed", () => {
    // Fixed at 0, but the pass priced it: the backend serves and routes it paid.
    const autoGlm = { ...row("glm", "0", "0"), upstreamModel: "glm-5.3", autoEnabled: true };
    const autoPrices = {
      glm: {
        upstreamModel: "glm-5.3",
        prices: { inputUsdPerMTok: 0.08, outputUsdPerMTok: 0.3, cachedInputUsdPerMTok: 0.02 },
      },
    };
    const effects = modelSaveEffects({
      draft: [autoGlm, deepseek],
      base: [autoGlm, deepseek],
      saved: [autoGlm, deepseek],
      autoPrices,
    });
    expect(effects.refusedNow).toEqual(["deepseek"]);
    // Turning auto pricing off puts it back on its fixed 0 prices: free.
    const fixedGlm = { ...autoGlm, autoEnabled: false };
    const off = modelSaveEffects({
      draft: [fixedGlm, deepseek],
      base: [autoGlm, deepseek],
      saved: [autoGlm, deepseek],
      autoPrices,
    });
    expect(off.toFree).toEqual(["glm"]);
    expect(off.refusedAfterSave).toEqual(["glm", "deepseek"]);
  });
});

describe("served prices", () => {
  const base = {
    id: "glm",
    name: "GLM",
    enabled: true,
    input: "0",
    output: "0",
    cachedInput: "",
    cacheWrite: "",
    upstreamModel: "glm-5.3",
    autoEnabled: true,
  };
  const priced = {
    glm: {
      upstreamModel: "GLM-5.3 ",
      prices: { inputUsdPerMTok: 0.08, outputUsdPerMTok: 0.3, cachedInputUsdPerMTok: 0.02 },
    },
  };

  it("is paid once AntSeed pricing has set a price for its gateway model", () => {
    expect(isFreeModelRow(base, priced)).toBe(false);
  });

  it.each([
    ["auto pricing is off", { ...base, autoEnabled: false }, priced],
    ["no price was set yet", base, { glm: { upstreamModel: "glm-5.3" } }],
    ["the price was read for another gateway model", { ...base, upstreamModel: "glm-6" }, priced],
    ["no pricing state came back", base, undefined],
  ])("stays on its fixed prices when %s", (_, row, autoPrices) => {
    expect(isFreeModelRow(row, autoPrices)).toBe(true);
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

  it("leaves out a rate missing from the response and keeps a real $0", () => {
    expect(formatRates({ inputUsdPerMTok: 0, outputUsdPerMTok: 0.6 })).toBe(
      "in $0 · out $0.6",
    );
    expect(
      formatRates({
        inputUsdPerMTok: 0.08,
        outputUsdPerMTok: Number.NaN,
        cachedInputUsdPerMTok: null as unknown as number,
      }),
    ).toBe("in $0.08");
  });

  it("matches a gateway model ignoring case and spaces, and nothing else", () => {
    expect(sameUpstream(" GLM-5.3 ", "glm-5.3")).toBe(true);
    expect(sameUpstream("glm-5.3", "glm-5.3-air")).toBe(false);
    expect(sameUpstream(undefined, "glm-5.3")).toBe(false);
    expect(sameUpstream(null, "glm-5.3")).toBe(false);
  });

  describe("lowestNetAtReference", () => {
    it("is the markup after cashback when no limit applies", () => {
      expect(lowestNetAtReference(reference, 4, {}, [0.5])).toEqual({
        token: "input",
        net: 2,
      });
    });

    it("finds the token a maximum holds under cost", () => {
      // Output: 0.15 × 4 = 0.6, held to 0.2, so 0.2 / 0.15 × 0.5 ≈ 0.67.
      const low = lowestNetAtReference(reference, 4, { maxOutput: 0.2 }, [0.5]);
      expect(low?.token).toBe("output");
      expect(low?.net).toBeCloseTo(0.667, 3);
    });

    it("takes the official price as the ceiling when no maximum is set", () => {
      const low = lowestNetAtReference(
        reference,
        4,
        { officialOutput: 0.15 },
        [0.5],
      );
      expect(low).toEqual({ token: "output", net: 0.5 });
      // A maximum set replaces the official ceiling.
      expect(
        lowestNetAtReference(
          reference,
          4,
          { officialOutput: 0.15, maxOutput: 1 },
          [0.5],
        ),
      ).toEqual({ token: "input", net: 2 });
    });

    it("lets a minimum win over a ceiling it is above", () => {
      expect(
        lowestNetAtReference(
          reference,
          1,
          { minInput: 0.08, minOutput: 0.6, officialInput: 0.03 },
          [0.5],
        ),
      ).toEqual({ token: "cached input", net: 0.5 });
    });

    it("never prices cached input above input", () => {
      const low = lowestNetAtReference(
        { ...reference, cachedInputUsdPerMTok: 0.02 },
        4,
        { maxInput: 0.04 },
        [],
      );
      // Input held to 0.04 nets 2×; cached input capped at 0.04 nets 2× too.
      expect(low?.net).toBe(2);
    });

    it("is null when AntSeed has no paid rate", () => {
      expect(
        lowestNetAtReference(
          {
            inputUsdPerMTok: 0,
            outputUsdPerMTok: 0,
            cachedInputUsdPerMTok: 0,
          },
          4,
          {},
          [0.5],
        ),
      ).toBeNull();
    });
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
    expect(autoPriceStatus(undefined, "glm-5.3", false).text).toMatch(
      /as soon as this is saved.*fixed prices above apply until its rates are read/,
    );
    expect(autoPriceStatus(undefined, "glm-5.3", true).text).toMatch(
      /Waiting for AntSeed's rates.*fixed prices above apply until then/,
    );
    // Saved at a new gateway model: the stored state was read for the old one.
    expect(
      autoPriceStatus(
        { upstreamModel: "glm-5.3", listed: true, reference, prices },
        "glm-5.3-air",
        true,
      ).text,
    ).toMatch(/Waiting for AntSeed's rates/);
    // A state with no gateway model matches nothing.
    expect(
      autoPriceStatus(
        { listed: true, reference, prices } as never,
        "glm-5.3",
        true,
      ).text,
    ).toMatch(/Waiting for AntSeed's rates/);
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

  it("says the fixed prices apply while every seller gives it away and none was set", () => {
    const free = {
      ...reference,
      inputUsdPerMTok: 0,
      outputUsdPerMTok: 0,
      cachedInputUsdPerMTok: 0,
      sellers: 0,
    };
    const { text } = autoPriceStatus(
      { upstreamModel: "glm-5.3", listed: true, reference: free },
      "glm-5.3",
      true,
    );
    expect(text).toMatch(/fixed prices above apply until one charges for it/);
    expect(text).not.toMatch(/typical rate/);
  });
});

describe("walletShortLabel", () => {
  it("says by how much the Wallet is short, to the cent", () => {
    expect(walletShortLabel(2.2)).toBe("Short $2.20");
  });

  it("says only that it is short when the amount is unknown, or from an older backend", () => {
    expect(walletShortLabel(null)).toBe("Short");
    expect(walletShortLabel(undefined)).toBe("Short");
    expect(walletShortLabel(0)).toBe("Short");
  });
});
