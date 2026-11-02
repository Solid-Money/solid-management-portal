"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * One section of a long config page, as a summary line that opens to its
 * details. Closed by default, so the page reads as a list of what it holds and
 * each part is opened when it is needed.
 */
export default function CollapsibleSection({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  /** One line on what the section is for, readable while it is closed. */
  summary: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-gray-200 bg-white"
    >
      <section aria-labelledby={id}>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-start gap-3 p-4 text-left">
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-gray-500 transition-transform",
              !open && "-rotate-90"
            )}
            aria-hidden
          />
          <span className="flex flex-col gap-0.5">
            <span id={id} className="text-lg font-semibold text-gray-900">
              {title}
            </span>
            <span className="text-sm text-gray-500">{summary}</span>
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 border-t border-gray-100 p-4">
          {children}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
