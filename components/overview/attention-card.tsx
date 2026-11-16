"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAttention } from "@/hooks/use-attention";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { useTaskList, useTaskPeople } from "@/hooks/use-tasks";
import { describeApiError } from "@/lib/api";
import { TONE_CLASSES, levelBadge } from "@/lib/attention";
import {
  type RadarTask,
  cardSummary,
  closedLine,
  quietLabel,
  refreshFailure,
  tasksHref,
} from "@/lib/attention-tasks";
import { personName } from "@/lib/task-format";
import { Avatar } from "@/components/tasks/task-format";
import type { AttentionItemView } from "@/types/radar";
import type { TaskPerson } from "@/types/tasks";
import { OverviewCard } from "@/components/overview/overview-ui";
import { AttentionDetail } from "@/components/overview/attention-detail";

type View = "tasks" | "quiet" | "check" | "watching";

const LIST_TITLES: Record<View, string> = {
  tasks: "Most urgent",
  quiet: "Quiet for 24 h or more",
  check: "To check",
  watching: "Watching",
};

const LIST_HINTS: Record<View, string> = {
  tasks: "Incidents, then what is happening now or today, by people hit",
  quiet: "No update from a person in a day or more",
  check: "A task opens if it is still the case at the time shown",
  watching: "Seen by the radar, not anyone's work yet",
};

/** Rows shown before "N more"; the rest are in Tasks. */
const SHOWN = 3;

/**
 * Needs your attention, once Tasks is the work queue. The radar opens one
 * task per problem and keeps it current; this card only says whether
 * anything needs you: four counts, the most urgent open tasks with their
 * owner and how long since a person wrote on them, and what closed on its
 * own. The work itself (owners, updates, outcomes) happens in Tasks.
 *
 * `?item=<id>` still opens that alert's view (the links in radar tasks), with
 * its timeline, app notice and actions.
 */
