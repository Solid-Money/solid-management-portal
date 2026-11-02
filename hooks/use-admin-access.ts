import { useQuery } from "@tanstack/react-query";

import {
  getActionPolicies,
  getAdminTeam,
  getApprovalSummary,
  getSigningOverview,
} from "@/lib/api";
import type {
  AdminActionPolicyRow,
  AdminTeamMember,
  SigningOverview,
} from "@/types/admin-access";

export const ACTION_POLICIES_KEY = ["admin-action-policies"] as const;
export const ADMIN_TEAM_KEY = ["admin-team"] as const;
export const APPROVAL_SUMMARY_KEY = ["approval-summary"] as const;
export const SIGNING_KEY = ["approval-signing"] as const;

/**
 * Every portal action and the approval rule it runs under. Read once and
 * shared: the key icons on buttons all come from this one list.
 */
export function useActionPolicies() {
  return useQuery<AdminActionPolicyRow[]>({
    queryKey: ACTION_POLICIES_KEY,
    queryFn: async () => (await getActionPolicies()).data.data,
    staleTime: 5 * 60_000,
  });
}

/** The rule for one action (`POST /users/:id/card/freeze`), once loaded. */
export function useActionPolicy(action: string): AdminActionPolicyRow | undefined {
  const { data } = useActionPolicies();
  return data?.find((row) => row.action === action);
}

/** Whether an action needs approval before it runs. False until the rules load. */
export function useRequiresApproval(action: string): boolean {
  return (useActionPolicy(action)?.requiredApprovals ?? 0) > 0;
}

export function useAdminTeam() {
  return useQuery<AdminTeamMember[]>({
    queryKey: ADMIN_TEAM_KEY,
    queryFn: async () => (await getAdminTeam()).data.data,
  });
}

/** For the nav badge: requests the signed-in admin can decide. */
export function useApprovalSummary(enabled = true) {
  return useQuery({
    queryKey: APPROVAL_SUMMARY_KEY,
    queryFn: async () => (await getApprovalSummary()).data.data,
    enabled,
    refetchInterval: 30_000,
  });
}

/**
 * Approval signing: the mode, the admin sub-org, and where the signed-in admin
 * stands in it. Shared by the approve buttons and the setup section.
 */
export function useSigningOverview(enabled = true) {
  return useQuery<SigningOverview>({
    queryKey: SIGNING_KEY,
    queryFn: async () => (await getSigningOverview()).data.data,
    enabled,
    staleTime: 30_000,
  });
}
