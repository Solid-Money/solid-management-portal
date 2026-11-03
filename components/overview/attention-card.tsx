"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAttention, useAttentionAction } from "@/hooks/use-attention";
import { describeApiError } from "@/lib/api";
import {
  TONE_CLASSES,
  footerLine,
  levelBadge,
  statusPill,
  summaryPills,
} from "@/lib/attention";
import {
  RADAR_TABS,
  type AttentionItemView,
  type RadarTab,
} from "@/types/radar";
import { OverviewCard } from "@/components/overview/overview-ui";
import { AttentionDetail } from "@/components/overview/attention-detail";
import { ReasonDialog } from "@/components/overview/reason-dialog";

const TAB_LABELS: Record<RadarTab, string> = {
  all: "All",
  incidents: "Incidents",
  abuse: "Abuse",
  security: "Security",
  reliability: "Reliability",
  money: "Money",
  resolved: "Resolved",
};

/**
 * Needs your attention: the incident radar. Live incidents first, then High,
 * Check and Watch, then what was resolved this week. Every row has one main
 * action and a menu (Assign, Snooze, Dismiss with a reason); every click is
 * audited server side.
 */
export function AttentionCard() {
  const [tab, setTab] = useState<RadarTab>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [closing, setClosing] = useState<{
    item: AttentionItemView;
    kind: "dismiss" | "resolve";
  } | null>(null);
  const { data, error, isLoading } = useAttention(tab);
  const action = useAttentionAction();

  const run = (input: Parameters<typeof action.mutate>[0], done: string) =>
    action.mutate(input, {
      onSuccess: () => toast.success(done),
      onError: (e) => toast.error(describeApiError(e)),
    });

  const items = tab === "resolved" ? [] : (data?.items ?? []);
  const resolved = data?.resolved ?? [];
  const nothing = data && data.counts.all === 0;

  return (
    <OverviewCard className="px-5 pt-4 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">
            Needs your attention
          </h2>
          {data ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {summaryPills(data.summary).map((pill) => (
                <span
                  key={pill.label}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium",
                    TONE_CLASSES[pill.tone],
                  )}
                >
                  {pill.dot ? (
                    <span className="size-[6px] rounded-full bg-[#16a34a]" />
                  ) : null}
                  {pill.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setTab("all")}
          className="text-[13px] font-medium whitespace-nowrap text-[#3b3bd6] hover:underline"
        >
          All items →
        </button>
      </div>

      {error && !data ? (
        <p className="mt-3 text-[13px] text-red-700">
          The radar could not load: {describeApiError(error)}.
        </p>
      ) : null}
      {isLoading && !data ? (
        <p className="mt-3 text-[13px] text-gray-400">Loading…</p>
      ) : null}

      {data && nothing && resolved.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-gray-600">
          <span className="size-[7px] rounded-full bg-[#16a34a]" />
          Nothing needs attention
        </p>
      ) : null}

      {data && (!nothing || resolved.length > 0) ? (
        <>
          {/* Scrolls sideways on a narrow screen, with no scrollbar drawn. The
              baseline is an inset shadow so the active tab's border covers it
              without hanging below the row, which made a vertical scrollbar. */}
          <div className="mt-3 flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_#eef0f4] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {RADAR_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13px] whitespace-nowrap",
                  tab === t
                    ? "border-gray-900 font-medium text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-800",
                )}
              >
                {TAB_LABELS[t]}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px]",
                    tab === t
                      ? "bg-gray-900 text-white"
                      : "bg-[#f1f2f6] text-gray-500",
                  )}
                >
                  {data.counts[t]}
                </span>
              </button>
            ))}
          </div>

          <div>
            {items.map((item) => (
              <Row
                key={item.id}
                item={item}
                onOpen={() => setOpenId(item.id)}
                onAssign={(owner) =>
                  run(
                    { kind: "assign", id: item.id, owner },
                    owner ? "Assigned" : "Unassigned",
                  )
                }
                onSnooze={() =>
                  run(
                    { kind: "snooze", id: item.id, hours: 1 },
                    "Snoozed for an hour",
                  )
                }
                onClose={(kind) => setClosing({ item, kind })}
              />
            ))}
            {tab !== "resolved" && items.length === 0 ? (
              <p className="py-4 text-[13px] text-gray-500">
                Nothing open under {TAB_LABELS[tab]}.
              </p>
            ) : null}

            {resolved.length > 0 && (tab === "all" || tab === "resolved") ? (
              <>
                <p className="mt-2 border-t border-[#eef0f4] pt-3 pb-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
                  Resolved this week
                </p>
                {resolved.slice(0, tab === "resolved" ? 50 : 3).map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    onOpen={() => setOpenId(item.id)}
                  />
                ))}
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {data ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef0f4] pt-2.5 text-[11.5px] text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-[6px] rounded-full bg-[#16a34a]" />
            {footerLine(data)}
          </span>
        </div>
      ) : null}

      <AttentionDetail id={openId} onClose={() => setOpenId(null)} />
      <ReasonDialog
        open={closing !== null}
        title={
          closing?.kind === "resolve"
            ? "Resolve this item"
            : "Dismiss this item"
        }
        description={closing?.item.title ?? ""}
        confirmLabel={closing?.kind === "resolve" ? "Resolve" : "Dismiss"}
        pending={action.isPending}
        onCancel={() => setClosing(null)}
        onConfirm={(reason) => {
          if (!closing) return;
          action.mutate(
            { kind: closing.kind, id: closing.item.id, reason },
            {
              onSuccess: () => {
                toast.success(
                  closing.kind === "resolve" ? "Resolved" : "Dismissed",
                );
                setClosing(null);
              },
              onError: (e) => toast.error(describeApiError(e)),
            },
          );
        }}
      />
    </OverviewCard>
  );
}