export function AttentionCard() {
  const [view, setView] = useState<View>("tasks");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const linked = params.get("item");
  const linkedId = linked && /^[a-f0-9]{24}$/i.test(linked) ? linked : null;
  const [openId, setOpenId] = useState<string | null>(linkedId);
  // Another ?item= link followed while here opens that one (set during
  // render when the link changes, not in an effect).
  const [seenLinked, setSeenLinked] = useState(linkedId);
  if (seenLinked !== linkedId) {
    setSeenLinked(linkedId);
    if (linkedId) setOpenId(linkedId);
    // The link went away (back button): close what it opened, not one opened by hand.
    else if (openId === seenLinked) setOpenId(null);
  }
  const closeItem = () => {
    setOpenId(null);
    if (!params.has("item")) return;
    const next = new URLSearchParams(params.toString());
    next.delete("item");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const radar = useAttention("all");
  const taskList = useTaskList({ view: "radar" });
  const { data: people } = useTaskPeople();
  const clock = useMinuteClock();

  // Open tasks come in one page of up to 1,000 (the API ignores paging for
  // open views); past that the counts read "1000+" rather than undercount.
  const firstPage = taskList.data?.pages[0];
  const rows = firstPage?.rows ?? [];
  const capped = !!firstPage?.hasMore;
  const count = (n: number) => (capped ? `${n}+` : n);
  const ready = !!radar.data && !!taskList.data && clock !== null;
  const nowIso = clock !== null ? new Date(clock).toISOString() : null;
  const summary =
    ready && nowIso
      ? cardSummary(rows, radar.data!.items, radar.data!.resolved, nowIso)
      : null;
  const live = radar.data?.summary.liveIncidents ?? 0;
  const error = radar.error ?? taskList.error;
  // A failed refresh keeps the last good data on screen: say which is behind.
  const behind = [
    radar.error && radar.data
      ? refreshFailure(
          "the radar",
          describeApiError(radar.error),
          radar.dataUpdatedAt,
        )
      : null,
    taskList.error && taskList.data
      ? refreshFailure(
          "Tasks",
          describeApiError(taskList.error),
          taskList.dataUpdatedAt,
        )
      : null,
  ].filter(Boolean) as string[];

  return (
    <OverviewCard className="px-5 pt-4 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-gray-900">
            Needs your attention
          </h2>
          {radar.data ? (
            live > 0 ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium",
                  TONE_CLASSES["solid-red"],
                )}
              >
                {live} live incident{live === 1 ? "" : "s"}
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium",
                  TONE_CLASSES.green,
                )}
              >
                <span className="size-[6px] rounded-full bg-[#16a34a]" />
                No live incidents
              </span>
            )
          ) : null}
        </div>
        <Link
          href={tasksHref()}
          className="text-[13px] font-medium whitespace-nowrap text-[#3b3bd6] hover:underline"
        >
          Open in Tasks →
        </Link>
      </div>

      {error && !summary ? (
        <p className="mt-3 text-[13px] text-red-700">
          Could not load: {describeApiError(error)}.
        </p>
      ) : null}
      {!summary && !error ? (
        <p className="mt-3 text-[13px] text-gray-400">Loading…</p>
      ) : null}
      {summary && behind.length ? (
        <p role="status" className="mt-2 text-[12px] text-[#b45309]">
          {behind.join(" · ")}
        </p>
      ) : null}

      {summary ? (
        <>
          <div className="mt-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Tile
              label="Open tasks"
              count={count(summary.tasks.length)}
              sub={[
                summary.tasks.length
                  ? `${summary.byCategory} · ${
                      summary.unassigned
                        ? `${summary.unassigned} with no owner`
                        : "each has an owner"
                    }`
                  : "Nothing open from the radar",
                summary.untasked.length
                  ? `${summary.untasked.length} alert${summary.untasked.length === 1 ? "" : "s"} not in a task shown here`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              active={view === "tasks"}
              onClick={() => setView("tasks")}
            />
            <Tile
              label="Quiet for 24 h+"
              count={count(summary.quiet.length)}
              sub="No update from a person in a day or more"
              warn={summary.quiet.length > 0}
              active={view === "quiet"}
              onClick={() => setView("quiet")}
            />
            <Tile
              label="To check"
              count={summary.toCheck.length}
              sub={
                summary.toCheck.length
                  ? summary.toCheck.map((i) => i.title).join(" · ")
                  : "Nothing waiting for a check"
              }
              active={view === "check"}
              onClick={() => setView("check")}
            />
            <Tile
              label="Watching"
              count={summary.watching.length}
              sub={
                summary.watching.length
                  ? summary.watching.map((i) => i.title).join(" · ")
                  : "Nothing on watch"
              }
              active={view === "watching"}
              onClick={() => setView("watching")}
            />
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-3 pb-2">
              <span className="text-[11px] font-semibold tracking-[0.5px] text-gray-400 uppercase">
                {LIST_TITLES[view]}
              </span>
              <span className="hidden text-[11.5px] text-gray-400 sm:inline">
                {LIST_HINTS[view]}
              </span>
            </div>
            <List
              view={view}
              summary={summary}
              people={people}
              onOpenItem={setOpenId}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef0f4] pt-2.5 text-[11.5px] text-gray-400">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="size-[6px] shrink-0 rounded-full bg-[#16a34a]" />
              <span className="truncate">
                {[
                  closedLine(summary.closedOnOwn),
                  "checks every 5 min",
                  radar.data?.lastCheckAt
                    ? `last ${radar.data.lastCheckAt.slice(11, 16)} UTC`
                    : "not checked yet",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </div>
        </>
      ) : null}

      <AttentionDetail id={openId} onClose={closeItem} />
    </OverviewCard>
  );
}

function Tile({
  label,
  count,
  sub,
  warn,
  active,
  onClick,
}: {
  label: string;
  count: number | string;
  sub: string;
  warn?: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-w-0 flex-col rounded-[10px] border px-3.5 pt-3 pb-3.5 text-left transition-colors",
        active
          ? "border-gray-900 bg-white"
          : "border-[#eef0f4] bg-[#fafbfc] hover:border-gray-300",
      )}
    >
      <span className="flex items-center justify-between text-[12.5px] font-medium text-gray-600">
        {label}
        <ArrowRight
          className={cn("size-3.5", active ? "text-gray-900" : "text-gray-400")}
        />
      </span>
      <span
        className={cn(
          "mt-1 text-[26px] leading-8 font-semibold",
          warn ? "text-[#b45309]" : "text-gray-900",
        )}
      >
        {count}
      </span>
      <span className="mt-1 line-clamp-2 text-[12px] leading-4 text-gray-500">
        {sub}
      </span>
    </button>
  );
}

