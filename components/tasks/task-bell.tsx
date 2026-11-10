"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMarkNotificationsRead, useTaskNotifications, useTaskPeople } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { AuthorAvatar, authorName, formatWhen } from "@/components/tasks/task-format";
import type { TaskNotification } from "@/types/tasks";

const WHAT: Record<TaskNotification["kind"], string> = {
  mention: "mentioned you",
  feed_mention: "mentioned you in the Team feed",
  assigned: "gave you a task",
  reply: "replied to you",
  update: "posted an update",
  status: "changed the status",
  nudge: "No update for 3 days",
};

function where(item: TaskNotification): string {
  if (item.taskNumber === null) return "Team feed";
  // Tasks go by their title: the team doesn't see task numbers.
  return item.taskTitle || "A task";
}

/**
 * The bell beside search: mentions, tasks given to you, replies, and what
 * moved on tasks you follow. Opening an entry takes you there and reads it.
 */
export default function TaskBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data } = useTaskNotifications();
  const { data: people = [] } = useTaskPeople();
  const markRead = useMarkNotificationsRead();
  const unread = data?.unread ?? 0;

  const go = (item: TaskNotification) => {
    setOpen(false);
    if (!item.read) markRead.mutate({ ids: [item.id] });
    // Old Team feed mentions have no task, and the feed is gone: reading
    // one here is all there is to do.
    if (item.taskId) router.push(`/tasks?task=${item.taskId}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-xs hover:bg-gray-50"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold leading-[18px] text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
          <span className="text-sm font-semibold text-gray-900">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="text-gray-500"
              onClick={() => markRead.mutate({ all: true })}
            >
              <CheckCheck /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {!data?.items.length ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500">
              Nothing yet. Mentions, tasks given to you and replies show here, and in your email.
            </p>
          ) : (
            data.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item)}
                className={cn(
                  "flex w-full cursor-pointer gap-2.5 border-b border-gray-50 px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-50",
                  !item.read && "bg-indigo-50/50",
                )}
              >
                <AuthorAvatar author={item.actor} people={people} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-gray-800">
                    {item.kind === "nudge" ? (
                      <span className="font-medium">{WHAT.nudge}</span>
                    ) : (
                      <>
                        <span className="font-medium">
                          {item.actor.bot
                            ? authorName(item.actor, people)
                            : authorName(item.actor, people).split(" ")[0]}
                        </span>{" "}
                        {WHAT[item.kind]}
                      </>
                    )}
                  </span>
                  <span className="block truncate text-xs font-medium text-gray-600">{where(item)}</span>
                  {item.excerpt && (
                    <span className="mt-0.5 line-clamp-2 block text-xs text-gray-500">{item.excerpt}</span>
                  )}
                  <span className="mt-0.5 block text-[11px] text-gray-400">{formatWhen(item.createdAt)}</span>
                </span>
                {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
