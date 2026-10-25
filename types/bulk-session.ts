/**
 * Shapes for the bulk session-revoke tool (Security → Session Revoke), mirroring
 * the accounts-service `BulkSessionService` responses.
 */

export interface BulkSessionPreviewRow {
  userId: string;
  found: boolean;
  username?: string;
  /** Masked recovery email on file, when there is one. */
  emailHint?: string;
  cachedTotalBalance: number;
  /** Live login sessions a revoke would end (approximate). */
  activeSessions: number;
  securityHold: boolean;
  accountClosed: boolean;
  lastActivityAt?: string;
}

export interface BulkSessionPreview {
  rows: BulkSessionPreviewRow[];
  totals: {
    requested: number;
    found: number;
    notFound: number;
    withActiveSessions: number;
    totalActiveSessions: number;
    totalBalance: number;
  };
}

export interface BulkRevokeRow {
  userId: string;
  found: boolean;
  revoked: boolean;
  invalidatedCount: number;
  error?: string;
  /** Sessions were revoked but the audit row could not be written — the account
   * needs a manual audit entry. */
  auditFailed?: boolean;
}

export interface BulkRevokeResult {
  results: BulkRevokeRow[];
  totals: {
    requested: number;
    revoked: number;
    notFound: number;
    failed: number;
    totalInvalidated: number;
  };
  adminUsername: string;
}