function List({
  view,
  summary,
  people,
  onOpenItem,
}: {
  view: View;
  summary: NonNullable<ReturnType<typeof cardSummary>>;
  people: TaskPerson[] | undefined;
  onOpenItem: (id: string) => void;
}) {
  if (view === "check" || view === "watching") {
    const alerts = view === "check" ? summary.toCheck : summary.watching;
    if (!alerts.length)
      return (
        <p className="border-t border-[#f0f1f5] py-3 text-[13px] text-gray-500">
          {view === "check"
            ? "Nothing waiting for a check."
            : "Nothing on watch."}
        </p>
      );
    return (
      <div>
        {alerts.map((item) => (
          <AlertRow
            key={item.id}
            item={item}
            onOpen={() => onOpenItem(item.id)}
          />
        ))}
      </div>
    );
  }

  const tasks = view === "quiet" ? summary.quiet : summary.tasks;
  // Escalated alerts in no task you can see come first: never hidden.
  const untasked = view === "tasks" ? summary.untasked : [];
  // Three task slots whatever else shows: an incident task is never pushed out.
  const shownTasks = tasks.slice(0, SHOWN);
  const rest = tasks.slice(shownTasks.length);
  if (!tasks.length && !untasked.length)
    return (
      <p className="flex items-center gap-2 border-t border-[#f0f1f5] py-3 text-[13px] text-gray-600">
        <span className="size-[7px] rounded-full bg-[#16a34a]" />
        {view === "quiet"
          ? "Every open task had an update today."
          : "Nothing needs attention."}
      </p>
    );
  return (
    <div>
      {untasked.map((item) => (
        <AlertRow
          key={item.id}
          item={item}
          onOpen={() => onOpenItem(item.id)}
          noTask
        />
      ))}
      {shownTasks.map((row) => (
        <TaskLine
          key={row.task.id}
          row={row}
          people={people}
          onOpenItem={onOpenItem}
        />
      ))}
      {rest.length ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#f0f1f5] pt-2.5 pb-1 text-[12px] text-gray-500">
          <span className="min-w-0 truncate">
            {rest.length} more:{" "}
            {rest
              .slice(0, 2)
              .map(
                (r) =>
                  `${r.task.title} (${firstOf(r.task.ownerEmail, people)})`,
              )
              .join(", ")}
            {rest.length > 2 ? "…" : ""}
          </span>
          <Link
            href={tasksHref()}
            className="font-medium text-[#3b3bd6] hover:underline"
          >
            All in Tasks →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function firstOf(
  email: string | null,
  people: TaskPerson[] | undefined,
): string {
  return email ? personName(email, people).split(" ")[0]! : "no owner";
}

function TaskLine({
  row,
  people,
  onOpenItem,
}: {
  row: RadarTask;
  people: TaskPerson[] | undefined;
  onOpenItem: (id: string) => void;
}) {
  // "updated" once someone wrote; "opened" when no one has (null). Absent
  // (older backend): any update counts, as in quietHours.
  const wrote =
    row.task.lastPersonUpdateAt === undefined
      ? !!row.task.lastUpdateAt
      : !!row.task.lastPersonUpdateAt;
  const quiet = quietLabel(row.quietHours, wrote);
  const incidentItem = row.items.find((i) => i.level === "incident");
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-x-3.5 gap-y-2 border-t border-[#f0f1f5] py-3 md:grid-cols-[56px_minmax(0,1fr)_110px_110px_auto] md:items-center">
      <Badge {...row.badge} />
      <Link href={tasksHref(row.task.id)} className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 md:flex-nowrap">
          <span className="line-clamp-2 text-[13.5px] font-semibold text-gray-900 hover:underline md:truncate">
            {row.task.title}
          </span>
          <span className="shrink-0 rounded-[4px] bg-[#f4f5f8] px-1.5 text-[10.5px] font-medium text-gray-500">
            {row.tag}
          </span>
          {row.happening ? (
            <span className="shrink-0 text-[11px] font-medium text-[#b91c1c]">
              Still happening
            </span>
          ) : null}
        </span>
        <span
          className="mt-0.5 block truncate text-[12px] text-gray-500"
          title={row.meta}
        >
          {row.meta}
        </span>
      </Link>
      {/* One row under the title on a phone; three columns from md up. */}
      <div className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-2 md:contents">
        <span className="flex items-center gap-1.5 text-[12.5px] text-gray-700">
          {row.task.ownerEmail ? (
            <>
              <Avatar email={row.task.ownerEmail} people={people} />
              <span className="truncate">
                {firstOf(row.task.ownerEmail, people)}
              </span>
            </>
          ) : (
            <span className="text-gray-400">No owner</span>
          )}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[12.5px]",
            quiet.quiet ? "font-medium text-[#b45309]" : "text-gray-500",
          )}
        >
          {quiet.quiet ? <Clock className="size-3.5" /> : null}
          {quiet.text}
        </span>
        <span className="ml-auto flex justify-end md:ml-0">
          {incidentItem ? (
            <button
              type="button"
              onClick={() => onOpenItem(incidentItem.id)}
              className="rounded-[7px] bg-[#111827] px-2.5 py-[5px] text-[12px] font-medium text-white"
            >
              Open incident
            </button>
          ) : (
            <Link
              href={tasksHref(row.task.id)}
              className="rounded-[7px] border border-[#e6e8ee] bg-white px-2.5 py-[5px] text-[12px] font-medium whitespace-nowrap text-gray-800 hover:border-gray-300"
            >
              Open task
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}

function AlertRow({
  item,
  onOpen,
  noTask,
}: {
  item: AttentionItemView;
  onOpen: () => void;
  noTask?: boolean;
}) {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-3.5 border-t border-[#f0f1f5] py-3">
      <Badge {...levelBadge(item)} />
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 md:flex-nowrap">
          <span className="line-clamp-2 text-[13.5px] font-semibold text-gray-900 hover:underline md:truncate">
            {item.title}
          </span>
          <span className="shrink-0 rounded-[4px] bg-[#f4f5f8] px-1.5 text-[10.5px] font-medium text-gray-500">
            {item.tag}
          </span>
          {noTask ? (
            <span className="shrink-0 text-[11px] text-gray-400">
              no task shown here
            </span>
          ) : null}
        </span>
        <span
          className="mt-0.5 block truncate text-[12px] text-gray-500"
          title={item.metaLine}
        >
          {item.metaLine}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-[7px] border border-[#e6e8ee] bg-white px-2.5 py-[5px] text-[12px] font-medium whitespace-nowrap text-gray-800 hover:border-gray-300"
      >
        Details
      </button>
    </div>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={cn(
        "rounded-[5px] py-[3px] text-center text-[10.5px] font-bold tracking-[0.4px]",
        TONE_CLASSES[tone],
      )}
    >
      {label}
    </span>
  );
}
