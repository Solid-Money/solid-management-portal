"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  ANALYTICS_QUERY_KEYS,
  ANALYTICS_REFRESH_INTERVALS,
  type CostsConfig,
  type CostsConfigResponse,
  type DepositRailsResponse,
  type ReferralProgramResponse,
  type RewardsOwedResponse,
  type RewardsPaidResponse,
} from "@/types/analytics";

/**
 * What we owe users and have not paid.
 *
 * Unscoped by date: a liability is a position, not a flow, so the header's date
 * range does not apply — the buckets inside carry their own dates.
 */
export function useRewardsOwed() {
  return useQuery<RewardsOwedResponse>({
    queryKey: ANALYTICS_QUERY_KEYS.rewardsOwed,
    queryFn: async () => {
      const response = await api.get("/admin/v1/analytics/rewards/owed");
      return response.data;
    },
    refetchInterval: ANALYTICS_REFRESH_INTERVALS.rewardsOwed,
    staleTime: ANALYTICS_REFRESH_INTERVALS.rewardsOwed / 2,
  });
}

/** Referral payouts credited and points issued over the header's window. */
export function useRewardsPaid(queryString: string) {
  return useQuery<RewardsPaidResponse>({
    queryKey: ANALYTICS_QUERY_KEYS.rewardsPaid(queryString),
    queryFn: async () => {
      const response = await api.get(
        `/admin/v1/analytics/rewards/paid?${queryString}`
      );
      return response.data;
    },
    refetchInterval: ANALYTICS_REFRESH_INTERVALS.rewardsPaid,
    staleTime: ANALYTICS_REFRESH_INTERVALS.rewardsPaid / 2,
  });
}

/** Referral program stats and the top-referrer ranking. */
export function useReferralProgram(topReferrerLimit = 25) {
  return useQuery<ReferralProgramResponse>({
    queryKey: ANALYTICS_QUERY_KEYS.referralProgram(topReferrerLimit),
    queryFn: async () => {
      const response = await api.get(
        `/admin/v1/analytics/rewards/referrals?topReferrerLimit=${topReferrerLimit}`
      );
      return response.data;
    },
    refetchInterval: ANALYTICS_REFRESH_INTERVALS.referralProgram,
    staleTime: ANALYTICS_REFRESH_INTERVALS.referralProgram / 2,
  });
}

/** Deposits by rail over the header's window. */
export function useDepositRails(queryString: string) {
  return useQuery<DepositRailsResponse>({
    queryKey: ANALYTICS_QUERY_KEYS.depositRails(queryString),
    queryFn: async () => {
      const response = await api.get(
        `/admin/v1/analytics/funnel/rails?${queryString}`
      );
      return response.data;
    },
    refetchInterval: ANALYTICS_REFRESH_INTERVALS.depositRails,
    staleTime: ANALYTICS_REFRESH_INTERVALS.depositRails / 2,
  });
}

/** The operator-maintained cost inputs behind unit economics. */
export function useCostsConfig() {
  return useQuery<CostsConfigResponse>({
    queryKey: ANALYTICS_QUERY_KEYS.costsConfig,
    queryFn: async () => {
      const response = await api.get("/admin/v1/analytics/costs-config");
      return response.data;
    },
    refetchInterval: ANALYTICS_REFRESH_INTERVALS.costsConfig,
    staleTime: ANALYTICS_REFRESH_INTERVALS.costsConfig / 2,
  });
}

/**
 * Save cost inputs.
 *
 * Invalidates the rewards liability as well as the config itself: the points
 * conversion rate is a cost input, and the liability panel's valuation is
 * computed from it server-side, so leaving it cached would show the old
 * valuation next to the new rate.
 */
export function useUpdateCostsConfig() {
  const queryClient = useQueryClient();

  return useMutation<CostsConfigResponse, Error, Partial<CostsConfig>>({
    mutationFn: async (changes) => {
      const response = await api.patch(
        "/admin/v1/analytics/costs-config",
        changes
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(ANALYTICS_QUERY_KEYS.costsConfig, data);
      void queryClient.invalidateQueries({
        queryKey: ANALYTICS_QUERY_KEYS.rewardsOwed,
      });
    },
  });
}
