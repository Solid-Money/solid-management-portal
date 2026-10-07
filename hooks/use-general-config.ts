import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import type { GeneralConfig, UpdateRainRtfConfig } from "@/types";

export const GENERAL_CONFIG_QUERY_KEY = ["general-config"] as const;

/**
 * The one-off operational settings on Config → General.
 *
 * No polling. These change only when somebody on this page changes them, and
 * a background refetch mid-edit would swap the values under a half-typed
 * address.
 */
export function useGeneralConfig() {
  return useQuery<GeneralConfig>({
    queryKey: GENERAL_CONFIG_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<GeneralConfig>(
        "/admin/v1/general-config",
      );
      return response.data;
    },
  });
}

/**
 * Save a change to the Real-Time Funding settings.
 *
 * The response is the settings as they now resolve, written straight into the
 * cache. That matters more here than on an ordinary form: clearing a field
 * falls back to the environment rather than to blank, so what an operator
 * typed and what the app will now use are routinely different, and only the
 * server can say which.
 */
export function useUpdateRainRtfConfig() {
  const queryClient = useQueryClient();

  return useMutation<GeneralConfig, Error, UpdateRainRtfConfig>({
    mutationFn: async (changes) => {
      const response = await api.patch<GeneralConfig>(
        "/admin/v1/general-config/rain-rtf",
        changes,
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(GENERAL_CONFIG_QUERY_KEY, data);
    },
  });
}
