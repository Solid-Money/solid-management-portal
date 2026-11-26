"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth-provider";
import {
  cancelScheduledPushCampaign,
  getPushCampaign,
  getPushCampaignDestinations,
  getPushCampaigns,
  previewPushCampaignAudience,
  schedulePushCampaign,
  sendPushCampaign,
  sendPushCampaignTest,
  updateScheduledPushCampaign,
} from "@/lib/push-campaigns-api";
import type {
  PushCampaignAudienceFilters,
  PushCampaignTestInput,
  SchedulePushCampaignInput,
  SendPushCampaignInput,
} from "@/types/push-campaigns";

export const PUSH_CAMPAIGN_KEYS = {
  destinations: ["push-campaigns", "destinations"] as const,
  list: ["push-campaigns", "list"] as const,
};

/**
 * Destinations, the active What's New announcement, limits and whether this
 * admin may send. Refetched on focus: an announcement switched on in another
 * tab changes which pages a push can open on.
 */
export function usePushCampaignDestinations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: PUSH_CAMPAIGN_KEYS.destinations,
    queryFn: getPushCampaignDestinations,
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

/**
 * The scheduled campaigns, soonest first, then the most recent others.
 * Refreshed every minute so a scheduled one is seen to go out.
 */
export function usePushCampaigns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: PUSH_CAMPAIGN_KEYS.list,
    queryFn: getPushCampaigns,
    enabled: !!user,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Load one campaign with a scheduled one's list, for the editor. A mutation,
 * not a query: it is fetched fresh each time Edit is pressed, never served
 * from a cache an edit could start from.
 */
export function useLoadPushCampaign() {
  return useMutation({
    mutationFn: (id: string) => getPushCampaign(id),
    retry: false,
  });
}

/** Who of an uploaded list a campaign would reach now. Read-only. */
export function usePreviewPushAudience() {
  return useMutation({
    mutationFn: ({
      userIds,
      filters,
    }: {
      userIds: string[];
      filters?: PushCampaignAudienceFilters;
    }) => previewPushCampaignAudience(userIds, filters),
  });
}

/** Send every variant to a few named users. */
export function useSendPushCampaignTest() {
  return useMutation({
    mutationFn: (input: PushCampaignTestInput) => sendPushCampaignTest(input),
  });
}

/**
 * Send the campaign. Never retried: a retry after a timeout would be refused as
 * a duplicate at best, and the history refresh shows what actually went out.
 */
export function useSendPushCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendPushCampaignInput) => sendPushCampaign(input),
    retry: false,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: PUSH_CAMPAIGN_KEYS.list }),
  });
}

/**
 * Schedule a new campaign, or save the changes to a scheduled one (`id`).
 * Never retried, for the same reason as a send.
 */
export function useSchedulePushCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: string;
      input: SchedulePushCampaignInput;
    }) =>
      id
        ? updateScheduledPushCampaign(id, input)
        : schedulePushCampaign(input),
    retry: false,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: PUSH_CAMPAIGN_KEYS.list }),
  });
}

/** Call a scheduled campaign off before it goes out. */
export function useCancelScheduledPushCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelScheduledPushCampaign(id),
    retry: false,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: PUSH_CAMPAIGN_KEYS.list }),
  });
}
