import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import AppPerformancePage from "@/components/app-performance/app-performance-page";

function AppPerformancePageFallback() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
    </div>
  );
}

export default function AppPerformanceRoute() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">App performance</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        How long the app&apos;s home screen takes to show balances at launch and
        on coming back to it, and what holds it up.
      </p>
      {/* The page reads its filters from the query string. */}
      <Suspense fallback={<AppPerformancePageFallback />}>
        <AppPerformancePage />
      </Suspense>
    </div>
  );
}
