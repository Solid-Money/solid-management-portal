"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * One feature of a provider — the card, a bank account, cash deposits — as a
 * details/summary row: closed by default so the page reads as a summary of
 * every provider, with the summary line saying how many countries are on the
 * list and whether anything is waiting. Click to open the editor.
 */
export function FeatureSection({
  icon: Icon,
  title,
  subtitle,
  badges,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badges?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={false}
      className="rounded-lg border border-gray-200 bg-white"
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-start gap-3 rounded-lg px-4 py-3 text-left hover:bg-gray-50">
        <ChevronRight
          className="mt-0.5 size-4 shrink-0 text-gray-400 transition-transform group-data-[state=open]:rotate-90"
          aria-hidden
        />
        <Icon className="mt-0.5 size-4 shrink-0 text-gray-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        {badges ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {badges}
          </div>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t border-gray-100 px-4 py-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
