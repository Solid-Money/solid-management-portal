import { useQuery } from "@tanstack/react-query";

import { getUserClientErrors, lookupClientErrors } from "@/lib/api";
import { ClientErrorMatch, ClientErrorReport } from "@/types";

/** The failures behind an error Ref, event ID or request ID. */
export function useClientErrorLookup(query: string) {
  return useQuery<ClientErrorMatch[]>({
    queryKey: ["client-error-lookup", query],
    queryFn: async () => (await lookupClientErrors(query)).data.data,
    enabled: query.length > 0,
  });
}

/** The failures the app showed one user, newest first. */
export function useUserClientErrors(userId: string) {
  return useQuery<ClientErrorReport[]>({
    queryKey: ["user-client-errors", userId],
    queryFn: async () => (await getUserClientErrors(userId)).data.data,
  });
}
