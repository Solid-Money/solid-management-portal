"use client";

import { useState, useEffect } from "react";
import { Download, Loader2, UsersRound, RefreshCw, Play } from "lucide-react";
import {
  getLatestCohortSnapshots,
  getCohortEmails,
  triggerCohortSnapshots,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";

interface CohortSnapshot {
  cohortId: string;
  cohortName: string;
  description: string;
  count: number;
  usersWithEmail: number;
  date: string;
}

function downloadCsv(emails: string[], cohortName: string) {
  const csvContent = "email\n" + emails.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${cohortName.toLowerCase().replace(/\s+/g, "_")}_emails.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

export default function CohortsPage() {
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState<CohortSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingCohortId, setExportingCohortId] = useState<string | null>(
    null,
  );
  const [triggering, setTriggering] = useState(false);

  const fetchCohorts = async () => {
    try {
      setLoading(true);
      const response = await getLatestCohortSnapshots();
      setCohorts(response.data);
    } catch (error) {
      console.error("Failed to fetch cohorts:", error);
      toast.error("Failed to fetch cohorts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCohorts();
    }
  }, [user]);

  const handleExport = async (cohort: CohortSnapshot) => {
    try {
      setExportingCohortId(cohort.cohortId);
      const response = await getCohortEmails(cohort.cohortId);
      const { emails, cohortName } = response.data;

      if (emails.length === 0) {
        toast.error("No emails found for this cohort");
        return;
      }

      downloadCsv(emails, cohortName);
      toast.success(`Exported ${emails.length} emails from "${cohortName}"`);
    } catch (error) {
      console.error("Failed to export emails:", error);
      toast.error("Failed to export emails");
    } finally {
      setExportingCohortId(null);
    }
  };

  const handleTrigger = async () => {
    try {
      setTriggering(true);
      await triggerCohortSnapshots();
      toast.success("Cohort snapshots recalculated");
      await fetchCohorts();
    } catch (error) {
      console.error("Failed to trigger recalculation:", error);
      toast.error("Failed to trigger recalculation");
    } finally {
      setTriggering(false);
    }
  };

  const snapshotDate = cohorts.length > 0 ? cohorts[0].date : null;

  const formattedDate = snapshotDate
    ? new Date(snapshotDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cohorts</h1>
          <p className="text-sm text-gray-500 mt-1">
            View user cohorts and export email addresses
            {formattedDate && (
              <span className="ml-2 text-gray-400">
                • Snapshot from {formattedDate}
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleTrigger}
            disabled={triggering || loading}
            className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {triggering ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Recalculate
          </button>
          <button
            onClick={fetchCohorts}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : cohorts.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cohort
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  With Email
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cohorts.map((cohort) => (
                <tr key={cohort.cohortId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {cohort.cohortName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {cohort.description}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-gray-700">
                      <UsersRound className="h-4 w-4 mr-2 text-gray-400" />
                      {cohort.count.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      {cohort.usersWithEmail.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleExport(cohort)}
                      disabled={exportingCohortId === cohort.cohortId}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {exportingCohortId === cohort.cohortId ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-1.5" />
                      )}
                      Export Emails
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg py-20 flex flex-col items-center justify-center space-y-4">
          <UsersRound className="h-16 w-16 text-gray-400" />
          <p className="text-gray-500 text-lg">No cohort data available.</p>
          <p className="text-gray-400 text-sm">
            Cohort snapshots are generated daily at midnight. Try refreshing
            later.
          </p>
        </div>
      )}
    </div>
  );
}
