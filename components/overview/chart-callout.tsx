/**
 * Boxed labels above a bar chart ("Nov 1 · $34.8K · best day since Oct 12").
 *
 * Recharts gives a reference line's label only the line's x, not the plot's
 * width, so placement is decided from the bar's index instead: labels near an
 * edge grow inward, and a label that would collide with an earlier one moves
 * to a second row.
 */

export interface CalloutSpec {
  key: string;
  date: string;
  text: string;
  align: "start" | "center" | "end";
  row: 0 | 1;
}

const ROW_HEIGHT = 22;

/** Top margin the chart needs for its callouts. */
export function calloutMargin(callouts: CalloutSpec[]): number {
  if (callouts.length === 0) return 12;
  return callouts.some((c) => c.row === 1) ? 8 + 2 * ROW_HEIGHT + 6 : 8 + ROW_HEIGHT + 6;
}

/** Place labels for bars at `index` out of `total` bars. */
export function placeCallouts(
  items: Array<{ key: string; date: string; text: string; index: number }>,
  total: number,
): CalloutSpec[] {
  // About how many bars one label covers.
  const span = Math.max(4, Math.ceil(total * 0.35));
  const lastInRow: Array<number | null> = [null, null];
  return [...items]
    .sort((a, b) => a.index - b.index)
    .map((item) => {
      const share = total > 1 ? item.index / (total - 1) : 0.5;
      const align = share > 0.7 ? "end" : share < 0.2 ? "start" : "center";
      const row: 0 | 1 =
        lastInRow[0] === null || item.index - lastInRow[0] >= span ? 0 : 1;
      lastInRow[row] = item.index;
      return { key: item.key, date: item.date, text: item.text, align, row };
    });
}

export function CalloutLabel({
  spec,
  viewBox,
}: {
  spec: CalloutSpec;
  viewBox?: { x?: number; width?: number };
}) {
  if (!viewBox || viewBox.x === undefined) return null;
  const width = Math.min(spec.text.length * 5.9 + 16, 320);
  const x = viewBox.x + (viewBox.width ?? 0) / 2;
  const left = spec.align === "end" ? x - width + 14 : spec.align === "start" ? x - 14 : x - width / 2;
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
