"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Keeps one broken panel from taking the whole console down.
 *
 * Without a boundary here, any error thrown during render — a field the
 * backend renamed, a number that arrived null — escapes to Next's global
 * handler, which replaces the entire page with "Application error: a
 * client-side exception has occurred" and no way back. Support then cannot use
 * the console at all, over one bad value on one card.
 *
 * Inside the dashboard group, so the nav survives and the admin can navigate
 * away or retry. The message names the failure rather than hiding it: this
 * console reports on money, and quietly rendering around an error is worse
 * than saying a number could not be read.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render failed:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-red-100 bg-white p-6 text-center shadow-sm">
      <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
      <h2 className="mt-3 text-lg font-semibold text-gray-900">
        This page could not be rendered
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Something in the data for this page broke while drawing it. The rest of
        the console still works — the nav above will get you out.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-md bg-gray-50 p-3 text-left font-mono text-xs text-gray-700">
        {error.message || "Unknown error"}
      </pre>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-gray-400">
          digest {error.digest}
        </p>
      )}
      <Button onClick={reset} className="mt-4" variant="outline">
        <RotateCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
