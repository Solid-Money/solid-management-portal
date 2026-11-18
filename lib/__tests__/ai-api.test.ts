import { describe, expect, it } from "vitest";
import {
  formatFirstToken,
  formatTokensPerSecond,
  isFreeModelPrices,
  modelSaveEffects,
  NEAR_LIMIT_PERCENT,
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
});
