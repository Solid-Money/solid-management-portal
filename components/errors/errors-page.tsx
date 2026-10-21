"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { ErrorDrawer } from "@/components/errors/error-drawer";
import { ErrorFeed } from "@/components/errors/error-feed";
import { ErrorFiltersBar } from "@/components/errors/error-filters";
import { ErrorGroupsTable } from "@/components/errors/error-groups-table";
import { ErrorSummary } from "@/components/errors/error-summary";
import { useLiveFeedState } from "@/components/errors/live-feed-state";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useErrorsViewState,
  type ErrorsTab,
} from "@/hooks/use-errors-view-state";
import {
  useErrorsLiveStatus,
  useErrorsLiveSwitch,
  useLiveErrors,
} from "@/hooks/use-live-errors";
import {
  applyGroupUpdate,
  ERROR_KEYS,
  matchesErrorFilters,
  patchCachedGroup,
  type ErrorEventsPage,
  type ErrorEventsQuery,
  type ErrorGroupsQuery,
} from "@/lib/errors";
import type { ErrorsLiveStatus } from "@/lib/realtime";
import { formatDateTime } from "@/lib/utils";
import type { ErrorEventRow } from "@/types/errors";

/** The tiles re-read at most this often while errors stream in. */
const STATS_REFRESH_MS = 10_000;

/**
 * Whether the top of the feed is on screen, so a new row can go in without
 * shifting what the reader is looking at.
 */
const isAtTop = (element: HTMLElement | null) =>
  !element || element.getBoundingClientRect().top >= -40;

const STATUS_DISPLAY: Record<
  ErrorsLiveStatus | "paused",
  { label: string; dot: string; hint: string }
> = {
  live: {
    label: "Live",
    dot: "bg-green-500",
    hint: "New errors appear as they happen",
  },
  reconnecting: {
    label: "Reconnecting…",
    dot: "bg-amber-500",
    hint: "The live connection dropped; catching up when it is back",
  },
  paused: {
    label: "Paused",
    dot: "bg-gray-300",
    hint: "Live updates are off; refresh to see new errors",
  },
  offline: {
    label: "Offline",
    dot: "bg-gray-300",
    hint: "Not receiving live updates",
  },
};

