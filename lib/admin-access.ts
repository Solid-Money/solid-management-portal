import type {
  AdminApproval,
  AdminRank,
  ApproverRank,
} from "@/types/admin-access";

/**
 * Whether `approver` may decide a request from `proposer` under `rule` — the
 * backend's rule, mirrored so the page only offers what the server will take.
 * Never the admin who asked.
 */
export function canApproveFor(
  rule: ApproverRank,
  proposerRank: AdminRank,
  approverRank: AdminRank
): boolean {
  if (rule === "above_proposer") {
    return proposerRank === 1 ? approverRank === 1 : approverRank < proposerRank;
  }
  return approverRank <= rule;
}

/** "a rank 1–3 admin", "another rank 1 admin". */
export function describeApprovers(
  rule: ApproverRank,
  proposerRank?: AdminRank
): string {
  if (rule === "above_proposer") {
    if (proposerRank === undefined) return "a higher-ranked admin";
    if (proposerRank === 1) return "another rank 1 admin";
    return proposerRank === 2
      ? "a rank 1 admin"
      : `a rank 1–${proposerRank - 1} admin`;
  }
  return rule === 1 ? "a rank 1 admin" : `a rank 1–${rule} admin`;
}

/** "1 approval from a rank 1–3 admin". */
export function describeRequirement(
  requiredApprovals: number,
  rule: ApproverRank,
  proposerRank?: AdminRank
): string {
  return `${requiredApprovals} approval${requiredApprovals === 1 ? "" : "s"} from ${describeApprovers(rule, proposerRank)}`;
}

/** Who may start an action, in words: "Everyone", "Rank 1–2". */
export function describeProposers(proposerRank: AdminRank): string {
  if (proposerRank === 4) return "Every rank";
  return proposerRank === 1 ? "Rank 1 only" : `Rank 1–${proposerRank}`;
}

/**
 * Thrown in place of a response when the backend held an action for approval
 * (202). The API layer has already told the admin; callers only need to know
 * the action did not run, and may close their dialog.
 */
export class ApprovalPendingError extends Error {
  readonly approval: AdminApproval;

  constructor(approval: AdminApproval) {
    super(`Sent for approval: ${approval.label}`);
    this.name = "ApprovalPendingError";
    this.approval = approval;
  }
}

export function isApprovalPending(
  error: unknown
): error is ApprovalPendingError {
  return error instanceof ApprovalPendingError;
}

/** The held request in a 202 response, if this is one. */
export function heldApprovalOf(response: {
  status: number;
  data?: unknown;
}): AdminApproval | null {
  if (response.status !== 202) return null;
  const data = (
    response.data as
      | { data?: { approvalRequired?: boolean; approval?: AdminApproval } }
      | undefined
  )?.data;
  return data?.approvalRequired && data.approval ? data.approval : null;
}

export const approvalHref = (id: string) => `/activity/approvals?id=${id}`;
