"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SourceBadge, type AnalyticsSourceId } from "@/components/analytics/source-badge";
import type { AnalyticsSubTab } from "@/lib/analytics-navigation";

interface PanelProps {
  title: string;
  /**
   * The one question this panel answers.
   *
   * Required, and the rule the section is built on: a chart that does not
   * answer a question does not earn its space. Writing the question down is
   * what makes that reviewable.
   */
  question: string;
  source?: AnalyticsSourceId;
  updatedAt?: string;
  isLoading?: boolean;
  error?: unknown;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({
  title,
  question,
  source,
  updatedAt,
  isLoading,
  error,
  actions,
  children,
  className,
}: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-gray-200 bg-white shadow-sm",
        className
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="mt-0.5 text-sm text-gray-500">{question}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          {source ? <SourceBadge source={source} updatedAt={updatedAt} /> : null}
        </div>
      </header>

      <div className="p-6">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Could not load this panel. {errorMessage(error)}
          </div>
        ) : isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * The placeholder for a sub-tab that is not built yet.
 *
 * States the phase and what is blocking it, rather than "coming soon": an
 * operator who knows a panel is waiting on cost inputs they can enter, or on
 * backend logging someone else owns, can act on that.
 */
export function PendingSubTab({
  tabLabel,
  subTab,
}: {
  tabLabel: string;
  subTab: AnalyticsSubTab;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/60 p-10 text-center">
      <p className="text-sm font-medium text-gray-700">
        {tabLabel} → {subTab.label}
      </p>
      <p className="mx-auto mt-1 max-w-xl text-sm text-gray-500">
        {subTab.question}
      </p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">
        Coming in Phase {subTab.pending?.phase ?? 2}
      </p>
      {subTab.pending?.blockedOn ? (
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-gray-500">
          {subTab.pending.blockedOn}
        </p>
      ) : null}
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "The analytics service may be unavailable.";
}

export default Panel;
