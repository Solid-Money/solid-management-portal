"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

interface MetricLabelProps {
  /** The glossary entry this label is defined by. */
  metric: GlossaryKey;
  /** Overrides the glossary's own term, for a panel-specific wording. */
  label?: string;
  className?: string;
}

/**
 * A metric name with its definition one hover away.
 *
 * Every label in Analytics goes through this rather than being plain text, so
 * a number can always be traced to the definition that produced it. Three
 * "revenue" totals disagreeing was a definitions problem before it was a data
 * problem; putting the definition next to the number is how that stays fixed.
 */
export function MetricLabel({ metric, label, className }: MetricLabelProps) {
  const entry = GLOSSARY[metric];

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex cursor-help items-center gap-1 decoration-dotted underline-offset-4 hover:underline",
              className
            )}
          >
            {label ?? entry.term}
            <Info className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1.5 text-left">
          <p className="font-medium">{entry.term}</p>
          <p className="text-xs leading-relaxed">{entry.definition}</p>
          {entry.source ? (
            <p className="text-xs leading-relaxed text-gray-300">
              {entry.source}
            </p>
          ) : null}
          {/* The caveat is the part that changes a decision, so it is visually
              separated rather than run on from the definition. */}
          {entry.caveat ? (
            <p className="border-t border-white/15 pt-1.5 text-xs leading-relaxed text-amber-200">
              {entry.caveat}
            </p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default MetricLabel;
