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
  /** Set when the approval was signed with the admin's passkey through Turnkey. */
  signature?: { activityId: string; turnkeyUserId: string; rank: AdminRank };
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

// --- Approval signing (Turnkey passkeys) -------------------------------------

export type AdminSigningMode = "off" | "optional" | "required";

/** A WebAuthn registration, as Turnkey's browser SDK returns it. */
export interface PasskeyAttestation {
  credentialId: string;
  clientDataJson: string;
  attestationObject: string;
  transports: (
    | "AUTHENTICATOR_TRANSPORT_BLE"
    | "AUTHENTICATOR_TRANSPORT_INTERNAL"
    | "AUTHENTICATOR_TRANSPORT_NFC"
    | "AUTHENTICATOR_TRANSPORT_USB"
    | "AUTHENTICATOR_TRANSPORT_HYBRID"
  )[];
}

/** An admin as the Turnkey admin sub-org holds them. */
export interface TurnkeyAdminUser {
  userId: string;
  email: string | null;
  rank: AdminRank | null;
  root: boolean;
  /** Fingerprints of their passkeys. */
  passkeys: string[];
}

/** A root action in Turnkey waiting for a second root admin. */
export interface TurnkeyPendingActivity {
  id: string;
  fingerprint: string;
  type: string;
  summary: string;
  requestedBy: string | null;
  approvedBy: string[];
  createdAt: number;
}

export interface SigningEnrollment {
  email: string;
  fingerprint: string;
  status: "pending" | "used";
  updatedAt: string;
  /** Root admins only: what they add in Turnkey. */
  challenge?: string;
  attestation?: PasskeyAttestation;
}

export interface SigningOverview {
  mode: AdminSigningMode;
  /** The sub-org and wallet are pinned in the environment. */
  configured: boolean;
  /** Approvals are being signed now. */
  active: boolean;
  pinned: {
    subOrganizationId?: string;
    walletId?: string;
    walletAddress?: string;
  };
  pinnedMatchesSetup: boolean;
  subOrganizationId: string | null;
  walletAddress: string | null;
  setup: {
    status: "completed" | "failed";
    subOrganizationId?: string;
    walletId?: string;
    walletAddress?: string;
    tagIds: Partial<Record<AdminRank, string>>;
    policyId?: string;
    rootEmails: string[];
    threshold?: number;
    bootstrappedBy?: string;
    error?: string;
    updatedAt: string;
  } | null;
  rootAdmins: string[];
  rootThreshold: number;
  isRootAdmin: boolean;
  enrollments: SigningEnrollment[];
  me: {
    email: string;
    rank: AdminRank;
    enrollment: { fingerprint: string; status: "pending" | "used"; updatedAt: string } | null;
    turnkey: TurnkeyAdminUser | null;
  };
  turnkey: {
    users: TurnkeyAdminUser[];
    tagIds: Partial<Record<AdminRank, string>>;
    quorum: { threshold: number; userIds: string[] } | null;
    pending: TurnkeyPendingActivity[];
  } | null;
  turnkeyError?: string;
}

/** What an approval carries once signed. */
export interface ApprovalSignature {
  activityId: string;
  ids: string[];
}
