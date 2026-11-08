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
  getTask,
  getTaskCounts,
  getTaskPeople,
  getTasks,
  patchTask,
} from "@/lib/tasks-api";
import type { TaskDetail, TaskListFilters, TaskPatchInput } from "@/types/tasks";

/** Every tasks query sits under this key: a live event refreshes them all. */
export const TASK_KEYS = {
  all: ["tasks"] as const,
  people: ["tasks", "people"] as const,
  counts: ["tasks", "counts"] as const,
  list: (filters: TaskListFilters) => ["tasks", "list", filters] as const,
  task: (id: string) => ["tasks", "task", id] as const,
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

export function useTask(id: string | null) {
  return useQuery({
    queryKey: TASK_KEYS.task(id ?? "none"),
    queryFn: () => getTask(id!),
    enabled: !!id,
    // Image links are signed for five minutes; refresh well before that.
    refetchInterval: 4 * 60_000,
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
      void queryClient.invalidateQueries({ queryKey: TASK_KEYS.counts });
    },
  });
}

/** After any write: refresh the task, the list and the badge. */
export function useRefreshTask() {
  const queryClient = useQueryClient();
  return (id: string, task?: TaskDetail) => {
    if (task) queryClient.setQueryData(TASK_KEYS.task(id), task);
    else void queryClient.invalidateQueries({ queryKey: TASK_KEYS.task(id) });
    void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
    void queryClient.invalidateQueries({ queryKey: TASK_KEYS.counts });
  };
}
