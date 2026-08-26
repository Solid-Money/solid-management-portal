"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ChevronDown,
  Download,
  Loader2,
  Play,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import {
  getLatestCohortSnapshots,
  getCohortEmails,
  triggerCohortSnapshots,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import {
  COHORT_GROUP_META,
  CohortGroup,
  CohortSnapshot,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/** Order the sections are rendered in; inactive always last. */
const GROUP_ORDER: CohortGroup[] = ["general", "rain", "wirex", "inactive"];

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

/**
 * Which section a cohort belongs to.
 *
 * Snapshots taken before cohorts were grouped carry neither field. They are
 * genuinely the general funnel cohorts, so they read as active and general
 * rather than disappearing into "Inactive" until the next nightly run.
 */
function groupOf(cohort: CohortSnapshot): CohortGroup {
  if (cohort.active === false) return "inactive";
  return cohort.group && cohort.group !== "inactive" ? cohort.group : "general";
}

function CohortTable({
  cohorts,
  exportingCohortId,
  onExport,
}: {
  cohorts: CohortSnapshot[];
  exportingCohortId: string | null;
  onExport: (cohort: CohortSnapshot) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Cohort
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Total Users
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              With Email
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {cohorts.map((cohort) => (
            <tr key={cohort.cohortId} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <p className="text-sm font-medium text-gray-900">
                  {cohort.cohortName}
                </p>
                <p className="text-xs text-gray-500">{cohort.description}</p>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center text-sm text-gray-700">
                  <UsersRound className="mr-2 h-4 w-4 text-gray-400" />
                  {cohort.count.toLocaleString()}
                </div>
              </td>
              <td className="px-6 py-4">
                <Badge variant="success">
                  {cohort.usersWithEmail.toLocaleString()}
                </Badge>
              </td>
              <td className="px-6 py-4 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onExport(cohort)}
                  disabled={exportingCohortId === cohort.cohortId}
                  className="cursor-pointer text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {exportingCohortId === cohort.cohortId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export Emails
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A section of cohorts. Inactive cohorts start collapsed: they are retired
 * programs kept only because their email exports are occasionally still
 * needed, and they crowded out the live ones when everything shared one table.
 */
function CohortSection({
  group,
  cohorts,
  exportingCohortId,
  onExport,
}: {
  group: CohortGroup;
  cohorts: CohortSnapshot[];
  exportingCohortId: string | null;
  onExport: (cohort: CohortSnapshot) => void;
}) {
  const isInactive = group === "inactive";
  const [open, setOpen] = useState(!isInactive);
  const meta = COHORT_GROUP_META[group];
  const totalUsers = cohorts.reduce((sum, cohort) => sum + cohort.count, 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <CollapsibleTrigger className="flex w-full items-center gap-3 text-left cursor-pointer">
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-gray-400 transition-transform",
            !open && "-rotate-90"
          )}
        />
        <div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2
            className={cn(
              "text-lg font-semibold",
              isInactive ? "text-gray-500" : "text-gray-900"
            )}
          >
            {meta.label}
          </h2>
          <span className="text-sm text-gray-500">{meta.description}</span>
        </div>
        <Badge variant={isInactive ? "muted" : "secondary"}>
          {cohorts.length} {cohorts.length === 1 ? "cohort" : "cohorts"} ·{" "}
          {totalUsers.toLocaleString()} users
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <CohortTable
          cohorts={cohorts}
          exportingCohortId={exportingCohortId}
          onExport={onExport}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function CohortsPage() {
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState<CohortSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingCohortId, setExportingCohortId] = useState<string | null>(
    null
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

  const grouped = useMemo(() => {
    const byGroup = new Map<CohortGroup, CohortSnapshot[]>();
    for (const cohort of cohorts) {
      const group = groupOf(cohort);
      byGroup.set(group, [...(byGroup.get(group) ?? []), cohort]);
    }
    return GROUP_ORDER.filter((group) => (byGroup.get(group)?.length ?? 0) > 0).map(
      (group) => ({ group, cohorts: byGroup.get(group)! })
    );
  }, [cohorts]);

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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cohorts</h1>
          <p className="mt-1 text-sm text-gray-500">
            View user cohorts and export email addresses
            {formattedDate && (
              <span className="ml-2 text-gray-400">
                • Snapshot from {formattedDate}
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleTrigger}
            disabled={triggering || loading}
            className="cursor-pointer bg-amber-600 hover:bg-amber-700"
          >
            {triggering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Recalculate
          </Button>
          <Button
            onClick={fetchCohorts}
            disabled={loading}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-700"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : grouped.length > 0 ? (
        <div className="space-y-8">
          {grouped.map(({ group, cohorts: groupCohorts }) => (
            <CohortSection
              key={group}
              group={group}
              cohorts={groupCohorts}
              exportingCohortId={exportingCohortId}
              onExport={handleExport}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-lg bg-white py-20 shadow">
          <UsersRound className="h-16 w-16 text-gray-400" />
          <p className="text-lg text-gray-500">No cohort data available.</p>
          <p className="text-sm text-gray-400">
            Cohort snapshots are generated daily at midnight. Try refreshing
            later.
          </p>
        </div>
      )}
    </div>
  );
}
