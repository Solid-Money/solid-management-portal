"use client";

import { useLiveStatus } from "@/hooks/use-live-card-transactions";

/**
 * Whether the card views on screen are updating by themselves, so support can
 * tell a quiet table from one that has stopped listening.
 */
export function LiveBadge() {
  const status = useLiveStatus();
  const live = status === "live";

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-gray-500"
      title={
        live
          ? "Updates as Rain and Wirex report transactions"
          : "Not receiving live updates — refreshes when you return to the page"
      }
    >
      <span
        className={`h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-gray-300"}`}
        aria-hidden
      />
      {live ? "Live" : "Not live"}
    </span>
  );
}
