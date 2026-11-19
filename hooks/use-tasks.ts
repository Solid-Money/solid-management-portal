"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import {
  getClaudeJobs,
  getTask,
  getTaskBoards,
  getTaskCounts,
  getTaskPartners,
  getTaskNotifications,
  getTaskPeople,
  getMarketing,
  getTaskSprint,
  getTasks,
  searchTasks,
  getTeam,
  markTaskNotificationsRead,
  patchTask,
} from "@/lib/tasks-api";
import type { TaskArea, TaskDetail, TaskListFilters, TaskPatchInput, TaskTeamScope } from "@/types/tasks";
import { claudeLookingIn } from "@/lib/task-rich";
import { claudeJobsOpen } from "@/lib/claude-jobs";

/** Every tasks query sits under this key: a live event refreshes them all. */
export const TASK_KEYS = {
  all: ["tasks"] as const,
  people: ["tasks", "people"] as const,
  counts: ["tasks", "counts"] as const,
  boards: ["tasks", "boards"] as const,
  partners: ["tasks", "partners"] as const,
  list: (filters: TaskListFilters) => ["tasks", "list", filters] as const,
  sprint: (start: string | null) => ["tasks", "sprint", start ?? "current"] as const,
  search: (q: string) => ["tasks", "search", q] as const,
  team: (scope: string, area: string | null, helpers: boolean) => ["tasks", "team", scope, area ?? "all", helpers] as const,
  task: (id: string) => ["tasks", "task", id] as const,
  claudeJobs: (taskId: string) => ["tasks", "claude-jobs", taskId] as const,
  notifications: ["tasks", "notifications"] as const,
  marketing: (range: { from: string; to: string } | null) =>
    ["tasks", "marketing", range ? `${range.from}..${range.to}` : "live"] as const,
};

/** Admins who can own a task or be @mentioned. */
export function useTaskPeople() {
  const { user } = useAuth();
  return useQuery({
    queryKey: TASK_KEYS.people,
    queryFn: getTaskPeople,
    enabled: !!user,
    staleTime: 10 * 60_000,
  });
}

/** For the nav badge. */
export function useTaskCounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: TASK_KEYS.counts,
    queryFn: getTaskCounts,
    enabled: !!user,
    // Live events refresh it; this is the fallback when the socket is down.
    refetchInterval: 60_000,
    retry: false,
  });
}

/** Escalations waiting on partners; refreshed every minute while shown. */
export function useTaskPartners(enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: TASK_KEYS.partners,
    queryFn: getTaskPartners,
    enabled: !!user && enabled,
    refetchInterval: 60_000,
  });
}

/** The boards, in tab order, with their open counts. */
export function useTaskBoards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: TASK_KEYS.boards,
    queryFn: getTaskBoards,
    enabled: !!user,
    refetchInterval: 60_000,
  });
}

/** A week's sprint and the backlog to plan it from (this week's when `start` is null). */
export function useTaskSprint(start: string | null, enabled = true) {
  return useQuery({
    queryKey: TASK_KEYS.sprint(start),
    queryFn: () => getTaskSprint(start ?? undefined),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

/** The Team tab, kept fresh every minute; the last answer stays while the next loads. */
export function useTeam(scope: TaskTeamScope, area: TaskArea | null, helpers: boolean) {
  return useQuery({
    queryKey: TASK_KEYS.team(scope, area, helpers),
    queryFn: () => getTeam({ scope, area, helpers }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

/** The central search (two characters or more, or a number), the last results kept while the next load. */
export function useTaskSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: TASK_KEYS.search(term),
    queryFn: () => searchTasks(term),
    enabled: term.length >= 2 || /^\d+$/.test(term),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useTaskList(filters: TaskListFilters) {
  return useInfiniteQuery({
    queryKey: TASK_KEYS.list(filters),
    queryFn: ({ pageParam }) => getTasks(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

/** A task id as the backend makes them (a Mongo ObjectId). */
export function isTaskId(id: string | null | undefined): id is string {
  return !!id && /^[a-f0-9]{24}$/i.test(id);
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: TASK_KEYS.task(id ?? "none"),
    queryFn: () => getTask(id!),
    // A mistyped ?task= never reaches the API.
    enabled: isTaskId(id),
    // Image links are signed for five minutes; refresh well before that.
    // While Claude is looking into something, check often in case the live
    // update doesn't arrive.
    refetchInterval: (query) => (claudeLookingIn(query.state.data) ? 5_000 : 4 * 60_000),
  });
}

/**
 * Claude's jobs on a task. A live task event and every write on the task
 * refresh it (useRefreshTask, the `tasks_updated` handler); while a job is
 * open it is also checked every minute, in case the event doesn't arrive.
 * Never retried: a backend without the queue answers 404.
 */
export function useClaudeJobs(taskId: string | null) {
  return useQuery({
    queryKey: TASK_KEYS.claudeJobs(taskId ?? "none"),
    queryFn: () => getClaudeJobs(taskId!),
    enabled: isTaskId(taskId),
    retry: false,
    refetchInterval: (query) => (claudeJobsOpen(query.state.data?.jobs) ? 60_000 : 4 * 60_000),
  });
}

/** Change a task's fields; the drawer and the list both refresh. */
export function usePatchTask(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskPatchInput) => patchTask(id, input),
    onSuccess: (task: TaskDetail) => {
      queryClient.setQueryData(TASK_KEYS.task(id), task);
      void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "sprint"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "marketing"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "team"] });
      void queryClient.invalidateQueries({ queryKey: TASK_KEYS.counts });
      void queryClient.invalidateQueries({ queryKey: TASK_KEYS.boards });
    },
  });
}

/** The Marketing tab: live campaigns and their pieces, or one week's pieces. */
export function useMarketing(range: { from: string; to: string } | null, enabled = true) {
  return useQuery({
    queryKey: TASK_KEYS.marketing(range),
    queryFn: () => getMarketing(range ?? undefined),
    enabled,
    // Week to week, the last week stays up while the next loads; never the
    // campaign view as a stand-in for a week, or the other way round.
    placeholderData: (previous, previousQuery) =>
      previousQuery && (previousQuery.queryKey[2] === "live") === (range === null) ? previous : undefined,
    refetchInterval: 60_000,
  });
}

/** After any write: refresh the task, the list and the badge. */
export function useRefreshTask() {
  const queryClient = useQueryClient();
  return (id: string, task?: TaskDetail) => {
    if (task) queryClient.setQueryData(TASK_KEYS.task(id), task);
    else void queryClient.invalidateQueries({ queryKey: TASK_KEYS.task(id) });
    // An update that tags @Claude opens a job; a write can also close one.
    void queryClient.invalidateQueries({ queryKey: TASK_KEYS.claudeJobs(id) });
    void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["tasks", "sprint"] });
    void queryClient.invalidateQueries({ queryKey: ["tasks", "marketing"] });
    void queryClient.invalidateQueries({ queryKey: ["tasks", "team"] });
    void queryClient.invalidateQueries({ queryKey: TASK_KEYS.counts });
    void queryClient.invalidateQueries({ queryKey: TASK_KEYS.boards });
  };
}

/** The bell: newest entries and the unread count. */
export function useTaskNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: TASK_KEYS.notifications,
    queryFn: getTaskNotifications,
    enabled: !!user,
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markTaskNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASK_KEYS.notifications });
    },
  });
}

