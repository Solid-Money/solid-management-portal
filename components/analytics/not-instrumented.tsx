"use client";

import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotInstrumentedProps {
  /** What we would be showing if we measured it. */
  metric: string;
  /** Why we cannot, and what would unblock it. */
  reason: string;
  /** Which phase the panel is expected in, when that is known. */
  phase?: 2 | 3;
  className?: string;
}

/**
 * A metric we do not measure yet.
 *
 * Deliberately not a zero. A clean `0` and an unmeasured metric render
 * identically and mean opposite things — one is information, the other is a
 * blind spot — and bank deposit attempts read as 0 on the old dashboard for
 * months for exactly this reason. Saying so keeps the gap visible and
 * actionable instead of quietly wrong.
 */
export function NotInstrumented({
  metric,
  reason,
  phase,
  className,
}: NotInstrumentedProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-gray-300 bg-gray-50/60 p-4",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-600">
            {metric} · Not instrumented
          </p>
          <p className="text-xs leading-relaxed text-gray-500">{reason}</p>
          {phase ? (
            <p className="text-xs text-gray-400">Expected in Phase {phase}.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The inline form, for a single cell or KPI value rather than a whole panel. */
export function NotInstrumentedValue({ className }: { className?: string }) {
  return (
    <span className={cn("text-sm font-normal text-gray-400", className)}>
      Not instrumented
    </span>
  );
}

export default NotInstrumented;
