"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth-provider";
import {
  cancelReferralV4Reward,
  createReferralBoost,
  decideReferralReview,
  deleteReferralBoost,
  getReferralBoosts,
  getReferralReviewQueue,
  getReferralV4Access,
  getUserCardCredit,
  getUserReferralsV4,
  grantUserCardCredit,
  removeUserCardCredit,
  updateReferralBoost,
} from "@/lib/api";
import { referralV4Retry } from "@/lib/referral-v4";
import type {
  AdminCardCredit,
  CardCreditAdjustment,
  ReferralBoostInput,
  ReferralReviewDecisionRequest,
} from "@/types/referral-v4";

export const REFERRAL_V4_KEYS = {
  access: ["referral-v4", "access"] as const,
  review: ["referral-v4", "review"] as const,
  boosts: ["referral-boosts"] as const,
  userCardCredit: (userId: string) => ["user-card-credit", userId] as const,
  userReferralsV4: (userId: string) => ["user-referrals-v4", userId] as const,
};

/**
 * What the signed-in admin may do with referral v4. Cached for a few minutes:
 * it only changes when the allowlist is redeployed.
 */
export function useReferralV4Access() {
  const { user } = useAuth();
  return useQuery({
    queryKey: REFERRAL_V4_KEYS.access,
    queryFn: getReferralV4Access,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: referralV4Retry,
  });
}

export function useUserCardCredit(userId: string) {
  return useQuery({
    queryKey: REFERRAL_V4_KEYS.userCardCredit(userId),
    queryFn: () => getUserCardCredit(userId),
    retry: referralV4Retry,
  });
}

/**
 * Grant or remove card credit. The response is the account as it stands
 * afterwards, so the card updates from it without another read.
 */
export function useAdjustCardCredit(
  userId: string,
  mode: "grant" | "remove",
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CardCreditAdjustment) =>
      mode === "grant"
        ? grantUserCardCredit(userId, body)
        : removeUserCardCredit(userId, body),
    onSuccess: (data: AdminCardCredit) => {
      if (data?.account) {
        queryClient.setQueryData(REFERRAL_V4_KEYS.userCardCredit(userId), data);
      } else {
        void queryClient.invalidateQueries({
          queryKey: REFERRAL_V4_KEYS.userCardCredit(userId),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
    },
  });
}

export function useUserReferralsV4(userId: string) {
  return useQuery({
    queryKey: REFERRAL_V4_KEYS.userReferralsV4(userId),
    queryFn: () => getUserReferralsV4(userId),
    retry: referralV4Retry,
  });
}

/**
 * Cancel one uncredited v4 reward. Refreshes every referral v4 view — the
 * reward shows on the referrer's page and on the friend's — plus the review
 * queue and audit trails it may appear in.
 */
export function useCancelReferralV4Reward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rewardId, reason }: { rewardId: string; reason: string }) =>
      cancelReferralV4Reward(rewardId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["user-referrals-v4"] });
      void queryClient.invalidateQueries({ queryKey: REFERRAL_V4_KEYS.review });
      void queryClient.invalidateQueries({ queryKey: ["user-audit-log"] });
    },
  });
}

export function useReferralReviewQueue(enabled = true) {
  return useQuery({
    queryKey: REFERRAL_V4_KEYS.review,
    queryFn: getReferralReviewQueue,
    enabled,
    retry: referralV4Retry,
  });
}

export function useDecideReferralReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ReferralReviewDecisionRequest) =>
      decideReferralReview(body),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: REFERRAL_V4_KEYS.review });
      void queryClient.invalidateQueries({ queryKey: ["user-referrals-v4"] });
      void queryClient.invalidateQueries({ queryKey: ["user-referrals"] });
    },
  });
}

export function useReferralBoosts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: REFERRAL_V4_KEYS.boosts,
    queryFn: getReferralBoosts,
    enabled: !!user,
    retry: referralV4Retry,
  });
}

/** Create a boost, or patch one when `id` is given. */
export function useSaveReferralBoost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: ReferralBoostInput }) =>
      id ? updateReferralBoost(id, body) : createReferralBoost(body),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: REFERRAL_V4_KEYS.boosts }),
  });
}

export function useDeleteReferralBoost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReferralBoost(id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: REFERRAL_V4_KEYS.boosts }),
  });
}
