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
  entries: [],
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
