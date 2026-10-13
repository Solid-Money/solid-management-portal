"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Bell, BellOff, Loader2, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { useSupportQueue } from "@/hooks/use-support";
import {
  requestSupportNotifications,
  supportNotificationPermission,
  type SupportNotificationPermission,
} from "@/lib/support-alerts";
import { cn } from "@/lib/utils";
import {
  COMPLAINT_LABELS,
  VIEW_LABELS,
  ago,
  agentShortName,
  dateTime,
  intentLabel,
  languageName,
} from "@/components/support/support-format";
import {
  SUPPORT_QUEUE_VIEWS,
  type SupportQueueCounts,
  type SupportQueueRow,
  type SupportQueueView,
} from "@/types/support";

const AUTHOR_PREFIX: Record<string, string> = {
  user: "",
  guest: "",
  ai: "Solid AI: ",
  agent: "You: ",
  system: "",
};

const noSubscription = () => () => {};

function NotificationToggle() {
  // The browser's answer; "unsupported" while rendering on the server.
  const current = useSyncExternalStore(
    noSubscription,
    supportNotificationPermission,
    () => "unsupported" as const,
  );
  const [asked, setAsked] = useState<SupportNotificationPermission | null>(null);
  const permission = asked ?? current;
  if (permission === "unsupported" || permission === "granted") return null;
  return (
    <Button
      variant="outline"
      size="xs"
      onClick={async () => setAsked(await requestSupportNotifications())}
      disabled={permission === "denied"}
      title={
        permission === "denied"
          ? "Notifications are blocked for this site in your browser settings"
          : "Get a desktop notification when a case needs a human"
      }
    >
      {permission === "denied" ? <BellOff /> : <Bell />}
      {permission === "denied" ? "Alerts blocked" : "Turn on alerts"}
    </Button>
  );
}

function Row({
  row,
  selected,
  onSelect,
}: {
  row: SupportQueueRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const c = row.case;
  const waiting = c.lastCustomerMessageAt ?? c.createdAt;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border-b border-gray-100 px-3 py-2.5 text-left transition-colors hover:bg-gray-50",
        selected && "bg-indigo-50 hover:bg-indigo-50",
      )}
    >
      <div className="flex items-center gap-2">
        {c.urgent && (
          <span title="Urgent" className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
        )}
        <span className="truncate text-sm font-medium text-gray-900">
          {row.userLabel ?? (row.userId ? `User ${row.userId.slice(-6)}` : "Guest")}
        </span>
        <span className="shrink-0 text-xs text-gray-400">#{c.number}</span>
        {row.unread > 0 && (
          <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold leading-5 text-white">
            {row.unread}
          </span>
        )}
        <span className={cn("shrink-0 text-xs text-gray-400", row.unread === 0 && "ml-auto")}>
          {ago(row.lastMessage?.at ?? c.updatedAt)}
        </span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
        {row.lastMessage ? (
          <>
            {row.lastMessage.internal ? (
              <span className="font-medium text-amber-700">Note: </span>
            ) : (
              <span className="font-medium text-gray-500">
                {AUTHOR_PREFIX[row.lastMessage.authorType] ?? ""}
              </span>
            )}
            {row.lastMessage.snippet}
          </>
        ) : (
          <span className="italic text-gray-400">No messages</span>
        )}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {c.intent && <Badge variant="muted">{intentLabel(c.intent)}</Badge>}
        {c.complaint && (
          <Badge variant="danger">{COMPLAINT_LABELS[c.complaint.type] ?? c.complaint.type}</Badge>
        )}
        {c.hasDraft && (
          <Badge variant="info">
            <Sparkles />
            Draft
          </Badge>
        )}
        {row.language && !row.language.startsWith("en") && (
          <Badge variant="outline">{languageName(row.language)}</Badge>
        )}
        {c.escalation && (
          <Badge variant={c.escalation.overdue ? "danger" : "warning"}>
            {c.escalation.overdue ? "Follow-up overdue" : `Follow up ${dateTime(c.escalation.followUpAt)}`}
          </Badge>
        )}
        {c.snoozeUntil && <Badge variant="muted">Until {dateTime(c.snoozeUntil)}</Badge>}
        {c.assigneeEmail && (
          <span className="ml-auto text-[11px] text-gray-500">{agentShortName(c.assigneeEmail)}</span>
        )}
        {(c.status === "needs_human" || c.status === "assigned") && (
          <span className={cn("text-[11px] text-gray-400", !c.assigneeEmail && "ml-auto")}>
            waiting {ago(waiting).replace(" ago", "")}
          </span>
        )}
      </div>
    </button>
  );
}

export default function QueueList({
  view,
  query,
  selected,
  counts,
  onView,
  onQuery,
  onSelect,
}: {
  view: SupportQueueView;
  query: string;
  selected: string | null;
  counts: SupportQueueCounts | null | undefined;
  onView: (view: SupportQueueView) => void;
  onQuery: (query: string) => void;
  onSelect: (conversationId: string) => void;
}) {
  const [text, setText] = useState(query);
  const debounced = useDebounce(text, 300);
  useEffect(() => {
    if (debounced !== query) onQuery(debounced);
  }, [debounced, query, onQuery]);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSupportQueue(view, query);
  const rows = data?.pages.flatMap((page) => page.rows) ?? [];

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-white shadow-sm">
      <div className="space-y-2 border-b border-gray-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold text-gray-900">Inbox</h1>
          <NotificationToggle />
        </div>
        {counts && counts.overdueFollowUps > 0 && (
          <button
            type="button"
            onClick={() => onView("escalated")}
            className="flex w-full items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {counts.overdueFollowUps} escalation{counts.overdueFollowUps === 1 ? "" : "s"} past follow-up
          </button>
        )}
        <div className="flex flex-wrap gap-1">
          {SUPPORT_QUEUE_VIEWS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onView(option)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                option === view
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50",
              )}
            >
              {VIEW_LABELS[option]}
              {option !== "resolved" && counts ? (
                <span className={cn("ml-1", option === view ? "text-indigo-100" : "text-gray-400")}>
                  {counts[option]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Username, user id or case words"
            aria-label="Search cases"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : isError ? (
          <p className="p-4 text-sm text-red-600">Could not load the queue.</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">
            {query ? "No cases match." : `Nothing in ${VIEW_LABELS[view]}.`}
          </p>
        ) : (
          <>
            {rows.map((row) => (
              <Row
                key={row.case.id}
                row={row}
                selected={row.case.conversationId === selected}
                onSelect={() => onSelect(row.case.conversationId)}
              />
            ))}
            {hasNextPage && (
              <div className="p-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? <Loader2 className="animate-spin" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
