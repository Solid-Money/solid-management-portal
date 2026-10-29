import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * A section that starts closed and opens on click, built on native
 * `<details>`/`<summary>` so the collapsed state needs no JS. Used to stack the
 * incident-response tools on the Revoke page without showing every form at
 * once — an operator opens only the one they need.
 */
export default function CollapsibleSection({
  title,
  description,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Off by default — every section on the Revoke page is collapsed until clicked. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className="group rounded-lg border border-gray-200 bg-white"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-90" />
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-gray-400" /> : null}
        <div className="min-w-0">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          {description ? (
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>
          ) : null}
        </div>
      </summary>
      <div className="border-t border-gray-100 p-4">{children}</div>
    </details>
  );
}
