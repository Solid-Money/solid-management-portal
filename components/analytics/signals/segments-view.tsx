"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { getLatestCohortSnapshots } from "@/lib/api";
import { NotInstrumented } from "@/components/analytics/not-instrumented";
import { Panel } from "@/components/analytics/panel";
import { formatDateTime, formatNumber } from "@/lib/utils";

/**
 * The six behavioural segments the spec defines.
 *
 * Listed here so the panel can say which ones the nightly cohort job does not
 * yet produce. Matching is by cohort id substring rather than exact equality,
 * because the job's ids group by product (`rain`, `wirex`, `inactive`) and the
 * behavioural segments will be added alongside them.
 */
const BEHAVIOURAL_SEGMENTS = [
  {
    id: "genuine-spender",
    label: "Genuine spender",
    description: "Deposits, spends across merchants, keeps a balance.",
  },
  {
    id: "farmer",
    label: "Farmer",
    description: "Behaviour shaped by the incentive rather than by using the product.",
  },
  {
    id: "cash-out-loop",
    label: "Cash-out loop",
    description: "Deposits and withdraws in a short cycle without spending.",
  },
  {
    id: "card-withdrawer-no-spend",
    label: "Card withdrawer, no spend",
    description: "Moves money onto the card and takes it off without purchases.",
  },
  {
    id: "never-funded",
    label: "Never funded",
    description: "Signed up and completed KYC, never deposited.",
  },
  {
    id: "dormant",
    label: "Dormant",
    description: "Was active, has not transacted inside the activity window.",
  },
] as const;

interface CohortSnapshot {
  cohortId: string;
  name?: string;
  group?: string;
  userCount?: number;
  snapshotAt?: string;
}

/**
 * Segments v0.
 *
 * Reads the cohort snapshots the nightly job already writes and links through
 * to `/cohorts`, which stays the action surface — this tab is for reading the
 * distribution, that page is for exporting a slice and sending to it. The six
 * behavioural segments need adding to the backend job before they appear here,
 * so they are listed as uninstrumented rather than omitted.
 */
export function SignalsSegmentsView() {
  const { data, isLoading, error } = useQuery<{ cohorts?: CohortSnapshot[] }>({
    queryKey: ["cohort-snapshots", "latest"],
    queryFn: async () => {
      const response = await getLatestCohortSnapshots();
      return response.data;
    },
  });

  const cohorts = data?.cohorts ?? [];

  const matched = BEHAVIOURAL_SEGMENTS.map((segment) => ({
    ...segment,
    snapshot: cohorts.find(
      (cohort) =>
        cohort.cohortId?.toLowerCase().includes(segment.id) ||
        cohort.name?.toLowerCase().includes(segment.label.toLowerCase())
    ),
  }));

  const missing = matched.filter((segment) => !segment.snapshot);

  return (
    <div className="space-y-6">
      <Panel
        title="Behavioural segments"
        question="Which behaviour is each funded user showing?"
        source="database"
        updatedAt={cohorts[0]?.snapshotAt}
        isLoading={isLoading}
        error={error}
        actions={
          <Link
            href="/cohorts"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            Export a cohort
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-4">Segment</th>
                  <th className="py-2 pr-4">What it means</th>
                  <th className="py-2 text-right">Users</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matched.map((segment) => (
                  <tr
                    key={segment.id}
                    className={segment.snapshot ? undefined : "bg-gray-50/60"}
                  >
                    <td className="py-2 pr-4 font-medium text-gray-900">
                      {segment.label}
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-500">
                      {segment.description}
                    </td>
                    <td className="py-2 text-right">
                      {segment.snapshot ? (
                        <span className="text-gray-700">
                          {formatNumber(segment.snapshot.userCount ?? 0, 0, 0)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Not instrumented
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {missing.length > 0 ? (
            <NotInstrumented
              metric={`${missing.length} of ${BEHAVIOURAL_SEGMENTS.length} segments`}
              reason="The nightly cohort job does not produce these segments yet. Adding them to the backend job is what fills these rows — nothing is needed on this page."
              phase={3}
            />
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Cohort snapshots as they stand today"
        question="Which cohorts does the nightly job currently produce?"
        source="database"
        updatedAt={cohorts[0]?.snapshotAt}
        isLoading={isLoading}
        error={error}
      >
        {cohorts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-4">Cohort</th>
                  <th className="py-2 pr-4">Group</th>
                  <th className="py-2 pr-4 text-right">Users</th>
                  <th className="py-2 text-right">Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cohorts.map((cohort) => (
                  <tr key={cohort.cohortId}>
                    <td className="py-2 pr-4 text-gray-900">
                      {cohort.name ?? cohort.cohortId}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">
                      {cohort.group ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700">
                      {formatNumber(cohort.userCount ?? 0, 0, 0)}
                    </td>
                    <td className="py-2 text-right text-gray-500">
                      {cohort.snapshotAt
                        ? formatDateTime(cohort.snapshotAt)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            No cohort snapshots have been taken yet.
          </div>
        )}
      </Panel>
    </div>
  );
}

export default SignalsSegmentsView;
