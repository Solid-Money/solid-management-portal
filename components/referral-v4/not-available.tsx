import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The muted state a referral v4 screen shows when the backend it reads has not
 * shipped the endpoint yet (404 / 503). Expected during rollout — the portal
 * deploys ahead of the services — so it reads as "later", not as an error.
 */
export function NotAvailableYet({
  what,
  className,
}: {
  /** What isn't available, e.g. "Card credit". */
  what?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500",
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span>
        Not available yet
        {what ? ` — ${what} isn't served by this backend yet.` : "."}
      </span>
    </div>
  );
}

export default NotAvailableYet;
