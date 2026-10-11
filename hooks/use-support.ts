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
  deleteSupportMacro,
  getSupportConversation,
  getSupportCounts,
  getSupportMacros,
  getSupportMe,
  getSupportOlderMessages,
  getSupportQueue,
  getSupportReport,
  getSupportSettings,
  getSupportSettingsHistory,
  getSupportUserCases,
  saveSupportMacro,
  updateSupportSettings,
} from "@/lib/support-api";
import type { SupportQueueView, SupportSettings } from "@/types/support";

/** Every support query sits under this key, so one invalidation refreshes the inbox. */
export const SUPPORT_KEYS = {
  all: ["support"] as const,
  me: ["support", "me"] as const,
  counts: ["support", "counts"] as const,
  queue: (view: SupportQueueView, q: string) => ["support", "queue", view, q] as const,
  conversation: (id: string) => ["support", "conversation", id] as const,
  older: (id: string) => ["support", "older", id] as const,
  userCases: (userId: string) => ["support", "user-cases", userId] as const,
  settings: ["support", "settings"] as const,
  history: ["support", "settings-history"] as const,
  macros: ["support", "macros"] as const,
  report: (from: string, to: string) => ["support", "report", from, to] as const,
};

/** Whether the signed-in admin is a support agent (and the badge counts if so). */
export function useSupportMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: SUPPORT_KEYS.me,
    queryFn: getSupportMe,
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useSupportCounts(enabled: boolean) {
  return useQuery({
    queryKey: SUPPORT_KEYS.counts,
    queryFn: getSupportCounts,
    enabled,
    // Live events refresh it; this is the fallback when the socket is down.
    refetchInterval: 60_000,
  });
}

export function useSupportQueue(view: SupportQueueView, q: string) {
  return useInfiniteQuery({
    queryKey: SUPPORT_KEYS.queue(view, q),
    queryFn: ({ pageParam }) => getSupportQueue({ view, q, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useSupportConversation(id: string | null) {
  return useQuery({
    queryKey: SUPPORT_KEYS.conversation(id ?? "none"),
    queryFn: () => getSupportConversation(id!),
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

/** History before the latest page, loaded on demand. */
export function useSupportOlderMessages(id: string | null, firstSeq: number | null) {
  return useInfiniteQuery({
    queryKey: [...SUPPORT_KEYS.older(id ?? "none"), firstSeq],
    queryFn: ({ pageParam }) => getSupportOlderMessages(id!, pageParam),
    initialPageParam: firstSeq ?? 1,
    getNextPageParam: (last) =>
      last.hasOlder && last.messages.length ? last.messages[0].seq : undefined,
    enabled: false,
  });
}

export function useSupportUserCases(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: SUPPORT_KEYS.userCases(userId),
    queryFn: () => getSupportUserCases(userId),
    enabled,
  });
}

export function useSupportSettings() {
  return useQuery({ queryKey: SUPPORT_KEYS.settings, queryFn: getSupportSettings });
}

export function useSupportSettingsHistory() {
  return useQuery({ queryKey: SUPPORT_KEYS.history, queryFn: getSupportSettingsHistory });
}

export function useUpdateSupportSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Omit<SupportSettings, "version" | "updatedBy" | "updatedAt">>) =>
      updateSupportSettings(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(SUPPORT_KEYS.settings, data);
      void queryClient.invalidateQueries({ queryKey: SUPPORT_KEYS.history });
    },
  });
}

export function useSupportMacros() {
  return useQuery({ queryKey: SUPPORT_KEYS.macros, queryFn: getSupportMacros, staleTime: 60_000 });
}

export function useSaveSupportMacro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; title: string; body: string; shortcut?: string }) =>
      saveSupportMacro(
        { title: input.title, body: input.body, ...(input.shortcut ? { shortcut: input.shortcut } : {}) },
        input.id,
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SUPPORT_KEYS.macros }),
  });
}

export function useDeleteSupportMacro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSupportMacro(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SUPPORT_KEYS.macros }),
  });
}

export function useSupportReport(from: string, to: string) {
  return useQuery({
    queryKey: SUPPORT_KEYS.report(from, to),
    queryFn: () => getSupportReport(from, to),
    enabled: Boolean(from && to),
  });
}
