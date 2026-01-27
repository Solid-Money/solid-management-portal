export interface User {
  _id: string;
  email: string;
  username: string;
  walletAddress?: string;
  safeAddress?: string;
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
  bridgeCustomers?: {
    bridgeCustomerId: string;
    kycStatus: string;
    createdAt: string;
  }[];
}

export interface ReferralSearchResponse {
  referrer: User | null;
  referredUsers: User[];
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
  totalFee?: string;
  totalFeeUSD?: string;
  permitTxFee?: string;
  permitTxFeeUSD?: string;
  transferTxFee?: string;
  transferTxFeeUSD?: string;
  approvalTxFee?: string;
  approvalTxFeeUSD?: string;
  bridgeTxFee?: string;
  bridgeTxFeeUSD?: string;
  bridgeTxSendingAssetFee?: string;
  bridgeTxSendingAssetFeeUSD?: string;
  depositTxFee?: string;
  depositTxFeeUSD?: string;
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

export enum TransactionType {
  DEPOSIT = "deposit",
  UNSTAKE = "unstake",
  WITHDRAW = "withdraw",
  SEND = "send",
  RECEIVE = "receive",
  BRIDGE = "bridge",
  CANCEL_WITHDRAW = "cancel_withdraw",
  BRIDGE_DEPOSIT = "bridge_deposit",
  BRIDGE_TRANSFER = "bridge_transfer",
  BANK_TRANSFER = "bank_transfer",
  CARD_TRANSACTION = "card_transaction",
  MERCURYO_TRANSACTION = "mercuryo_transaction",
  SWAP = "swap",
  WRAP = "wrap",
  UNWRAP = "unwrap",
  MERKL_CLAIM = "merkl_claim",
  CARD_WELCOME_BONUS = "card_welcome_bonus",
  DEPOSIT_BONUS = "deposit_bonus",
  FAST_WITHDRAW = "fast_withdraw",
}

export enum TransactionStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
  REFUNDED = "refunded",
}

export enum TransactionDirection {
  IN = "+",
  OUT = "-",
  FAILED = "✕",
  CANCELLED = "⊘",
}

export enum TransactionCategory {
  SAVINGS_ACCOUNT = "Savings account",
  FAST_WITHDRAW = "Fast withdraw",
  WALLET_TRANSFER = "Wallet transfer",
  EXTERNAL_WALLET_TRANSFER = "External wallet transfer",
  BANK_DEPOSIT = "Bank deposit",
  CARD_DEPOSIT = "Card deposit",
  REWARD = "Reward",
  SEND = "Send",
  SWAP = "Swap",
  WRAP = "Wrap",
  UNWRAP = "Unwrap",
  MERKL_CLAIM = "Merkl claim",
  CARD_WELCOME_BONUS = "Card welcome bonus",
  DEPOSIT_BONUS = "Deposit bonus",
  RECEIVE = "Receive",
}

export interface TransactionDetails {
  sign: TransactionDirection;
  category: TransactionCategory;
}

export const TRANSACTION_DETAILS: Record<TransactionType, TransactionDetails> =
  {
    [TransactionType.DEPOSIT]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.SAVINGS_ACCOUNT,
    },
    [TransactionType.UNSTAKE]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.SAVINGS_ACCOUNT,
    },
    [TransactionType.WITHDRAW]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.SAVINGS_ACCOUNT,
    },
    [TransactionType.SEND]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.WALLET_TRANSFER,
    },
    [TransactionType.RECEIVE]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.RECEIVE,
    },
    [TransactionType.BRIDGE]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.EXTERNAL_WALLET_TRANSFER,
    },
    [TransactionType.CANCEL_WITHDRAW]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.SAVINGS_ACCOUNT,
    },
    [TransactionType.BRIDGE_DEPOSIT]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.EXTERNAL_WALLET_TRANSFER,
    },
    [TransactionType.BRIDGE_TRANSFER]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.BANK_DEPOSIT,
    },
    [TransactionType.BANK_TRANSFER]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.BANK_DEPOSIT,
    },
    [TransactionType.CARD_TRANSACTION]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.CARD_DEPOSIT,
    },
    [TransactionType.MERCURYO_TRANSACTION]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.BANK_DEPOSIT,
    },
    [TransactionType.SWAP]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.SWAP,
    },
    [TransactionType.WRAP]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.SWAP,
    },
    [TransactionType.UNWRAP]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.SWAP,
    },
    [TransactionType.MERKL_CLAIM]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.REWARD,
    },
    [TransactionType.CARD_WELCOME_BONUS]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.REWARD,
    },
    [TransactionType.DEPOSIT_BONUS]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.REWARD,
    },
    [TransactionType.FAST_WITHDRAW]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.SAVINGS_ACCOUNT,
    },
  };

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
  { value: "receive", label: "Receive" },
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
  { value: "deposit_bonus", label: "Deposit Bonus" },
  { value: "bridge_transfer", label: "Bridge Transfer" },
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

