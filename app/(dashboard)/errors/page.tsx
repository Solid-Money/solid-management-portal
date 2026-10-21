import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ErrorsPage from "@/components/errors/errors-page";

function ErrorsPageFallback() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
    </div>
  );
}

export default function ErrorsRoute() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Errors</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        What went wrong for users, grouped by cause.
      </p>
      {/* The page reads its filters from the query string. */}
      <Suspense fallback={<ErrorsPageFallback />}>
        <ErrorsPage />
      </Suspense>
    </div>
  );
}
