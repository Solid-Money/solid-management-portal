import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import type {
  AntiAbuseConfig,
  MerchantExclusionCheck,
  MerchantExclusionConfig,
  MerchantExclusionPreview,
  UpdateAntiAbuseConfig,
} from "@/types";

export const ANTI_ABUSE_QUERY_KEY = ["anti-abuse"] as const;

/**
 * Config → Anti-abuse: the merchant exclusions behind cashback and the
 * referral target, and the referral spend rules.
 *
 * No polling, for the reason the General page gives: a background refetch
 * mid-edit would swap the list out from under the operator.
 */
export function useAntiAbuseConfig() {
  return useQuery<AntiAbuseConfig>({
    queryKey: ANTI_ABUSE_QUERY_KEY,
    queryFn: async () =>
      (await api.get<AntiAbuseConfig>("/admin/v1/anti-abuse")).data,
  });
}

/** Save an edit; the response — the settings as they now resolve — replaces the cache. */
export function useUpdateAntiAbuseConfig() {
  const queryClient = useQueryClient();

  return useMutation<AntiAbuseConfig, Error, UpdateAntiAbuseConfig>({
    mutationFn: async (changes) =>
      (await api.patch<AntiAbuseConfig>("/admin/v1/anti-abuse", changes)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(ANTI_ABUSE_QUERY_KEY, data);
    },
  });
}

/** What a pattern or MCC would catch over recent card purchases. Read-only. */
export function usePreviewMerchantExclusion() {
  return useMutation<
    MerchantExclusionPreview,
    Error,
    { pattern?: string; merchantCategoryCode?: string; days?: number }
  >({
    mutationFn: async (request) =>
      (
        await api.post<MerchantExclusionPreview>(
          "/admin/v1/anti-abuse/preview",
          request,
        )
      ).data,
  });
}

/** Which rule, if any, excludes a merchant — against the unsaved draft. Read-only. */
export function useCheckMerchantExclusion() {
  return useMutation<
    MerchantExclusionCheck,
    Error,
    {
      merchantName?: string;
      merchantCategoryCode?: string;
      draft?: Partial<MerchantExclusionConfig>;
    }
  >({
    mutationFn: async (request) =>
      (
        await api.post<MerchantExclusionCheck>(
          "/admin/v1/anti-abuse/check",
          request,
        )
      ).data,
  });
}
