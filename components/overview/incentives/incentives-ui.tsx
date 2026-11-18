import type { IncentiveKind } from "@/lib/incentives";
import { OVERVIEW_ACCENT } from "@/components/overview/overview-ui";

/**
 * The Incentives tab's colours and small chart pieces. Cashback keeps the
 * Overview's indigo; referral rewards get one calm second hue; everything
 * smaller is grey.
 */

export const INCENTIVE_COLORS = {
  cashback: OVERVIEW_ACCENT,
  referrals: "#1f9aa8",
  perks: "#9ca3af",
  yieldBoost: "#d1d5db",
  other: "#c4c8d2",
} as const;

/** The running week's bar: the same hues, lighter. */
export const INCENTIVE_FADED = {
  cashback: "#b4b4ef",
  referrals: "#aad9de",
  perks: "#d9dce1",
  yieldBoost: "#eceef1",
} as const;

/** "If nothing is cancelled" bars: outlined, nearly white. */
export const INCENTIVE_OUTLINE = {
  cashback: "#e3e5fb",
  referrals: "#d4eef1",
  stroke: "#9ca3af",
} as const;

export const KIND_COLORS: Record<IncentiveKind, string> = {
  cashback: INCENTIVE_COLORS.cashback,
  referrals: INCENTIVE_COLORS.referrals,
  other: INCENTIVE_COLORS.other,
};

export function Legend({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2 shrink-0 rounded-[2px]"
        style={{
          background: color,
          border: dashed ? `1px dashed ${INCENTIVE_OUTLINE.stroke}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

export const AXIS_TICK = { fontSize: 11, fill: "#9ca3af" } as const;

/** The parts of recharts' state a `<Customized>` layer reads. */
export interface ChartLayerProps {
  offset?: { top: number; left: number; width: number; height: number };
  formattedGraphicalItems?: Array<{
    item?: { props?: { dataKey?: unknown } };
    props?: { data?: Array<{ x?: number; y?: number; width?: number; height?: number }> };
  }>;
}

export interface BarBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The box a stack of bars covers at `index`, from the series named in
 * `keys`; null before recharts has laid the bars out.
 */
export function stackBox(props: ChartLayerProps, keys: string[], index: number): BarBox | null {
  let box: BarBox | null = null;
  for (const graphical of props.formattedGraphicalItems ?? []) {
    const key = graphical.item?.props?.dataKey;
    if (typeof key !== "string" || !keys.includes(key)) continue;
    const rect = graphical.props?.data?.[index];
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height)
    ) {
      continue;
    }
    const x = rect.x as number;
    const width = rect.width as number;
    // recharts gives a negative height to bars drawn upwards in some versions.
    const top = Math.min(rect.y as number, (rect.y as number) + (rect.height as number));
    const bottom = Math.max(rect.y as number, (rect.y as number) + (rect.height as number));
    box = box
      ? {
          x: Math.min(box.x, x),
          width: Math.max(box.x + box.width, x + width) - Math.min(box.x, x),
          y: Math.min(box.y, top),
          height: Math.max(box.y + box.height, bottom) - Math.min(box.y, top),
        }
      : { x, width, y: top, height: bottom - top };
  }
  return box;
}
