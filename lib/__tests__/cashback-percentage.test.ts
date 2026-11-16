import { describe, expect, it } from "vitest";
import { formatMonthlyCap } from "@/lib/cashback-percentage";

describe("formatMonthlyCap", () => {
  it("shows a USD cap as before", () => {
    expect(formatMonthlyCap(100)).toBe("$100/mo cap");
    expect(formatMonthlyCap(12.5)).toBe("$12.5/mo cap");
    expect(formatMonthlyCap(0)).toBe("$0/mo cap");
  });

  it("shows a euro row's cap in euros", () => {
    expect(formatMonthlyCap(50, "EUR")).toBe("€50/mo cap");
    expect(formatMonthlyCap(12.5, "EUR")).toBe("€12.5/mo cap");
    expect(formatMonthlyCap(1000, "EUR")).toBe("€1,000/mo cap");
  });

  it("is undefined when no cap is frozen on the row", () => {
    expect(formatMonthlyCap(undefined)).toBeUndefined();
    expect(formatMonthlyCap(null, "EUR")).toBeUndefined();
    expect(formatMonthlyCap(-1)).toBeUndefined();
    expect(formatMonthlyCap(Number.NaN, "EUR")).toBeUndefined();
  });
});
