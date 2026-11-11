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
  type RadarKnownService,
  type RadarNoticeKind,
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

/**
 * Publish, update or mark fixed the item's app notice, as edited. The server
 * checks the copy rules, posts through support's Known incidents and audits
 * who clicked; it never happens on its own.
 */
export function usePublishNotice() {
  const queryClient = useQueryClient();
  return useMutation<
    AttentionItemView,
    Error,
    { id: string; kind: RadarNoticeKind; title: string; message: string }
  >({
    mutationFn: async ({ id, ...body }) =>
      (
        await api.post<AttentionItemView>(
          `/admin/v1/attention/${id}/notice`,
          body,
        )
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ATTENTION_QUERY_KEYS.all }),
  });
}

/** "Post follow-up": a What's New draft about what happened and what we did. */
export function useFollowUpDraft() {
  return useMutation<
    {
      title: string;
      message: string;
      source: "ai" | "template";
      model: string | null;
    },
    Error,
    string
  >({
    mutationFn: async (id) =>
      (await api.post(`/admin/v1/attention/${id}/follow-up`, {})).data,
  });
}

/**
 * A shared cash-out wallet is a known service (an exchange, a bridge): the
 * item closes, and the radar leaves the address out from its next check.
 */
export function useMarkKnownService() {
  const queryClient = useQueryClient();
  return useMutation<AttentionItemView, Error, { id: string; name: string }>({
    mutationFn: async ({ id, name }) =>
      (
        await api.post<AttentionItemView>(
          `/admin/v1/attention/${id}/known-service`,
          { name },
        )
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ATTENTION_QUERY_KEYS.all }),
  });
}

/** Config → Anti-abuse: the known services the cash-out check leaves out. */
export function useKnownServices() {
  return useQuery<RadarKnownService[]>({
    queryKey: ATTENTION_QUERY_KEYS.knownServices,
    queryFn: async () =>
      (await api.get<RadarKnownService[]>("/admin/v1/attention/known-services"))
        .data,
  });
}

/** Undo: the address is checked again from the radar's next run. */
export function useRemoveKnownService() {
  const queryClient = useQueryClient();
  return useMutation<{ removed: boolean }, Error, string>({
    mutationFn: async (address) =>
      (
        await api.delete<{ removed: boolean }>(
          `/admin/v1/attention/known-services/${encodeURIComponent(address)}`,
        )
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ATTENTION_QUERY_KEYS.knownServices,
      }),
  });
}
