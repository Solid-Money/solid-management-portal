"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { TASK_KEYS, useTaskFeed, useTaskPeople } from "@/hooks/use-tasks";
import { postToFeed } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import TaskComposer from "@/components/tasks/task-composer";
import TaskUpdateCard, { feedUpdateApi } from "@/components/tasks/task-update-card";

/**
 * The Team feed: what used to go in #solid that isn't a task — news, a
 * question to everyone, the daily triage. Posts work like task updates:
 * @mentions (emailed), images, replies and reactions.
 */
export default function TeamFeed({ highlight }: { highlight: string | null }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: people = [] } = useTaskPeople();
  const feed = useTaskFeed();
  const me = user?.email?.toLowerCase() ?? "";
  const posts = useMemo(() => feed.data?.pages.flatMap((page) => page.posts) ?? [], [feed.data]);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: TASK_KEYS.feed });

  // A link to a post (from an email or the bell) scrolls to it once, as soon
  // as it is on the page; later refreshes don't pull the page back to it.
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!highlight || scrolledTo.current === highlight) return;
    const element = document.getElementById(`post-${highlight}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    scrolledTo.current = highlight;
  }, [highlight, posts]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <TaskComposer
        people={people}
        placeholder="Post to the team… @ to mention, paste an image or a table"
        submitLabel="Post"
        onSubmit={async (input) => {
          await postToFeed(input);
          refresh();
        }}
      />

      {feed.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-indigo-600" />
        </div>
      ) : feed.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
          Couldn&apos;t load the feed.{" "}
          <button type="button" className="cursor-pointer underline" onClick={() => void feed.refetch()}>
            Try again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 px-4 py-16 text-center text-sm text-gray-500">
          <MessagesSquare className="size-8 text-gray-300" />
          Nothing here yet. Post news, questions for everyone, or a daily summary.
          <span className="text-xs text-gray-400">Work someone has to do goes in a task instead.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              id={`post-${post.id}`}
              className={cn("rounded-lg", highlight === post.id && "ring-2 ring-indigo-300")}
            >
              <TaskUpdateCard api={feedUpdateApi} update={post} me={me} people={people} onChanged={refresh} />
            </div>
          ))}
          {feed.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={feed.isFetchingNextPage}
                onClick={() => void feed.fetchNextPage()}
              >
                {feed.isFetchingNextPage && <Loader2 className="animate-spin" />}
                Older posts
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
