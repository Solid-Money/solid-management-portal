import type {
  MoneyInMethod,
  OverviewMoneyInDay,
  OverviewSpendChartDay,
} from "@/types/overview";

/** One bar per day up to this many days; one per week beyond. */
export const MAX_DAILY_BARS = 90;
/** A day this many times the median day is drawn capped, with its real total. */
export const CAP_MULTIPLE = 2.5;

/** The money-in chart's series: Base and BNB Chain alone, the other networks together. */
export const MONEY_IN_SERIES = [
  { id: "base", label: "Base", methods: ["base"], color: "#3b3bd6" },
  { id: "bnb", label: "BNB Chain", methods: ["bnb"], color: "#7c80e6" },
  {
    id: "other",
    label: "Other networks",
    methods: ["arbitrum", "ethereum", "polygon", "fuse"],
    color: "#c7cbf5",
  },
  { id: "bank", label: "Bank transfer", methods: ["bank"], color: "#16a37a" },
  { id: "transfi", label: "TransFi", methods: ["transfi"], color: "#8fd9bd" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  methods: readonly MoneyInMethod[];
  color: string;
}>;

export type MoneyInSeries = (typeof MONEY_IN_SERIES)[number]["id"];

/** The chip colour of one method: its series' colour. */
export function methodColor(method: MoneyInMethod): string {
  return (
    MONEY_IN_SERIES.find((s) => (s.methods as readonly string[]).includes(method))
      ?.color ?? "#c7cbf5"
  );
}

export interface ChartBar {
  /** First day of the bar (the day, or the Monday of its week). */
  date: string;
  /** Last day the bar covers. */
  until: string;
  inRange: boolean;
  partial: boolean;
}

/**
 * Days to weeks (Monday first) once a range is longer than 90 days. A week is
 * in range if any of its days is, and partial if it holds today.
 */
export function toWeeks<T extends ChartBar>(
  bars: T[],
  merge: (week: T[]) => Omit<T, keyof ChartBar>,
): T[] {
  if (bars.length <= MAX_DAILY_BARS) return bars;
  const weeks = new Map<string, T[]>();
  for (const bar of bars) {
    const key = mondayOf(bar.date);
    weeks.set(key, [...(weeks.get(key) ?? []), bar]);
  }
  return [...weeks.entries()].map(
    ([monday, days]) =>
      ({
        ...merge(days),
        date: monday,
        until: days[days.length - 1].until,
        inRange: days.some((d) => d.inRange),
        partial: days.some((d) => d.partial),
      }) as T,
  );
}

export type SpendBar = ChartBar & {
  usd: number;
  payments: number;
  incident: OverviewSpendChartDay["incident"];
};

export function spendBars(days: OverviewSpendChartDay[]): SpendBar[] {
  return toWeeks(
    days.map((d) => ({ ...d, until: d.date })),
    (week) => ({
      usd: sum(week.map((d) => d.usd)),
      payments: sum(week.map((d) => d.payments)),
      incident: week.find((d) => d.incident)?.incident ?? null,
    }),
  );
}

export type MoneyBar = ChartBar & {
  total: number;
  count: number;
  /** USD per series, for the stacked bars. */
  series: Record<MoneyInSeries, number>;
  /** USD per method, for the tooltip and a single-method view. */
  byMethod: Partial<Record<MoneyInMethod, number>>;
};

export function moneyBars(days: OverviewMoneyInDay[]): MoneyBar[] {
  const bars: MoneyBar[] = days.map((d) => {
    const byMethod: Partial<Record<MoneyInMethod, number>> = {};
    for (const [method, value] of Object.entries(d.byMethod)) {
      byMethod[method as MoneyInMethod] = value?.usd ?? 0;
    }
    return {
      date: d.date,
      until: d.date,
      inRange: d.inRange,
      partial: d.partial,
      total: d.totalUsd,
      count: d.count,
      byMethod,
      series: seriesOf(byMethod),
    };
  });
  return toWeeks(bars, (week) => {
    const byMethod: Partial<Record<MoneyInMethod, number>> = {};
    for (const day of week) {
      for (const [method, usd] of Object.entries(day.byMethod)) {
        const key = method as MoneyInMethod;
        byMethod[key] = (byMethod[key] ?? 0) + (usd ?? 0);
      }
    }
    return {
      total: sum(week.map((d) => d.total)),
      count: sum(week.map((d) => d.count)),
      byMethod,
      series: seriesOf(byMethod),
    };
  });
}

/**
 * Where the y-axis stops. Bars above it are drawn capped at the top with their
 * real total in a label, so one Fuse whale day does not flatten the month.
 * Returns null when nothing needs capping.
 */
export function capAt(values: number[]): number | null {
  const positive = values.filter((v) => v > 0);
  if (positive.length < 5) return null;
  const sorted = [...positive].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const cap = CAP_MULTIPLE * median;
  const under = positive.filter((v) => v <= cap);
  if (under.length === positive.length) return null;
  return Math.max(...under) * 1.05;
}

function seriesOf(
  byMethod: Partial<Record<MoneyInMethod, number>>,
): Record<MoneyInSeries, number> {
  const out = {} as Record<MoneyInSeries, number>;
  for (const series of MONEY_IN_SERIES) {
    out[series.id] = sum(series.methods.map((m) => byMethod[m] ?? 0));
  }
  return out;
}

function mondayOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
}

function sum(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}
