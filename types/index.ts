export interface User {
  _id: string;
  email: string;
  username: string;
  walletAddress?: string;
  createdAt: string;
  status?: string;
  country?: string | null;
  totalBalance?: number;
  savingsBalance?: number;
  cardBalance?: number;
  walletBalance?: number;
  referralCode?: string;
  referredBy?: {
    id: string;
    username: string;
    referralCode: string;
  } | null;
  referralCodeUsed?: string | null;
  lastActivityTimestamp?: string | null;
}

export interface UsersResponse {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UserFilters {
  search: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  limit: number;
}

export interface Balance {
  currency: string;
  available: number;
  pending: number;
  total: number;
  accountType?: string;
}

export interface Activity {
  id: string;
  _id: string;
  type: string;
  amount: string;
  symbol: string;
  createdAt: string;
  title?: string;
  shortTitle?: string;
  status: string;
  chainId?: number;
  hash?: string;
  url?: string;
  fromAddress?: string;
  toAddress?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface AdminActivity {
  _id: string;
  type: string;
  status: string;
  amount: string;
  symbol: string;
  title?: string;
  shortTitle?: string;
  chainId?: number;
  hash?: string;
  fromAddress?: string;
  toAddress?: string;
  failureReason?: string | null;
  user?: {
    _id: string;
    username: string;
  };
  depositType?: "REGULAR" | "DIRECT" | null;
  createdAt: string;
  timestamp?: string;
}

export interface AdminActivitiesResponse {
  data: AdminActivity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ActivityFilters {
  type: string;
  depositType: string;
  status: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  limit: number;
}

export const ACTIVITY_TYPES = [
  { value: "", label: "All Types" },
  { value: "deposit", label: "Deposit" },
  { value: "withdraw", label: "Withdraw" },
  { value: "send", label: "Send" },
  { value: "swap", label: "Swap" },
  { value: "bridge", label: "Bridge" },
  { value: "bridge_deposit", label: "Bridge Deposit" },
  { value: "card_transaction", label: "Card Transaction" },
  { value: "mercuryo_transaction", label: "Mercuryo Transaction" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "unstake", label: "Withdraw" },
  { value: "cancel_withdraw", label: "Cancel Withdraw" },
  { value: "wrap", label: "Wrap" },
  { value: "unwrap", label: "Unwrap" },
  { value: "merkl_claim", label: "Merkl Claim" },
  { value: "card_welcome_bonus", label: "Card Welcome Bonus" },
] as const;

export const DEPOSIT_TYPES = [
  { value: "", label: "All Deposit Types" },
  { value: "REGULAR", label: "Regular" },
  { value: "DIRECT", label: "Direct" },
] as const;

export const ACTIVITY_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
  { value: "refunded", label: "Refunded" },
] as const;

export interface ChainBalance {
  chainId: number;
  chainName: string;
  gasBalance: string;
  gasThreshold: string;
  gasStatus: "OK" | "LOW" | "CRITICAL" | "N/A";
  gasTokenSymbol: string;
  usdcBalance: string;
  usdcThreshold: string;
  usdcStatus: "OK" | "LOW" | "CRITICAL" | "N/A";
  usdcAddress: string;
  needsTopUp: boolean;
  topUpRecommendation?: string;
}

export interface WalletInfo {
  name: string;
  description: string;
  address: string;
  chains: ChainBalance[];
}

export interface WalletStatusResponse {
  wallets: WalletInfo[];
  lastUpdated: string;
}
