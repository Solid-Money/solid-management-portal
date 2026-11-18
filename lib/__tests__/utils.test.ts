import { describe, expect, it } from "vitest";
import { formatCurrency, formatEur, getExplorerTxUrl } from "@/lib/utils";

describe("formatCurrency", () => {
  it("shows an amount in its own currency", () => {
    expect(formatCurrency("12.73", "EUR")).toBe("€12.73");
    expect(formatCurrency(1234.5, "USD")).toBe("$1,234.50");
    expect(formatCurrency(-12, "EUR")).toBe("-€12.00");
  });

  it("reads a missing or unreadable amount as missing, not as zero", () => {
    expect(formatCurrency("", "EUR")).toBeNull();
    expect(formatCurrency("  ", "EUR")).toBeNull();
    expect(formatCurrency(undefined, "EUR")).toBeNull();
    expect(formatCurrency(null, "EUR")).toBeNull();
    expect(formatCurrency("abc", "EUR")).toBeNull();
  });

  it("still shows a currency code Intl does not know", () => {
    expect(formatCurrency("12.73", "NOT-A-CODE")).toBe("12.73 NOT-A-CODE");
  });

  it("takes fraction digits", () => {
    expect(formatCurrency(50, "EUR", { minimum: 0 })).toBe("€50");
    expect(formatCurrency(50, "EUR", { minimum: 0, maximum: 0 })).toBe("€50");
  });
});

describe("formatEur", () => {
  it("is the euro twin of formatUsd", () => {
    expect(formatEur(1234.5)).toBe("€1,234.50");
    expect(formatEur(1234.5, 0)).toBe("€1,235");
    expect(formatEur(Number.NaN)).toBe("€0.00");
  });
});

describe("getExplorerTxUrl", () => {
  it("links each chain to its own explorer", () => {
    expect(getExplorerTxUrl("0xa", 8453)).toBe("https://basescan.org/tx/0xa");
    expect(getExplorerTxUrl("0xa", 122)).toBe(
      "https://explorer.fuse.io/tx/0xa"
    );
  });

  it("falls back to Fuse with no chain or an unknown one", () => {
    expect(getExplorerTxUrl("0xa", undefined)).toBe(
      "https://explorer.fuse.io/tx/0xa"
    );
    expect(getExplorerTxUrl("0xa", null)).toBe(
      "https://explorer.fuse.io/tx/0xa"
    );
    expect(getExplorerTxUrl("0xa", 999)).toBe(
      "https://explorer.fuse.io/tx/0xa"
    );
  });
});
