import { Suspense } from "react";
import ReferralLookup from "@/components/referral-lookup";
import { Loader2 } from "lucide-react";

function ReferralLookupFallback() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
    </div>
  );
}

export default function ReferralsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          Referral Lookup
        </h1>
      </div>
      <Suspense fallback={<ReferralLookupFallback />}>
        <ReferralLookup />
      </Suspense>
    </div>
  );
}
