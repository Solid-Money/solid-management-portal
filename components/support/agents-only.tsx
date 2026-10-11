"use client";

import { Headphones, Loader2 } from "lucide-react";
import { useSupportMe } from "@/hooks/use-support";
import type { SupportMe } from "@/types/support";

/** Renders its children for support agents; everyone else gets an explanation. */
export default function AgentsOnly({ children }: { children: (me: SupportMe) => React.ReactNode }) {
  const { data: me, isLoading, isError } = useSupportMe();
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (isError || !me?.agent) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg bg-white p-6 text-center shadow-sm">
        <Headphones className="mx-auto h-8 w-8 text-gray-400" />
        <h1 className="mt-3 text-lg font-semibold text-gray-900">Support is for support agents</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isError
            ? "The support service did not answer. Try again in a moment."
            : "Customer conversations are only shown to agents. Ask to have your email added to SUPPORT_AGENT_EMAILS."}
        </p>
      </div>
    );
  }
  return <>{children(me)}</>;
}
