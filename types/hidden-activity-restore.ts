/** Mirrors `libs/common/src/interfaces/hidden-activity-restore.interface.ts` in solid-backend. */
export type HiddenActivityRestoreBlock =
  | "no_hash"
  | "internal_transfer"
  | "token_not_listed"
  | "settlement_sweep"
  | "settlement_unknown"
  | "duplicate";

export interface HiddenActivityRestoreEntry {
  id: string;
  userId: string;
  type: string;
  status: string;
  amount: string;
  symbol: string;
  chainId: number | null;
  hash: string | null;
  createdAt: string | null;
  state: "eligible" | "blocked";
  blockedReason?: HiddenActivityRestoreBlock;
}

export interface HiddenActivityRestorePreview {
  userId: string | null;
  scanned: number;
  eligible: number;
  blocked: Record<HiddenActivityRestoreBlock, number>;
  accounts: number;
  batchLimit: number;
  hasMore: boolean;
  canApply: boolean;
  previewToken: string;
  entries: HiddenActivityRestoreEntry[];
}

export interface HiddenActivityRestoreResult {
  restored: number;
  accounts: number;
  preview: HiddenActivityRestorePreview;
}