// Card Transactions
export interface CardTransactionCashback {
  status: string;
  fuseAmount?: string;
  fuseUsdPrice?: string;
  payoutTxHash?: string;
  fiatAmount: string;
  fiatCurrency: string;
}

export interface CardTransaction {
  _id: string;
  transactionId: string;
  cardAccountId: string;
  customerId: string;
  amount: string;
  billingAmount: string;
  originalAmount: string;
  settledAmount?: string;
  currency: string;
  category: string;
  status: string;
  createdAt: string;
  authorizedAt?: string;
  postedAt?: string;
  updatedAt: string;
  merchantName?: string;
  merchantLocation?: string;
  merchantCategoryCode: string;
  transactionDescription: string;
  cashback?: CardTransactionCashback;
  user?: {
    _id: string;
    username: string;
  };
}

export interface CardTransactionsResponse {
  data: CardTransaction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CardTransactionFilters {
  status: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  limit: number;
}

export const CARD_TRANSACTION_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "authorized", label: "Authorized" },
  { value: "approved", label: "Approved" },
  { value: "settled", label: "Settled" },
  { value: "posted", label: "Posted" },
  { value: "declined", label: "Declined" },
  { value: "denied", label: "Denied" },
  { value: "reversed", label: "Reversed" },
] as const;

export const CASHBACK_STATUSES = [
  { value: "", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Paid", label: "Paid" },
  { value: "Failed", label: "Failed" },
  { value: "PermanentlyFailed", label: "Permanently Failed" },
] as const;

export interface WhatsNewStep {
  imageUrl: string;
  title: string;
  text: string;
}

export interface WhatsNew {
  _id: string;
  steps: WhatsNewStep[];
  isActive: boolean;
  showOnLoad: boolean;
  createdAt: string;
  updatedAt: string;
}

// Rewards Configuration Types
export interface TierThresholds {
  tier1: { min: number; max: number };
  tier2: { min: number; max: number };
  tier3: { min: number };
}

export interface TierCashbackConfig {
  percentage: number;
  monthlyCap: number;
}

export interface CashbackConfig {
  enabled: boolean;
  settlementDays: number;
  tier1: TierCashbackConfig;
  tier2: TierCashbackConfig;
  tier3: TierCashbackConfig;
}

export interface TierDepositBoostConfig {
  eligibleAmount: number;
  maxBonus: number;
}

export interface DepositBoostConfig {
  enabled: boolean;
  percentage: number;
  settlementDays: number;
  tier1: TierDepositBoostConfig;
  tier2: TierDepositBoostConfig;
  tier3: TierDepositBoostConfig;
}

export interface TierSubscriptionDiscountConfig {
  percentage: number;
  serviceLimit: number;
}

export interface SubscriptionDiscountConfig {
  enabled: boolean;
  eligibleServices: string[];
  tier1: TierSubscriptionDiscountConfig;
  tier2: TierSubscriptionDiscountConfig;
  tier3: TierSubscriptionDiscountConfig;
}

export interface FuseStakingConfig {
  tier2Amount: number;
  tier3Amount: number;
}

export interface ReferralConfig {
  recurringEnabled: boolean;
  boostEnabled: boolean;
  recurringPercentage: number;
  boostPercentage: number;
}

export interface CardWelcomeBonusConfig {
  enabled: boolean;
  percentage: number;
  cap: number;
}

export interface PointsEarningConfig {
  cardSpendEnabled: boolean;
  swapEnabled: boolean;
  holdingFundsEnabled: boolean;
  cardSpendPointsPerDollar: number;
  swapPointsPerDollar: number;
  holdingFundsMultiplier: number;
}

export interface FullRewardsConfig {
  tiers: TierThresholds;
  points: PointsEarningConfig;
  cashback: CashbackConfig;
  subscriptionDiscount: SubscriptionDiscountConfig;
  fuseStaking: FuseStakingConfig;
  referral: ReferralConfig;
  cardWelcomeBonus: CardWelcomeBonusConfig;
}
