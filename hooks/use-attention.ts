"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api";
import {
  ATTENTION_QUERY_KEYS,
  ATTENTION_REFRESH_MS,
  type AttentionItemView,
  type AttentionListResponse,
  type RadarTab,
} from "@/types/radar";

/** The card: items for one tab, with every tab's count. */
export function useAttention(tab: RadarTab) {
  return useQuery<AttentionListResponse>({
    queryKey: ATTENTION_QUERY_KEYS.list(tab),
    queryFn: async () =>
      (
        await api.get<AttentionListResponse>("/admin/v1/attention", {
          params: { tab },
        })
      ).data,
    refetchInterval: ATTENTION_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

/** One item, for the incident view. */
export function useAttentionItem(id: string | null) {
  return useQuery<AttentionItemView>({
    queryKey: ATTENTION_QUERY_KEYS.item(id ?? ""),
    queryFn: async () =>
      (await api.get<AttentionItemView>(`/admin/v1/attention/${id}`)).data,
    enabled: !!id,
    refetchInterval: ATTENTION_REFRESH_MS,
  });
}

export type AttentionAction =
  | { kind: "assign"; id: string; owner: string | null }
  | { kind: "snooze"; id: string; hours: number }
  | { kind: "dismiss"; id: string; reason: string }
  | { kind: "resolve"; id: string; reason: string };

/** Assign, snooze, dismiss or resolve. The server audits each with who clicked. */
export function useAttentionAction() {
  const queryClient = useQueryClient();
  return useMutation<AttentionItemView, Error, AttentionAction>({
    mutationFn: async (action) => {
      const path = `/admin/v1/attention/${action.id}/${action.kind}`;
      const body =
        action.kind === "assign"
          ? { owner: action.owner }
          : action.kind === "snooze"
            ? { hours: action.hours }
            : { reason: action.reason };
      return (await api.post<AttentionItemView>(path, body)).data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ATTENTION_QUERY_KEYS.all }),
  });
}
