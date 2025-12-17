import ReferralLookup from "@/components/referral-lookup";

export default function ReferralsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          Referral Lookup
        </h1>
      </div>
      <ReferralLookup />
    </div>
  );
}
