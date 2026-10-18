import { Suspense } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import FailedCashbackResend from "@/components/cashback/failed-cashback-resend";

export default function FailedCashbackPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <RefreshCw className="h-5 w-5 text-gray-400" />
          Failed cashback
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Re-send cashback that gave up after five payout attempts, for many
          users at once. It is the same &ldquo;Re-send failed&rdquo; as on a
          user&apos;s page: rows go back in the retry queue and the retry job
          pays them, with the frozen-card, monthly-cap and debt checks. Nothing
          is sent from this page, so a row cannot be paid twice.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        }
      >
        <FailedCashbackResend />
      </Suspense>
    </div>
  );
}
