import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Change } from "@/lib/overview-format";

/**
 * The Overview page's building blocks, in the page's light admin style:
 * white cards with a soft border on the grey page, colour only for good or bad
 * movement and severity.
 */

export const OVERVIEW_ACCENT = "#3b3bd6";
export const OVERVIEW_FADED = "#d4d6f5";
export const OVERVIEW_INCIDENT = "#f2a5a5";

export function OverviewCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[#e6e8ee] bg-white text-gray-900",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-[12.5px] text-gray-500">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
    </div>
  );
}

/** "Open in Analytics →": every block links to the list behind it. */
export function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap text-[13px] font-medium text-[#3b3bd6] hover:underline"
    >
      {children} →
    </Link>
  );
}

export type ChipTone = "good" | "bad" | "warn" | "neutral";

const CHIP_TONES: Record<ChipTone, string> = {
  good: "bg-[#e8f7ee] text-[#15803d]",
  bad: "bg-[#fdecec] text-[#b91c1c]",
  warn: "bg-[#fef3e2] text-[#b45309]",
  neutral: "bg-[#f1f2f6] text-[#4b5563]",
};

export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-[7px] py-[2px] text-[11.5px] font-semibold whitespace-nowrap",
        CHIP_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/**
 * A change chip. `goodWhen` says which direction is good news: more spend is,
 * more cost is not.
 */
export function ChangeChip({
  change,
  goodWhen = "up",
}: {
  change: Change;
  goodWhen?: "up" | "down";
}) {
  if (!change.text) return null;
  const tone: ChipTone =
    change.tone === "flat" ? "neutral" : change.tone === goodWhen ? "good" : "bad";
  return <Chip tone={tone}>{change.text}</Chip>;
}

/**
 * A 14-day line with the picked range shaded. `highlight` is how many of the
 * last points fall in the range.
 */
export function Sparkline({
  values,
  highlight,
  color = OVERVIEW_ACCENT,
  width = 176,
  height = 36,
}: {
  values: Array<number | null>;
  highlight: number;
  color?: string;
  width?: number;
  height?: number;
}) {
  const points = values
    .map((value, i) => ({ value, i }))
    .filter((p): p is { value: number; i: number } => p.value !== null);
  if (points.length < 2) {
    return <div style={{ height }} aria-hidden />;
  }
  const max = Math.max(...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value));
  const span = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  const y = (v: number) => height - 4 - ((v - min) / span) * (height - 8);
  const line = points.map((p) => `${(p.i * step).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const shaded = Math.min(Math.max(highlight, 0), values.length);
  const shadeX = (values.length - shaded) * step - step / 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block w-full max-w-[220px]"
      style={{ height }}
      aria-hidden
    >
      {shaded > 0 && shaded < values.length ? (
        <rect
          x={Math.max(shadeX, 0)}
          y={0}
          width={width - Math.max(shadeX, 0)}
          height={height}
          fill="#eef0fd"
        />
      ) : null}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.i * step} cy={y(last.value)} r={2.6} fill={color} />
    </svg>
  );
}

/** A proportional bar of two or more parts, with a legend under it. */
export function SplitBar({
  parts,
}: {
  parts: Array<{ label: string; value: number; color: string }>;
}) {
  const total = parts.reduce((sum, p) => sum + Math.max(p.value, 0), 0);
  return (
    <div className="w-full">
      <div className="mt-1.5 flex h-2 w-full gap-[2px] overflow-hidden rounded bg-[#f1f2f6]">
        {total > 0
          ? parts.map((p) => (
              <div
                key={p.label}
                style={{ width: `${(Math.max(p.value, 0) / total) * 100}%`, background: p.color }}
              />
            ))
          : null}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <span className="size-[7px] rounded-[2px]" style={{ background: p.color }} />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
