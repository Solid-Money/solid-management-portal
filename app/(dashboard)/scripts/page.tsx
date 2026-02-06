"use client";

import { useState } from "react";
import api from "@/lib/api";
import { Play, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function ScriptsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleTriggerCohort = async () => {
    try {
      setLoading(true);
      setResult(null);

      const response = await api.post("/admin/v1/cohort-snapshots/trigger", {});

      toast.success("Cohort snapshot calculation triggered successfully");
      setResult(response.data);
    } catch (error: any) {
      console.error("Failed to trigger snapshot:", error);
      toast.error(
        error.response?.data?.message || "Failed to trigger snapshot",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Scripts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Execute maintenance scripts and manual triggers.
          </p>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg p-6 max-w-2xl">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
          Cohort Snapshots
        </h3>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-md mb-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Description
            </h4>
            <p className="text-sm text-gray-600">
              This script analyzes all users in the system and categorizes them
              into cohorts based on their activity (deposits, card orders,
              payments, savings). It then saves a snapshot of these counts for
              the current day, which is used to populate the Metabase cohort
              charts.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Running this manually allows you to update the data for today if
              there have been recent user activities.
            </p>
          </div>

          <button
            onClick={handleTriggerCohort}
            disabled={loading}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Trigger Calculation
              </>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              Calculation Results
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.snapshots?.map((snapshot: any) => (
                <div
                  key={`${snapshot.date}-${snapshot.cohortId}`}
                  className="bg-gray-50 overflow-hidden rounded-lg border border-gray-200"
                >
                  <div className="px-4 py-4 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {snapshot.cohortName}
                    </dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">
                      {snapshot.count}
                    </dd>
                    <p className="mt-1 text-sm text-gray-500">
                      {snapshot.usersWithEmail} users with email
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Raw Response
              </h4>
              <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-auto text-xs max-h-60">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
