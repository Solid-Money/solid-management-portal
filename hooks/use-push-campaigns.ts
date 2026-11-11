"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth-provider";
import {
  getPushCampaignDestinations,
  getPushCampaigns,
  previewPushCampaignAudience,
  sendPushCampaign,
  sendPushCampaignTest,
} from "@/lib/push-campaigns-api";
import type {
  PushCampaignTestInput,
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

/** The most recent campaigns, newest first. */
export function usePushCampaigns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: PUSH_CAMPAIGN_KEYS.list,
    queryFn: getPushCampaigns,
    enabled: !!user,
  });
}

/** Who of an uploaded list a campaign would reach. Read-only. */
export function usePreviewPushAudience() {
  return useMutation({
    mutationFn: (userIds: string[]) => previewPushCampaignAudience(userIds),
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
