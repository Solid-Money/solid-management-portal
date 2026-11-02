import { describe, expect, it } from "vitest";
import { capAt, moneyBars, spendBars } from "@/lib/overview-charts";
import type { OverviewMoneyInDay, OverviewSpendChartDay } from "@/types/overview";
import { addDays } from "@/lib/overview-range";

const spendDay = (date: string, usd: number): OverviewSpendChartDay => ({
  date,
  usd,
  payments: 1,
  inRange: true,
  partial: false,
  incident: null,
});

describe("chart bars", () => {
  it("keeps one bar per day up to 90 days and groups weeks beyond", () => {
    const days = (n: number) =>
      Array.from({ length: n }, (_, i) => spendDay(addDays("2026-01-05", i), 10));
    expect(spendBars(days(90))).toHaveLength(90);
    const weeks = spendBars(days(91));
    expect(weeks).toHaveLength(13);
    expect(weeks[0]).toMatchObject({ date: "2026-01-05", until: "2026-01-11", usd: 70 });
  });

  it("stacks money in by series, with the other networks together", () => {
    const day: OverviewMoneyInDay = {
      date: "2026-11-01",
      inRange: true,
      partial: false,
      totalUsd: 44_300,
      count: 200,
      byMethod: {
        base: { usd: 30_400, count: 150 },
        bank: { usd: 5_100, count: 22 },
        bnb: { usd: 4_900, count: 10 },
        arbitrum: { usd: 2_000, count: 5 },
        polygon: { usd: 1_800, count: 4 },
        transfi: { usd: 100, count: 9 },
      },
    };
    expect(moneyBars([day])[0].series).toEqual({
      base: 30_400,
      bnb: 4_900,
      other: 3_800,
      bank: 5_100,
      transfi: 100,
    });
  });

  it("caps only a day far above the rest", () => {
    const month = [20, 18, 25, 30, 22, 44.3, 19, 21, 75.6, 24].map((k) => k * 1000);
    const cap = capAt(month);
    expect(cap).not.toBeNull();
    expect(cap!).toBeGreaterThan(44_300);
    expect(cap!).toBeLessThan(75_600);
    expect(capAt([20, 21, 22, 23, 24, 25].map((k) => k * 1000))).toBeNull();
  });
});
