/**
 * Boxed labels above a bar chart ("Nov 1 · $34.8K · best day since Oct 12").
 *
 * Recharts gives a reference line's label only the line's x, so placement is
 * decided from the bar's index and the plot's measured width: labels near an
 * edge grow inward, a label whose box would overlap an earlier one moves to a
 * second row, and one with no room on either row is left out.
 */

export interface CalloutSpec {
  key: string;
  date: string;
  text: string;
  align: "start" | "center" | "end";
  row: 0 | 1;
}

const ROW_HEIGHT = 22;
/** Space kept between two boxes on one row. */
const BOX_GAP = 6;

/** What both charts reserve beside the plot: the 48px value axis and a 4px margin. */
export const CHART_SIDE_PX = 52;

/** The box's width for its text, as CalloutLabel draws it. */
function boxWidth(text: string): number {
  return Math.min(text.length * 5.9 + 16, 320);
}

/** The box's left edge for a bar centred at `x`. */
function boxLeft(x: number, width: number, align: CalloutSpec["align"]): number {
  return align === "end" ? x - width + 14 : align === "start" ? x - 14 : x - width / 2;
}

/** Top margin the chart needs for its callouts. */
export function calloutMargin(callouts: CalloutSpec[]): number {
  if (callouts.length === 0) return 12;
  return callouts.some((c) => c.row === 1) ? 8 + 2 * ROW_HEIGHT + 6 : 8 + ROW_HEIGHT + 6;
}

/**
 * Place labels for bars at `index` out of `total` bars in a plot `plotWidth`
 * pixels wide. Items come most important first: each takes the first row
 * where its box overlaps no other, and one that finds both rows taken is
 * dropped rather than drawn over another. Until the plot is measured, a label
 * is taken to cover about a third of the bars.
 */
export function placeCallouts(
  items: Array<{ key: string; date: string; text: string; index: number }>,
  total: number,
  plotWidth = 0,
): CalloutSpec[] {
  const span = Math.max(4, Math.ceil(total * 0.35));
  const slot = plotWidth > 0 && total > 0 ? plotWidth / total : 0;
  type Box = { index: number; left: number; right: number };
  const taken: [Box[], Box[]] = [[], []];
  const placed: Array<{ index: number; spec: CalloutSpec }> = [];
  for (const item of items) {
    const share = total > 1 ? item.index / (total - 1) : 0.5;
    const align = share > 0.7 ? "end" : share < 0.2 ? "start" : "center";
    const width = boxWidth(item.text);
    const left = boxLeft((item.index + 0.5) * slot, width, align);
    const box: Box = { index: item.index, left, right: left + width };
    const clearOf = (other: Box) =>
      slot > 0
        ? box.left >= other.right + BOX_GAP || box.right + BOX_GAP <= other.left
        : Math.abs(box.index - other.index) >= span;
    const row = ([0, 1] as const).find((r) => taken[r].every(clearOf));
    if (row === undefined) continue;
    taken[row].push(box);
    placed.push({
      index: item.index,
      spec: { key: item.key, date: item.date, text: item.text, align, row },
    });
  }
  return placed.sort((a, b) => a.index - b.index).map((p) => p.spec);
}

export function CalloutLabel({
  spec,
  viewBox,
}: {
  spec: CalloutSpec;
  viewBox?: { x?: number; width?: number };
}) {
  if (!viewBox || viewBox.x === undefined) return null;
  const width = boxWidth(spec.text);
  const x = viewBox.x + (viewBox.width ?? 0) / 2;
  const left = boxLeft(x, width, spec.align);
  const top = 4 + spec.row * ROW_HEIGHT;
  return (
    <g>
      <rect x={left} y={top} width={width} height={19} rx={4} fill="#ffffff" stroke="#e6e8ee" />
      <text x={left + width / 2} y={top + 13} textAnchor="middle" fontSize={11} fill="#374151">
        {spec.text}
      </text>
    </g>
  );
}