function Row({
  item,
  onOpen,
  onAssign,
  onSnooze,
  onClose,
}: {
  item: AttentionItemView;
  onOpen: () => void;
  onAssign?: (owner: string | null) => void;
  onSnooze?: () => void;
  onClose?: (kind: "dismiss" | "resolve") => void;
}) {
  const { user } = useAuth();
  const badge = levelBadge(item);
  const status = statusPill(item.status);
  const resolved = item.status === "resolved";
  const isIncident = item.level === "incident" || item.category === "incident";

  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border-t border-[#f0f1f5] py-2.5 first:border-t-0 md:grid-cols-[64px_minmax(0,1fr)_120px_110px_190px]">
      <span
        className={cn(
          "rounded-[5px] py-[3px] text-center text-[10.5px] font-bold tracking-[0.4px]",
          TONE_CLASSES[badge.tone],
        )}
      >
        {badge.label}
      </span>

      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-[13.5px] font-semibold",
              resolved ? "text-gray-500" : "text-gray-900",
            )}
          >
            {item.title}
          </span>
          <span className="shrink-0 rounded-[4px] bg-[#f4f5f8] px-1.5 text-[10.5px] font-medium text-gray-500">
            {item.tag}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-gray-500">
          {item.metaLine}
        </span>
        {item.about ? (
          // One line, cut by the layout; the whole text on hover and in the view.
          <span
            className="mt-0.5 block truncate text-[12px] text-gray-400"
            title={item.about}
          >
            {item.about}
          </span>
        ) : null}
      </button>

      <span className="col-start-2 md:col-start-auto">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-[3px] text-[12px] font-medium",
            TONE_CLASSES[status.tone],
          )}
        >
          {status.label}
        </span>
      </span>

      <span className="col-start-2 flex items-center gap-1.5 text-[12px] text-gray-500 md:col-start-auto">
        {item.owner ? (
          <>
            <span className="flex size-[22px] items-center justify-center rounded-full bg-[#3b3bd6] text-[11px] font-semibold text-white">
              {(item.owner.name ?? item.owner.email).charAt(0).toUpperCase()}
            </span>
            <span className="truncate">
              {item.owner.name ?? item.owner.email.split("@")[0]}
            </span>
          </>
        ) : onAssign ? (
          <button
            type="button"
            onClick={() => onAssign("me")}
            className="inline-flex items-center gap-1.5 hover:text-gray-800"
          >
            <span className="flex size-[22px] items-center justify-center rounded-full border border-dashed border-[#c4c8d2] text-gray-400">
              <Plus className="size-3" />
            </span>
            Assign
          </button>
        ) : (
          <span>—</span>
        )}
      </span>

      <span className="col-start-2 flex items-center justify-end gap-1.5 md:col-start-auto">
        {isIncident && !resolved ? (
          <button
            type="button"
            onClick={onOpen}
            className="rounded-[7px] bg-[#111827] px-2.5 py-[5px] text-[12px] font-medium text-white"
          >
            Open incident
          </button>
        ) : item.mainAction ? (
          <Link
            href={item.mainAction.href}
            className="rounded-[7px] border border-[#e6e8ee] bg-white px-2.5 py-[5px] text-[12px] font-medium text-gray-800 hover:border-gray-300"
          >
            {item.mainAction.label}
          </Link>
        ) : null}
        {!resolved && onAssign && onSnooze && onClose ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                className="rounded-[7px] border border-[#e6e8ee] bg-white px-2 py-[5px] text-gray-500 hover:border-gray-300"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAssign("me")}>
                Assign to me
                {user?.email ? ` (${user.email.split("@")[0]})` : ""}
              </DropdownMenuItem>
              {item.owner ? (
                <DropdownMenuItem onClick={() => onAssign(null)}>
                  Unassign
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={onSnooze}>Snooze 1 h</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onClose("resolve")}>
                Resolve…
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onClose("dismiss")}
                className="text-red-700"
              >
                Dismiss…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </span>
    </div>
  );
}
