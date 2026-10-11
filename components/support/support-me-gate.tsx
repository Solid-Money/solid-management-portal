"use client";

import { Headphones, Loader2 } from "lucide-react";
import { useSupportMe } from "@/hooks/use-support";
import type { SupportMe } from "@/types/support";

/**
 * Loads the signed-in admin's support details (every admin is an agent),
 * then renders the support screen with them.
 */
export default function SupportMeGate({ children }: { children: (me: SupportMe) => React.ReactNode }) {
  const { data: me, isLoading, isError } = useSupportMe();
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (isError || !me) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg bg-white p-6 text-center shadow-sm">
        <Headphones className="mx-auto h-8 w-8 text-gray-400" />
        <h1 className="mt-3 text-lg font-semibold text-gray-900">Support is not available</h1>
        <p className="mt-1 text-sm text-gray-500">The support service did not answer. Try again in a moment.</p>
      </div>
    );
  }
  return <>{children(me)}</>;
}
