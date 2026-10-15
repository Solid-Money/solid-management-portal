import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import ErrorLookup from "@/components/error-lookup";

export default function ErrorLookupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Error lookup</h1>
        <p className="mt-1 text-sm text-gray-500">
          Trace the Ref on a user&apos;s failure screen to what happened, for whom, and where to
          read more.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        }
      >
        <ErrorLookup />
      </Suspense>
    </div>
  );
}
