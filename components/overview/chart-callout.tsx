/**
 * Boxed labels above a bar chart ("Nov 1 · $34.8K · best day since Oct 12").
 *
 * Recharts gives a reference line's label only the line's x, not the plot's
 * width, so placement is decided from the bar's index instead: labels near an
 * edge grow inward, a label that would collide with an earlier one moves to a
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

/** Top margin the chart needs for its callouts. */
export function calloutMargin(callouts: CalloutSpec[]): number {
  if (callouts.length === 0) return 12;
  return callouts.some((c) => c.row === 1) ? 8 + 2 * ROW_HEIGHT + 6 : 8 + ROW_HEIGHT + 6;
}

/**
 * Place labels for bars at `index` out of `total` bars. Items come most
 * important first: each takes the first row with no label within reach, and
 * one that finds both rows taken is dropped rather than drawn over another.
 */
export function placeCallouts(
  items: Array<{ key: string; date: string; text: string; index: number }>,
  total: number,
): CalloutSpec[] {
  // About how many bars one label covers.
  const span = Math.max(4, Math.ceil(total * 0.35));
  const taken: [number[], number[]] = [[], []];
  const placed: Array<{ index: number; spec: CalloutSpec }> = [];
  for (const item of items) {
    const row = ([0, 1] as const).find((r) =>
      taken[r].every((index) => Math.abs(item.index - index) >= span),
    );
    if (row === undefined) continue;
    taken[row].push(item.index);
    const share = total > 1 ? item.index / (total - 1) : 0.5;
    const align = share > 0.7 ? "end" : share < 0.2 ? "start" : "center";
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
