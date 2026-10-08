"use client";

import { Loader2 } from "lucide-react";

import { AntiAbuseConfigEditor } from "@/components/config/anti-abuse-config";
import { useAntiAbuseConfig } from "@/hooks/use-anti-abuse";

/**
 * Config → Anti-abuse: which purchases earn no card cashback and don't count
 * toward the referral target, and what a referred friend's purchase must be to
 * count.
 *
 * One list for both programmes, with a switch per programme on each entry, so
 * a merchant blocked for cashback cannot keep clearing the referral target —
 * which is where the farming money was.
 */
export default function AntiAbusePage() {
  const { data, isLoading, error } = useAntiAbuseConfig();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Anti-abuse</h1>
        <p className="mt-1 text-sm text-gray-500">
          Merchants and categories that earn no card cashback and don&apos;t
          count toward the referral target, and the rules a referred
          friend&apos;s purchases must meet. Changes apply to new purchases and
          to every referral reward not yet paid, within 5 minutes of saving.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Could not load the anti-abuse settings.
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
        </div>
      ) : null}

      {data ? <AntiAbuseConfigEditor config={data} /> : null}
    </div>
  );
}
