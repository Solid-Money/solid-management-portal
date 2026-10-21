"use client";

import { useId, useState } from "react";

import { ErrorDrawer } from "@/components/errors/error-drawer";
import {
  ErrorEventsTable,
  LoadMoreFooter,
} from "@/components/errors/error-events-table";
import { useErrorEventPages } from "@/hooks/use-error-event-pages";
import {
  ERROR_KEYS,
  getUserErrors,
  RANGE_PRESETS,
  type RangePreset,
} from "@/lib/errors";
import type { ErrorEventRow } from "@/types/errors";

const PAGE_SIZE = 25;

/**
 * Everything that went wrong for one user, for the support conversation that
 * starts with "the app keeps failing": the same rows and drawer as the Errors
 * page, over a month by default since a ticket is rarely about the last hour.
 */
export default function UserErrors({ userId }: { userId: string }) {
  const rangeId = useId();
  const [range, setRange] = useState<RangePreset>("30d");
  const [selected, setSelected] = useState<ErrorEventRow | null>(null);

  const { query, rows } = useErrorEventPages(
    ERROR_KEYS.user(userId, { range }),
    range,
    (window, cursor) => getUserErrors(userId, window, cursor, PAGE_SIZE)
  );

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Errors</h2>
        <div className="flex items-center gap-2">
          <label htmlFor={rangeId} className="text-xs font-medium text-gray-500">
            Time
          </label>
          <select
            id={rangeId}
            value={range}
            onChange={(event) =>
              setRange(
                RANGE_PRESETS.find((preset) => preset.id === event.target.value)
                  ?.id ?? "30d"
              )
            }
            className="block h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {RANGE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ErrorEventsTable
        compact
        rows={rows}
        isLoading={query.isLoading}
        isError={query.isError}
        emptyMessage="Nothing went wrong for this user in this window"
        onOpen={setSelected}
        footer={
          <LoadMoreFooter
            shown={rows.length}
            hasMore={query.hasNextPage}
            isLoadingMore={query.isFetchingNextPage}
            onLoadMore={() => void query.fetchNextPage()}
          />
        }
      />

      <ErrorDrawer
        fingerprint={selected?.fingerprint ?? null}
        range={range}
        occurrence={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
