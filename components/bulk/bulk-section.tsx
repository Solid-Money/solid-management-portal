"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * One job on Config → Bulk, folded into a native `<details>`.
 *
 * Every section starts closed: each one acts on many users at once, so the
 * page reads as a list of what is possible and nothing is loaded — or
 * pressed — until the operator opens the one they came for. The body is
 * mounted while closed so a search result can still reach an `id` inside it;
 * `SectionScroller` opens the section on the way. Anything expensive inside
 * should wait for `open`, which the body receives.
 */
export default function BulkSection({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: (open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      id={id}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl px-6 py-4 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-90" />
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-gray-900">{title}</span>
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        </div>
      </summary>
      <div className="border-t border-gray-100 px-6 py-5">
        {children(open)}
      </div>
    </details>
  );
}
