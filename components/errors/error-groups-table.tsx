"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Tag } from "lucide-react";

import {
  GroupStatusBadge,
  NewErrorBadge,
  RelativeTime,
  WhoActsBadge,
} from "@/components/errors/error-badges";
import { onRowKeyDown } from "@/components/errors/error-events-table";
import { Button } from "@/components/ui/button";
import {
  ERROR_FLOW_LABELS,
  ERROR_KEYS,
  getErrorGroups,
  labelFor,
  resolveRange,
  type ErrorGroupsQuery,
} from "@/lib/errors";
import { formatNumber } from "@/lib/utils";
import type { ErrorGroupRow } from "@/types/errors";

const TH_CLASS =
  "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";

const count = (value: number) => formatNumber(value, 0, 0);

interface ErrorGroupsTableProps {
  query: ErrorGroupsQuery;
  onPageChange: (page: number) => void;
  onOpen: (fingerprint: string, options?: { label?: boolean }) => void;
  /**
   * `summary` is the triage list; `label` is the queue of groups nobody has
   * explained yet, where the raw message is what the labeller works from.
   */
  variant?: "summary" | "label";
}

export function ErrorGroupsTable({
  query,
  onPageChange,
  onOpen,
  variant = "summary",
}: ErrorGroupsTableProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ERROR_KEYS.groups(query),
    queryFn: () => getErrorGroups(query, resolveRange(query.range)),
    placeholderData: keepPreviousData,
  });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error loading error groups. Please try again.
      </div>
    );
  }

  const labelQueue = variant === "label";
  const columnCount = labelQueue ? 6 : 7;
  const total = data?.meta.total ?? 0;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3 text-sm text-gray-500">
        <span>
          {labelQueue
            ? "Errors nobody has explained yet, most frequent first."
            : "Each row is one cause, with what to do about it."}
        </span>
        <span className="shrink-0">
          {count(total)} {total === 1 ? "group" : "groups"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={TH_CLASS}>
                {labelQueue ? "Error" : "Error and what to do"}
              </th>
              {!labelQueue && <th className={TH_CLASS}>Who acts</th>}
              <th className={TH_CLASS}>Flow</th>
              <th className={TH_CLASS}>Count</th>
              <th className={TH_CLASS}>Users</th>
              <th className={TH_CLASS}>Last seen</th>
              <th className={TH_CLASS}>{labelQueue ? "" : "Status"}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
                </td>
              </tr>
            ) : !data || data.data.length === 0 ? (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  {labelQueue
                    ? "Every error in this window has a label"
                    : "No errors in this window"}
                </td>
              </tr>
            ) : (
              data.data.map((group) => (
                <GroupRow
                  key={group.fingerprint}
                  group={group}
                  labelQueue={labelQueue}
                  onOpen={onOpen}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {data.meta.page} of {data.meta.totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              aria-label="Previous page"
              onClick={() => onPageChange(data.meta.page - 1)}
              disabled={data.meta.page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              onClick={() => onPageChange(data.meta.page + 1)}
              disabled={data.meta.page >= data.meta.totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupRow({
  group,
  labelQueue,
  onOpen,
}: {
  group: ErrorGroupRow;
  labelQueue: boolean;
  onOpen: ErrorGroupsTableProps["onOpen"];
}) {
  const open = () => onOpen(group.fingerprint, { label: labelQueue });

  return (
    <tr
      tabIndex={0}
      onClick={open}
      onKeyDown={onRowKeyDown(open)}
      className="cursor-pointer align-top hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
    >
      <td className="px-4 py-3 text-sm text-gray-900 max-w-xl">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{group.title}</span>
          {!group.labelled && !labelQueue && <NewErrorBadge />}
        </div>
        {labelQueue ? (
          // The labeller needs the raw text to say what it means; one line
          // of it is enough to recognise the error, the rest is in the drawer.
          <div
            className="mt-0.5 truncate font-mono text-xs text-gray-500"
            title={group.sampleMessage}
          >
            {group.code && <span className="mr-1.5 text-gray-700">{group.code}</span>}
            {group.sampleMessage ?? "No message recorded"}
          </div>
        ) : (
          <div className="mt-0.5 text-xs text-gray-500">{group.action}</div>
        )}
      </td>
      {!labelQueue && (
        <td className="px-4 py-3 whitespace-nowrap">
          <WhoActsBadge whoActs={group.whoActs} />
        </td>
      )}
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
        {labelFor(ERROR_FLOW_LABELS, group.flow)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm">
        <div
          className="font-medium text-gray-900 tabular-nums"
          title={`${count(group.count)} all-time`}
        >
          {count(group.countInRange)}
        </div>
        <div className="text-[10px] text-gray-400">
          {count(group.count)} all-time
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm">
        <div
          className="font-medium text-gray-900 tabular-nums"
          title={`${count(group.usersAffected)} all-time`}
        >
          {count(group.usersInRange)}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
        <RelativeTime iso={group.lastSeen} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {labelQueue ? (
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(group.fingerprint, { label: true });
            }}
          >
            <Tag />
            Label
          </Button>
        ) : (
          <GroupStatusBadge status={group.status} mutedUntil={group.mutedUntil} />
        )}
      </td>
    </tr>
  );
}
