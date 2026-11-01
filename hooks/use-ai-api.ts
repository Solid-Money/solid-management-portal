"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  AiApiAccountAction,
  AiApiAdminOverview,
  AiApiAdminUser,
  AiApiAdminUsersPage,
  AiApiKeyAction,
  AiApiSettings,
  AiApiSettingsPatch,
} from "@/types/ai-api";

export const AI_API_KEYS = {
  all: ["ai-api"] as const,
  overview: (from?: string, to?: string) =>
    ["ai-api", "overview", from ?? "month", to ?? "now"] as const,
  users: (search: string, page: number) =>
    ["ai-api", "users", search, page] as const,
  user: (userId: string) => ["ai-api", "user", userId] as const,
  settings: ["ai-api", "settings"] as const,
};

export function useAiApiOverview(range: { from?: string; to?: string }) {
  return useQuery<{ data: AiApiAdminOverview; canEdit: boolean }>({
    queryKey: AI_API_KEYS.overview(range.from, range.to),
    queryFn: async () =>
      (await api.get("/admin/v1/ai-api", { params: range })).data,
    placeholderData: keepPreviousData,
  });
}

export function useAiApiUsers(params: {
  search: string;
  page: number;
  limit?: number;
}) {
  return useQuery<AiApiAdminUsersPage>({
    queryKey: AI_API_KEYS.users(params.search, params.page),
    queryFn: async () =>
      (
        await api.get("/admin/v1/ai-api/users", {
          params: {
            search: params.search || undefined,
            page: params.page,
            limit: params.limit ?? 25,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

export function useAiApiUser(userId: string) {
  return useQuery<{ data: AiApiAdminUser; canEdit: boolean }>({
    queryKey: AI_API_KEYS.user(userId),
    queryFn: async () =>
      (await api.get(`/admin/v1/ai-api/users/${encodeURIComponent(userId)}`))
        .data,
    enabled: !!userId,
  });
}

export function useAiApiSettings() {
  return useQuery<{ data: AiApiSettings; canEdit: boolean }>({
    queryKey: AI_API_KEYS.settings,
    queryFn: async () => (await api.get("/admin/v1/ai-api/settings")).data,
  });
}

export function useSaveAiApiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: AiApiSettingsPatch) =>
      (await api.put("/admin/v1/ai-api/settings", patch)).data as {
        data: AiApiSettings;
        canEdit: boolean;
      },
    onSuccess: (result) =>
      queryClient.setQueryData(AI_API_KEYS.settings, result),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: AI_API_KEYS.all }),
  });
}

/**
 * Every write on one user returns that user as it now is, so the page shows
 * the result without another read. Their audit trail is refreshed too.
 */
function useUserWrite<TInput>(
  userId: string,
  request: (input: TInput) => Promise<{ data: { data: AiApiAdminUser } }>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (response) => {
      const current = queryClient.getQueryData<{
        data: AiApiAdminUser;
        canEdit: boolean;
      }>(AI_API_KEYS.user(userId));
      queryClient.setQueryData(AI_API_KEYS.user(userId), {
        canEdit: current?.canEdit ?? true,
        data: response.data.data,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: AI_API_KEYS.all });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
    },
  });
}

export function useAiApiKeyAction(userId: string) {
  return useUserWrite(
    userId,
    (input: { keyId: string; action: AiApiKeyAction; reason: string }) =>
      api.post(
        `/admin/v1/ai-api/keys/${encodeURIComponent(input.keyId)}/${input.action}`,
        { reason: input.reason },
      ),
  );
}

export function useAiApiKeyLimit(userId: string) {
  return useUserWrite(
    userId,
    (input: { keyId: string; monthlyLimitUsd: number; reason: string }) =>
      api.post(
        `/admin/v1/ai-api/keys/${encodeURIComponent(input.keyId)}/limit`,
        { monthlyLimitUsd: input.monthlyLimitUsd, reason: input.reason },
      ),
  );
}

export function useAiApiAccountAction(userId: string) {
  return useUserWrite(
    userId,
    (input: { action: AiApiAccountAction; reason: string }) =>
      api.post(
        `/admin/v1/ai-api/users/${encodeURIComponent(userId)}/${input.action}`,
        { reason: input.reason },
      ),
  );
}
