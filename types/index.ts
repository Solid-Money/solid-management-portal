export interface User {
  _id: string;
  email: string;
  username: string;
  walletAddress?: string;
  createdAt: string;
  status?: string;
  country?: string;
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
  type: string;
  amount: number;
  currency: string;
  createdAt: string;
  description?: string;
}

