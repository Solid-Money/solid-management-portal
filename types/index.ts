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
  } | null;
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
  order: 'asc' | 'desc';
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

