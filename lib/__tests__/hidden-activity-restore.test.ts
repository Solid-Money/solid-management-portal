import { describe, expect, it } from "vitest";
import {
  hiddenReasonSummary,
  hiddenTotal,
  isHiddenActivityRestorePreview,
} from "@/lib/hidden-activity-restore";

const blocked = {
  no_hash: 0,
  internal_transfer: 18,
  token_not_listed: 540,
  settlement_sweep: 2,
  settlement_unknown: 0,
  duplicate: 3,
};

const entry = {
  id: "6af47a8e6e5c978e9747d0e6",
  userId: "687e21b78b578d8b299c5485",
  type: "send",
  status: "processing",
  amount: "100000",
  symbol: "SOFUSE",
  chainId: 122,
  hash: "0x07114b9b8bc827c3eada08b07f2bab1d76c1f5e86f37730109c0b48de2e76fac",
  createdAt: "2026-11-11T14:24:14.279Z",
  state: "eligible",
};

const preview = {
  userId: null,
  scanned: 1032,
  eligible: 469,
  blocked,
  accounts: 301,
  batchLimit: 500,
  hasMore: false,
  canApply: true,
  previewToken: "a".repeat(64),
  entries: [
    entry,
    { ...entry, id: "x", state: "blocked", blockedReason: "token_not_listed" },
  ],
};

describe("hidden activity restore helpers", () => {
  it("accepts a preview the panel can render", () => {
    expect(isHiddenActivityRestorePreview(preview)).toBe(true);
  });

  it.each([
    null,
    "nope",
    { ...preview, entries: undefined },
    { ...preview, blocked: [] },
    { ...preview, previewToken: 42 },
    { ...preview, canApply: "yes" },
    { ...preview, hasMore: undefined },
    // One malformed row would throw while the review table renders.
    { ...preview, entries: [null] },
    { ...preview, entries: [{ ...entry, id: 7 }] },
    { ...preview, entries: [{ ...entry, chainId: "122" }] },
    { ...preview, entries: [{ ...entry, state: "restored" }] },
  ])("rejects a malformed preview: %j", (value) => {
    expect(isHiddenActivityRestorePreview(value)).toBe(false);
  });

  it("lists the reasons rows stay hidden, most common first, without empty ones", () => {
    expect(hiddenReasonSummary(blocked)).toEqual([
      { reason: "token_not_listed", label: "Spam token (still not listed)", count: 540 },
      { reason: "internal_transfer", label: "Deposit or withdrawal leg", count: 18 },
      { reason: "duplicate", label: "Already shown by another row", count: 3 },
      { reason: "settlement_sweep", label: "Card settlement sweep", count: 2 },
    ]);
  });

  it("keeps a reason a newer server sends under its raw name", () => {
    expect(
      hiddenReasonSummary({ ...blocked, brand_new: 1 } as typeof blocked),
    ).toContainEqual({ reason: "brand_new", label: "brand_new", count: 1 });
  });

  it("totals the rows left hidden", () => {
    expect(hiddenTotal(blocked)).toBe(563);
  });
});
