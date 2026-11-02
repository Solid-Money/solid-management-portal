/** 1 is the most access, 4 the least. */
export type AdminRank = 1 | 2 | 3 | 4;

export const ADMIN_RANKS: readonly AdminRank[] = [1, 2, 3, 4];

/**
 * Who may approve: any admin ranked above whoever asked (rank 1 goes to another
 * rank 1), or a set rank and everyone above it.
 */
export type ApproverRank = "above_proposer" | AdminRank;

/** The signed-in admin, as the backend knows them. */
export interface AdminAccessMe {
  email: string;
  name?: string;
  rank: AdminRank;
}

export interface AdminTeamMember {
  email: string;
  name?: string;
  rank: AdminRank;
  active: boolean;
  source: "seed" | "admin";
  addedBy?: string;
  updatedBy?: string;
  revokedBy?: string;
  revokedReason?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** One portal action and the approval rule it runs under. */
export interface AdminActionPolicyRow {
  /** `POST /users/:id/card/freeze` */
  action: string;
  method: string;
  path: string;
  label: string;
  area: string;
  requiredApprovals: number;
  approverRank: ApproverRank;
  /** The lowest rank allowed to start it at all. */
  proposerRank: AdminRank;
  /** Set from the portal, rather than the default. */
  custom: boolean;
  /** Needs approval out of the box. */
  sensitiveByDefault: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export type AdminApprovalStatus =
  | "pending"
  | "approved"
  | "executing"
  | "executed"
  | "failed"
  | "rejected"
  | "expired"
  | "cancelled";

/** The Approvals page's tabs. */
export type AdminApprovalGroup = "pending" | "signed" | "rejected" | "closed";

export interface AdminApprovalDecision {
  email: string;
  name?: string;
  rank: AdminRank;
  comment?: string;
  at: string;
}

export interface AdminApprovalEvent {
  type:
    | "requested"
    | "approved"
    | "rejected"
    | "cancelled"
    | "expired"
    | "executing"
    | "executed"
    | "failed";
  email?: string;
  comment?: string;
  at: string;
}

/** A portal action held for other admins' approval. */
export interface AdminApproval {
  id: string;
  action: string;
  label: string;
  method: string;
  url: string;
  params: Record<string, string>;
  body: unknown;
  targetUserId?: string;
  reason?: string;
  proposerEmail: string;
  proposerName?: string;
  proposerRank: AdminRank;
  requiredApprovals: number;
  approverRank: ApproverRank;
  status: AdminApprovalStatus;
  approvals: AdminApprovalDecision[];
  rejection?: AdminApprovalDecision;
  events: AdminApprovalEvent[];
  expiresAt: string;
  decidedAt?: string;
  execution?: {
    startedAt?: string;
    finishedAt?: string;
    statusCode?: number;
    response?: unknown;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdminApprovalList {
  items: AdminApproval[];
  counts: Record<AdminApprovalGroup, number>;
}

export interface BulkDecisionResult {
  id: string;
  ok: boolean;
  approval?: AdminApproval;
  error?: string;
}