function LiveControl({
  on,
  status,
  onChange,
}: {
  on: boolean;
  status: ErrorsLiveStatus;
  onChange: (next: boolean) => void;
}) {
  const display = STATUS_DISPLAY[on ? status : "paused"];
  return (
    <div className="flex items-center gap-3">
      <span
        role="status"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500"
        title={display.hint}
      >
        <span className={`h-2 w-2 rounded-full ${display.dot}`} aria-hidden />
        {display.label}
      </span>
      <label
        htmlFor="errors-live-switch"
        className="text-sm font-medium text-gray-700 cursor-pointer"
      >
        Live
      </label>
      <Switch id="errors-live-switch" checked={on} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * The Errors page: what went wrong for users, by cause (Summary), as it
 * happens (Feed), and what nobody has explained yet (Needs a label).
 *
 * The page owns the live connection rather than the feed, because a live
 * error moves all three tabs: it lands in the feed, bumps its group's row and
 * nudges the tiles. Filters, tab and the open group live in the URL.
 */
export default function ErrorsPage() {
  const queryClient = useQueryClient();
  const { state, update } = useErrorsViewState();
  const [liveOn, setLiveOn] = useErrorsLiveSwitch();
  const liveStatus = useErrorsLiveStatus();
  // When the data on screen stopped moving: the pause, or the last refresh.
  const [pausedAt, setPausedAt] = useState(() => Date.now());
  // The drawer opens from local state rather than waiting on a navigation;
  // the URL follows it, so an open group can be linked to.
  const [openGroupId, setOpenGroupId] = useState<string | null>(
    () => state.group ?? null
  );
  const [occurrence, setOccurrence] = useState<ErrorEventRow | null>(null);
  const [labelMode, setLabelMode] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsReadAt = useRef(0);

  const filters = useMemo<ErrorEventsQuery>(
    () => ({
      range: state.range,
      source: state.source,
      flow: state.flow,
      whoActs: state.whoActs,
      severity: state.severity,
      platform: state.platform,
      user: state.user,
      q: state.q,
    }),
    [
      state.range,
      state.source,
      state.flow,
      state.whoActs,
      state.severity,
      state.platform,
      state.user,
      state.q,
    ]
  );

  const summaryQuery: ErrorGroupsQuery = {
    ...filters,
    status: state.status,
    sort: state.sort,
    order: "desc",
    page: state.page,
  };
  const labelQuery: ErrorGroupsQuery = {
    ...filters,
    labelled: false,
    sort: "count",
    order: "desc",
    page: state.page,
  };

  const { live, addEvent, showPending, setBurst, markRefreshed } =
    useLiveFeedState(JSON.stringify(filters));

  useEffect(
    () => () => {
      if (statsTimer.current) clearTimeout(statsTimer.current);
    },
    []
  );

  /** Re-read the tiles, at most once per `STATS_REFRESH_MS`. */
  const refreshStatsSoon = () => {
    if (statsTimer.current) return;
    const wait = Math.max(
      0,
      STATS_REFRESH_MS - (Date.now() - statsReadAt.current)
    );
    statsTimer.current = setTimeout(() => {
      statsTimer.current = null;
      statsReadAt.current = Date.now();
      void queryClient.invalidateQueries({ queryKey: ["errors", "stats"] });
    }, wait);
  };

  /**
   * The user ids the server resolved a `user` filter to, read off the feed it
   * returned — the filter may be an email, which no live row carries.
   */
  const resolvedUserIds = () => {
    if (!filters.user) return undefined;
    const feed = queryClient.getQueryData<InfiniteData<ErrorEventsPage>>(
      ERROR_KEYS.events(filters)
    );
    const ids = new Set<string>();
    feed?.pages.forEach((page) =>
      page.data.forEach((row) => row.userId && ids.add(row.userId))
    );
    return ids;
  };

  const refresh = () => {
    markRefreshed();
    setPausedAt(Date.now());
    void queryClient.invalidateQueries({ queryKey: ERROR_KEYS.all });
  };

  useLiveErrors(liveOn, {
    onEvent: (row) => {
      if (!matchesErrorFilters(row, filters, resolvedUserIds())) return;
      // Off the feed tab nobody is reading it, so there is nothing to keep
      // still: straight in.
      addEvent(row, state.tab !== "feed" || isAtTop(feedRef.current));
      refreshStatsSoon();
    },
    onGroupUpdate: (groupUpdate) => {
      patchCachedGroup(queryClient, groupUpdate.fingerprint, (row) =>
        applyGroupUpdate(row, groupUpdate)
      );
      refreshStatsSoon();
    },
    onBurst: setBurst,
    onResync: refresh,
  });

  const toggleLive = (next: boolean) => {
    setLiveOn(next);
    // Back on: catch up on whatever happened while it was off.
    if (next) refresh();
    else setPausedAt(Date.now());
  };

  const openGroup = (
    fingerprint: string,
    options: { occurrence?: ErrorEventRow; label?: boolean } = {}
  ) => {
    setOpenGroupId(fingerprint);
    setOccurrence(options.occurrence ?? null);
    setLabelMode(!!options.label);
    update({ group: fingerprint });
  };

  const closeGroup = () => {
    setOpenGroupId(null);
    setOccurrence(null);
    setLabelMode(false);
    update({ group: undefined });
  };

  const showNewErrors = () => {
    showPending();
    feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4">
      <Tabs
        value={state.tab}
        onValueChange={(tab) => update({ tab: tab as ErrorsTab })}
        className="gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="feed">Feed</TabsTrigger>
            <TabsTrigger value="label">Needs a label</TabsTrigger>
          </TabsList>
          <LiveControl on={liveOn} status={liveStatus} onChange={toggleLive} />
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <ErrorFiltersBar
            state={state}
            update={update}
            showGroupControls={state.tab === "summary"}
          />
        </div>

        {!liveOn && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
            <span>
              Paused. Showing data up to{" "}
              {formatDateTime(pausedAt, {
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              })}
              .
            </span>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer bg-white"
              onClick={refresh}
            >
              <RefreshCw />
              Refresh
            </Button>
          </div>
        )}

        <TabsContent value="summary">
          <ErrorSummary
            state={state}
            groupsQuery={summaryQuery}
            onPageChange={(page) => update({ page })}
            onOpen={(fingerprint) => openGroup(fingerprint)}
          />
        </TabsContent>

        <TabsContent value="feed">
          <ErrorFeed
            filters={filters}
            live={live}
            liveOn={liveOn}
            containerRef={feedRef}
            onShowPending={showNewErrors}
            onRefresh={refresh}
            onOpen={(row) => openGroup(row.fingerprint, { occurrence: row })}
          />
        </TabsContent>

        <TabsContent value="label">
          <ErrorGroupsTable
            variant="label"
            query={labelQuery}
            onPageChange={(page) => update({ page })}
            onOpen={(fingerprint, options) => openGroup(fingerprint, options)}
          />
        </TabsContent>
      </Tabs>

      <ErrorDrawer
        fingerprint={openGroupId}
        range={state.range}
        occurrence={occurrence}
        labelMode={labelMode}
        onClose={closeGroup}
      />
    </div>
  );
}
