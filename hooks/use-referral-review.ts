import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import api from "@/lib/api";
import type {
  ReferralBlockedReferrerRow,
  ReferralBlockMode,
  ReferralBlockResult,
  ReferralDecisionAction,
  ReferralDecisionResult,
  ReferralRecheckRun,
  ReferralReviewPage,
  ReferralReviewQuery,
  ReferralUnblockResult,
} from "@/types/referral-review";

const BASE = "/admin/v1/referral-review";

/** Everything a decision can change, refetched after one. */
const REVIEW_KEY = ["referral-review"] as const;

const DECISION_PATH: Record<ReferralDecisionAction, string> = {
  hold: "hold",
  approve: "approve",
  approve_friend_only: "approve-friend-only",
  reject: "reject",
};

export function useReferralReviewPage(query: ReferralReviewQuery) {
  return useQuery<ReferralReviewPage>({
    queryKey: [...REVIEW_KEY, "rows", query],
    queryFn: async () =>
      (
        await api.get<ReferralReviewPage>(BASE, {
          params: {
            status: query.status,
            page: query.page,
            limit: query.limit,
            ...(query.reason && { reason: query.reason }),
            ...(query.referrer && { referrer: query.referrer }),
            ...(query.users && { users: query.users }),
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

/** Hold, approve, approve for the friend only, or reject — one user or many. */
export function useReferralDecision() {
  const queryClient = useQueryClient();
  return useMutation<
    ReferralDecisionResult,
    Error,
    { action: ReferralDecisionAction; users: string[]; reason: string }
  >({
    mutationFn: async ({ action, users, reason }) =>
      (
        await api.post<ReferralDecisionResult>(
          `${BASE}/${DECISION_PATH[action]}`,
          { users, reason },
        )
      ).data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: REVIEW_KEY });
    },
  });
}

export function useBlockedReferrers() {
  return useQuery<ReferralBlockedReferrerRow[]>({
    queryKey: [...REVIEW_KEY, "blocked"],
    queryFn: async () =>
      (await api.get<ReferralBlockedReferrerRow[]>(`${BASE}/blocked-referrers`))
        .data,
  });
}

export function useBlockReferrer() {
  const queryClient = useQueryClient();
  return useMutation<
    ReferralBlockResult,
    Error,
    { referrer: string; mode: ReferralBlockMode; reason: string }
  >({
    mutationFn: async (body) =>
      (await api.post<ReferralBlockResult>(`${BASE}/blocked-referrers`, body))
        .data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: REVIEW_KEY });
    },
  });
}

export function useUnblockReferrer() {
  const queryClient = useQueryClient();
  return useMutation<
    ReferralUnblockResult,
    Error,
    { referrer: string; reason: string }
  >({
    mutationFn: async (body) =>
      (
        await api.post<ReferralUnblockResult>(
          `${BASE}/blocked-referrers/unblock`,
          body,
        )
      ).data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: REVIEW_KEY });
    },
  });
}

export function useRecheckRuns() {
  return useQuery<ReferralRecheckRun[]>({
    queryKey: [...REVIEW_KEY, "rechecks"],
    queryFn: async () =>
      (await api.get<ReferralRecheckRun[]>(`${BASE}/recheck`)).data,
  });
}

/** One run, polled every 2s while it is still going. */
export function useRecheckRun(id: string | null) {
  return useQuery<ReferralRecheckRun>({
    queryKey: [...REVIEW_KEY, "recheck", id],
    queryFn: async () =>
      (await api.get<ReferralRecheckRun>(`${BASE}/recheck/${id}`)).data,
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 2000 : false,
  });
}

export function useStartRecheck() {
  const queryClient = useQueryClient();
  return useMutation<
    ReferralRecheckRun,
    Error,
    { dryRun: boolean; reason?: string }
  >({
    mutationFn: async (body) =>
      (await api.post<ReferralRecheckRun>(`${BASE}/recheck`, body)).data,
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: [...REVIEW_KEY, "rechecks"],
      });
    },
  });
}
