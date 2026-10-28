export interface AtoActivityCleanupEntry {
  id: string;
  userId: string;
  type: string;
  status: string;
  amount: string;
  symbol: string;
  createdAt: string | null;
  state: "eligible" | "hidden" | "blocked";
}

export interface AtoActivityCleanupPreview {
  incident: string;
  expected: number;
  found: number;
  matching: number;
  alreadyHidden: number;
  blocked: number;
  accounts: number;
  missingIds: string[];
  canApply: boolean;
  previewToken: string;
  entries: AtoActivityCleanupEntry[];
}

export interface AtoActivityCleanupResult {
  hidden: number;
  alreadyApplied: boolean;
  preview: AtoActivityCleanupPreview;
}
