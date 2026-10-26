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

/**
 * One account's security-close outcome, mirroring the accounts-service
 * `SecurityCloseAccountResult`. The portal closes a list one id at a time (the
 * endpoint is per-account), so each id gets its own row — closed, or the reason
 * it was refused (e.g. an account with a card).
 */
export interface SecurityCloseResult {
  userId: string;
  username?: string;
  userFound: boolean;
  safeAddress?: string;
  spendConfigRemoved: boolean;
  closedAt: string;
  adminUsername: string;
  reason: string;
}

/**
 * Preview of removing an injected passkey credential, mirroring the
 * accounts-service `PasskeyCleanupPreview`. `orphaned` accounts (whose only
 * credential is the fake) are left untouched by execute.
 */
export interface PasskeyCleanupPreview {
  credentialId: string;
  accounts: number;
  passkeyDetails: number;
  orphaned: number;
  removable: number;
}

export interface PasskeyCleanupResult extends PasskeyCleanupPreview {
  accountsModified: number;
  passkeyDetailsDeleted: number;
  adminUsername: string;
  reason: string;
  ranAt: string;
}
