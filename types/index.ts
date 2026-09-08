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
  /** Rewards points, from the cached balance snapshot. */
  totalPoints?: number;
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
  hasRainCard?: boolean;
  /**
   * Card cashback rate pinned to this cardholder, as a fraction — 0.03 is 3%.
   * Overrides their tier's rate for every purchase from now on. Absent means no
   * override; 0 means an operator decided they earn nothing.
   */
  cashbackPercentage?: number;
  /** The user's primary card, or null when they have none. */
  card?: {
    provider: string;
    status: string;
    frozen: boolean;
  } | null;
}

/**
 * Which of the three configurable levels decided a cashback rate. Mirrors
 * `CashbackPercentageSource` in accounts-service.
 */
export type CashbackPercentageSource = "Transaction" | "User" | "Tier";

export const CASHBACK_PERCENTAGE_SOURCE_LABELS: Record<string, string> = {
  Transaction: "this transaction",
  User: "this user",
  Tier: "tier default",
};

/** What the backend reports after pinning or clearing a cardholder's rate. */
export interface SetUserCashbackPercentageResult {
  userId: string;
  percentage: number | null;
  previousPercentage: number | null;
  tierPercentage: number;
  effectivePercentage: number;
}

/** What the backend reports after pinning or clearing one purchase's rate. */
export interface SetTransactionCashbackPercentageResult {
  transactionId: string;
  percentage: number | null;
  previousPercentage: number | null;
  /** Whether the purchase's own cashback row was re-priced too. */
  repriced: boolean;
  /** Why it was not, when it was not — an already-paid row, or none yet. */
  repricedReason?: string;
  cashbackPercentage?: number;
}

export interface DepositTransactionRecord {
  amount: string;
  symbol: string;
  hash: string | null;
  userOpHash: string | null;
  chainId: number | null;
  status: string;
  createdAt: string;
  clientTxId: string;
  sourceChainConfirmed: boolean;
  confirmedAt: string | null;
  cardBalanceConfirmedAt: string | null;
  processingStatus: string | null;
  url: string | null;
  /**
   * Temporal workflow that processed this deposit, when it can be named.
   * Stuck deposits are diagnosed from the workflow's event history, so this is
   * the link that turns "it's stuck" into "here is where it stopped".
   */
  workflowId?: string | null;
}

export interface DepositTitleGroup {
  title: string;
  status: string;
  total: number;
  count: number;
  transactions: DepositTransactionRecord[];
}

export interface DepositCategory {
  total: number;
  count: number;
  byTitle: DepositTitleGroup[];
}

export interface DepositSummary {
  solidDeposits: DepositCategory;
  bridgeCardDeposits: DepositCategory;
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
  /** "card" | "savings" | "fuse-savings" | "eth-savings" | "wallet" */
  accountType?: string;
  /** Human label for the row, e.g. "soUSD Savings". */
  label?: string;
  /** `total` converted to USD, so rows in different assets can be compared. */
  usdValue?: number;
  /** Card issuer, on the card row only. */
  provider?: string;
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
  metadata?: Record<string, unknown>;
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

/**
 * Mirrors `ActivityType` in accounts-service. Keep the two in step: a type
 * missing here renders as a bare slug with no direction or category, and the
 * activity filter cannot select it at all.
 */
export enum TransactionType {
  DEPOSIT = "deposit",
  UNSTAKE = "unstake",
  WITHDRAW = "withdraw",
  SEND = "send",
  RECEIVE = "receive", // Incoming token/native transfers from external sources
  BRIDGE = "bridge",
  CANCEL_WITHDRAW = "cancel_withdraw",
  BRIDGE_DEPOSIT = "bridge_deposit",
  BORROW_AND_DEPOSIT_TO_CARD = "borrow_and_deposit_to_card",
  BRIDGE_TRANSFER = "bridge_transfer",
  BANK_TRANSFER = "bank_transfer",
  CARD_TRANSACTION = "card_transaction",
  CARD_DEPOSIT = "card_deposit",
  CARD_WITHDRAWAL = "card_withdrawal",
  MERCURYO_TRANSACTION = "mercuryo_transaction",
  SWAP = "swap",
  WRAP = "wrap",
  UNWRAP = "unwrap",
  MERKL_CLAIM = "merkl_claim",
  CARD_WELCOME_BONUS = "card_welcome_bonus",
  DEPOSIT_BONUS = "deposit_bonus",
  FAST_WITHDRAW = "fast_withdraw",
  REPAY_AND_WITHDRAW_COLLATERAL = "repay_and_withdraw_collateral",
  /** External wallet → Solid Safe transfer (step 1 of "Add funds"). */
  FUND = "fund",
  /** Recovery of tokens sent to the user's Turnkey signer address by mistake. */
  RESCUE_TOKEN = "rescue_token",
  AGENT_X402_PAYMENT = "agent_x402_payment",
  AGENT_WALLET_DEPOSIT = "agent_wallet_deposit",
  GOODDOLLAR_CLAIM = "gooddollar_claim",
  GOODDOLLAR_SWEEP = "gooddollar_sweep",
}

/** Mirrors `ActivityStatus` in accounts-service. */
export enum TransactionStatus {
  PENDING = "pending",
  /** On-chain transfer seen, not yet processed by the deposit workflow. */
  DETECTED = "detected",
  PROCESSING = "processing",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
  REFUNDED = "refunded",
  /** Direct deposit moved to the user's Safe, awaiting the vault mint. */
  TRANSFERRED_TO_SAFE = "transferred_to_safe",
}

export enum TransactionDirection {
  IN = "+",
  OUT = "-",
  FAILED = "✕",
  CANCELLED = "⊘",
}

/** Mirrors `TransactionCategory` in solid-ui — these are the user's own words. */
export enum TransactionCategory {
  SAVINGS_ACCOUNT = "Savings account",
  FAST_WITHDRAW = "Fast withdraw",
  WALLET_TRANSFER = "Wallet transfer",
  EXTERNAL_WALLET_TRANSFER = "External wallet transfer",
  BANK_DEPOSIT = "Bank deposit",
  CARD_DEPOSIT = "Card deposit",
  CARD_WITHDRAWAL = "Card withdraw",
  REWARD = "Reward",
  SEND = "Send",
  SWAP = "Swap",
  WRAP = "Wrap",
  UNWRAP = "Unwrap",
  MERKL_CLAIM = "Merkl claim",
  CARD_WELCOME_BONUS = "Card welcome bonus",
  DEPOSIT_BONUS = "Deposit bonus",
  GOODDOLLAR_UBI = "GoodDollar UBI",
  RECEIVE = "Receive",
}

export interface TransactionDetails {
  sign: TransactionDirection;
  category: TransactionCategory;
}

/**
 * Direction and category for every activity type, mirroring
 * solid-ui's `TRANSACTION_DETAILS`.
 *
 * Deliberately identical to the app's, signs included: the user page is a
 * read-only view of what the customer sees, so a deposit that reads "-$100
 * Savings account" in the app must not read "+$100" to the support agent
 * looking at the same row.
 */
export const TRANSACTION_DETAILS: Record<TransactionType, TransactionDetails> =
  {
    [TransactionType.DEPOSIT]: {
      // Out of the wallet and into savings, as the app frames it.
      sign: TransactionDirection.OUT,
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
    [TransactionType.CARD_WITHDRAWAL]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.CARD_WITHDRAWAL,
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
    [TransactionType.BORROW_AND_DEPOSIT_TO_CARD]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.CARD_DEPOSIT,
    },
    [TransactionType.CARD_DEPOSIT]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.CARD_DEPOSIT,
    },
    [TransactionType.REPAY_AND_WITHDRAW_COLLATERAL]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.SAVINGS_ACCOUNT,
    },
    [TransactionType.FUND]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.WALLET_TRANSFER,
    },
    [TransactionType.RESCUE_TOKEN]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.WALLET_TRANSFER,
    },
    [TransactionType.AGENT_X402_PAYMENT]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.WALLET_TRANSFER,
    },
    [TransactionType.AGENT_WALLET_DEPOSIT]: {
      sign: TransactionDirection.OUT,
      category: TransactionCategory.WALLET_TRANSFER,
    },
    [TransactionType.GOODDOLLAR_CLAIM]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.GOODDOLLAR_UBI,
    },
    [TransactionType.GOODDOLLAR_SWEEP]: {
      sign: TransactionDirection.IN,
      category: TransactionCategory.GOODDOLLAR_UBI,
    },
  };

/**
 * `bridge_deposit` is dual-use: it backs both real cross-chain bridges and the
 * savings→card funding flow. The static map cannot tell them apart, so the card
 * variant — every card-destined movement is titled with "Card", the backend's
 * own convention — is relabelled here, exactly as the app does it.
 */
export function getTransactionCategory(
  type: TransactionType,
  title?: string
): TransactionCategory | undefined {
  // A deposit headed for the card is written under the plain deposit types —
  // the destination lives in the title, not the type. Without this a crypto
  // deposit to a Rain card reads as "Savings account", which is the one thing
  // it is not.
  if (
    (type === TransactionType.BRIDGE_DEPOSIT ||
      type === TransactionType.DEPOSIT) &&
    title?.toLowerCase().includes("card")
  ) {
    return TransactionCategory.CARD_DEPOSIT;
  }
  return TRANSACTION_DETAILS[type]?.category;
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

/**
 * Options for the activity type filter. Every value in `TransactionType`
 * appears here — a type missing from this list is one the filter cannot select,
 * so a whole class of activity (card deposits, agent wallet, GoodDollar) was
 * previously invisible to anyone filtering.
 */
export const ACTIVITY_TYPES = [
  { value: "", label: "All Types" },
  { value: TransactionType.DEPOSIT, label: "Deposit" },
  { value: TransactionType.WITHDRAW, label: "Withdraw" },
  { value: TransactionType.UNSTAKE, label: "Unstake" },
  { value: TransactionType.CANCEL_WITHDRAW, label: "Cancel Withdraw" },
  { value: TransactionType.FAST_WITHDRAW, label: "Fast Withdraw" },
  { value: TransactionType.SEND, label: "Send" },
  { value: TransactionType.RECEIVE, label: "Receive" },
  { value: TransactionType.FUND, label: "Add Funds" },
  { value: TransactionType.RESCUE_TOKEN, label: "Rescue Token" },
  { value: TransactionType.SWAP, label: "Swap" },
  { value: TransactionType.WRAP, label: "Wrap" },
  { value: TransactionType.UNWRAP, label: "Unwrap" },
  { value: TransactionType.BRIDGE, label: "Bridge" },
  { value: TransactionType.BRIDGE_DEPOSIT, label: "Bridge Deposit" },
  { value: TransactionType.BRIDGE_TRANSFER, label: "Bridge Transfer" },
  { value: TransactionType.BANK_TRANSFER, label: "Bank Transfer" },
  { value: TransactionType.MERCURYO_TRANSACTION, label: "Mercuryo Purchase" },
  { value: TransactionType.CARD_DEPOSIT, label: "Card Deposit" },
  { value: TransactionType.CARD_TRANSACTION, label: "Card Transaction" },
  { value: TransactionType.CARD_WITHDRAWAL, label: "Card Withdrawal" },
  {
    value: TransactionType.BORROW_AND_DEPOSIT_TO_CARD,
    label: "Borrow & Deposit to Card",
  },
  {
    value: TransactionType.REPAY_AND_WITHDRAW_COLLATERAL,
    label: "Repay & Withdraw Collateral",
  },
  { value: TransactionType.CARD_WELCOME_BONUS, label: "Card Welcome Bonus" },
  { value: TransactionType.DEPOSIT_BONUS, label: "Deposit Bonus" },
  { value: TransactionType.MERKL_CLAIM, label: "Merkl Claim" },
  { value: TransactionType.GOODDOLLAR_CLAIM, label: "GoodDollar Claim" },
  { value: TransactionType.GOODDOLLAR_SWEEP, label: "GoodDollar Sweep" },
  { value: TransactionType.AGENT_X402_PAYMENT, label: "Agent x402 Payment" },
  { value: TransactionType.AGENT_WALLET_DEPOSIT, label: "Agent Wallet Deposit" },
] as const;

export const DEPOSIT_TYPES = [
  { value: "", label: "All Deposit Types" },
  { value: "REGULAR", label: "Regular" },
  { value: "DIRECT", label: "Direct" },
] as const;

export const ACTIVITY_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: TransactionStatus.PENDING, label: "Pending" },
  { value: TransactionStatus.DETECTED, label: "Detected" },
  { value: TransactionStatus.PROCESSING, label: "Processing" },
  {
    value: TransactionStatus.TRANSFERRED_TO_SAFE,
    label: "Transferred to Safe",
  },
  { value: TransactionStatus.SUCCESS, label: "Success" },
  { value: TransactionStatus.FAILED, label: "Failed" },
  { value: TransactionStatus.CANCELLED, label: "Cancelled" },
  { value: TransactionStatus.EXPIRED, label: "Expired" },
  { value: TransactionStatus.REFUNDED, label: "Refunded" },
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
  usdtBalance?: string;
  usdtThreshold?: string;
  usdtStatus?: "OK" | "LOW" | "CRITICAL" | "N/A";
  usdtAddress?: string;
  // soUSD is the reward payout asset (cashback, bonuses) on Fuse. Referral
  // cashback pays in native FUSE, so for the referral payout wallet the gas
  // balance above IS the payout float — its soUSD only covers rewards earned
  // before that switch.
  soUsdBalance?: string;
  soUsdThreshold?: string;
  soUsdStatus?: "OK" | "LOW" | "CRITICAL" | "N/A";
  soUsdAddress?: string;
  needsTopUp: boolean;
  topUpRecommendation?: string;
}

export interface WalletInfo {
  name: string;
  description: string;
  address: string;
  // Whether the wallet is active. Defaults to active when omitted.
  active?: boolean;
  /** Why an inactive wallet is inactive; absent on active wallets. */
  inactiveReason?: string;
  chains: ChainBalance[];
}

export interface WalletStatusResponse {
  wallets: WalletInfo[];
  lastUpdated: string;
}

export type WalletFilter = "active" | "inactive" | "all";

export const WALLET_FILTERS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
] as const;

// Card Transactions
export interface CardTransactionCashback {
  status: string;
  /** Current payout asset. Cashback moved to soUSD; FUSE below is historical. */
  soUsdAmount?: string;
  soUsdRate?: string;
  /** @deprecated Paid in native FUSE before the soUSD migration. */
  fuseAmount?: string;
  /** @deprecated Companion to `fuseAmount`. */
  fuseUsdPrice?: string;
  payoutTxHash?: string;
  fiatAmount: string;
  fiatCurrency: string;
  /** "Cashback" or "SubscriptionDiscount". */
  type?: string;
  merchantName?: string;
  /**
   * The rate this row was created at, as a fraction, and which of the three
   * levels set it. This is what the payout will use — not whatever the config
   * says by the time the escrow matures.
   */
  cashbackPercentage?: number;
  cashbackPercentageSource?: CashbackPercentageSource;
}

/**
 * A fee we charged through Rain's custom-charge API off the back of a card
 * transaction. Today that is the FX fee on a non-USD settlement.
 */
export interface CardTransactionFee {
  category: string;
  status: string;
  feeAmountUsd: string;
  baseAmountUsd: string;
  /** Rate applied as a fraction (0.0099 = 0.99%). */
  percentage: number;
  tierName: string;
  waiveReason?: string;
  foreignCurrency?: string;
  rainChargeId?: string;
  chargedAt?: string;
  lastError?: string;
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
  merchantCity?: string;
  merchantCountry?: string;
  merchantCategoryCode: string;
  transactionDescription: string;
  /** Why the issuer declined it — only set on declined transactions. */
  declinedReason?: string;
  /** Merchant-currency amount, when the purchase converted currency. */
  localAmount?: string;
  localCurrency?: string;
  cashback?: CardTransactionCashback;
  /**
   * Cashback rate pinned to this one purchase, as a fraction. Outranks the
   * cardholder's own rate and their tier's. Lives on the transaction rather
   * than the cashback row so a purchase can be priced before it settles.
   */
  cashbackPercentage?: number;
  /** Admin email that last set it, and when. */
  cashbackPercentageSetBy?: string;
  cashbackPercentageSetAt?: string;
  /** Card fees charged for this spend; empty when none applied. */
  fees?: CardTransactionFee[];
  /** Sum of the fees Rain actually accepted, in USD. */
  totalFeeUsd?: number;
  user?: {
    _id: string;
    username: string;
  };
}

/** Mirrors `CardFeeStatus` in accounts-service. */
export const CARD_FEE_STATUS_LABELS: Record<string, string> = {
  Pending: "Pending",
  Charged: "Charged",
  Failed: "Failed",
  PermanentlyFailed: "Permanently failed",
  Waived: "Waived",
};

/** Mirrors `CardFeeWaiveReason` — why nothing was owed. */
export const CARD_FEE_WAIVE_REASONS: Record<string, string> = {
  TierFree: "Tier pays 0%",
  BelowMinimum: "Below minimum charge",
  Disabled: "Program disabled",
};

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
  /** Free-text match on merchant name or transaction id. */
  search: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  limit: number;
}

/**
 * Mirrors `CardTransactionStatus` in accounts-service, which the schema
 * enforces — so these four are the only values the collection can hold.
 *
 * The list used to carry four more (pending, authorized, posted, denied) from
 * the Bridge.xyz era. Nothing writes them any more, so selecting one returned
 * an empty table with no hint that the filter itself was the problem.
 */
export const CARD_TRANSACTION_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "approved", label: "Approved (authorized)" },
  { value: "settled", label: "Settled" },
  { value: "declined", label: "Declined" },
  { value: "reversed", label: "Reversed" },
] as const;

export const CARD_TRANSACTION_CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "purchase", label: "Purchase" },
  { value: "refund", label: "Refund" },
] as const;

/**
 * Mirrors `CashbackStatus` in accounts-service. Five of the nine were missing,
 * so an escrowed, refunded, cancelled or debt-deducted cashback rendered with
 * no colour and could not be recognised at a glance.
 */
export const CASHBACK_STATUSES = [
  { value: "", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Escrowed", label: "Escrowed" },
  { value: "Paid", label: "Paid" },
  { value: "DeductedFromDebt", label: "Deducted From Debt" },
  { value: "PartiallyRefunded", label: "Partially Refunded" },
  { value: "FullyRefunded", label: "Fully Refunded" },
  { value: "Canceled", label: "Canceled" },
  { value: "Failed", label: "Failed" },
  { value: "PermanentlyFailed", label: "Permanently Failed" },
] as const;

export interface WhatsNewStep {
  imageUrl: string;
  title: string;
  text: string;
  buttonLabel?: string;
  buttonLink?: string;
}

export interface WhatsNew {
  _id: string;
  steps: WhatsNewStep[];
  isActive: boolean;
  showOnLoad: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionsBannerPlatforms {
  web: boolean;
  android: boolean;
  ios: boolean;
}

export interface PromotionsBanner {
  _id: string;
  title: string;
  imageURL: string;
  mobileImageURL?: string;
  enabled: boolean;
  sort?: number;
  link?: string;
  platforms?: PromotionsBannerPlatforms;
  /**
   * Native app version gate, e.g. ">=2.0.0" (that build and every newer one) or
   * "1.0.12" (only that build). Empty means every version. Web ignores it.
   */
  version?: string;
  /** Pathname the banner is scoped to, e.g. "/" or "/savings". Empty means every page. */
  page?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Response of `GET /api/app-version`. */
export interface LatestAppVersion {
  version: string;
  /** solid-ui branch the version came from, or null when read off the App Store. */
  branch: string | null;
  source: "github" | "app-store";
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
  /** @deprecated Superseded by categoryLimit. */
  serviceLimit: number;
  /** Number of subscription categories this tier can earn a discount on per month. */
  categoryLimit: number;
}

export interface SubscriptionDiscountCategory {
  key: string;
  label: string;
  merchants: string[];
}

export interface SubscriptionDiscountConfig {
  enabled: boolean;
  /** @deprecated Legacy flat service list; detection uses categories. */
  eligibleServices: string[];
  categories: SubscriptionDiscountCategory[];
  /**
   * Most subscription cashback one eligible service can earn in a month, in USD
   * (Rewards Terms §5). Caps the cashback, not the charge it is earned on; the
   * name is left from an earlier reading and is what the API still sends.
   */
  eligibleAmountCap: number;
  tier1: TierSubscriptionDiscountConfig;
  tier2: TierSubscriptionDiscountConfig;
  tier3: TierSubscriptionDiscountConfig;
}

export interface FuseStakingConfig {
  /** Master switch for the "skip the line" FUSE tier unlock. */
  enabled: boolean;
  /** FUSE that must sit in the soFUSE vault to hold Prime. */
  tier2Amount: number;
  /** FUSE that must sit in the soFUSE vault to hold Ultra. */
  tier3Amount: number;
}

export interface ReferralConfig {
  recurringEnabled: boolean;
  boostEnabled: boolean;
  recurringPercentage: number;
  boostPercentage: number;
}

/**
 * Two-sided USD referral cashback: what each side earns once a referred friend
 * becomes an active cardholder, and the bar they have to clear to get it.
 */
export interface ReferralCashbackConfig {
  /** Kill-switch: when false, qualified referrals are not paid out. */
  enabled: boolean;
  /** Cashback credited to the referrer per qualified referral. */
  referrerRewardUsd: number;
  /** Welcome cashback credited to the referred friend per qualified referral. */
  newUserRewardUsd: number;
  /** Friend must spend at least this much (USD) to qualify. */
  spendTargetUsd: number;
  /** ...across at least this many distinct merchants. */
  merchantTarget: number;
  /** Friend has this many days from signup to clear the bar. */
  qualifyWindowDays: number;
  /** Days between qualifying and the payout (covers disputes/chargebacks). */
  payoutDelayDays: number;
  /** Window after qualifying in which churn/chargeback claws the reward back. */
  reversalWindowDays: number;
  /** Qualified referrals per rolling 30 days above which a referrer is held for review. */
  autoReviewMonthlyThreshold: number;
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
  /** Points for the balance held on the card (accrued daily). */
  cardBalanceEnabled: boolean;
  cardSpendPointsPerDollar: number;
  swapPointsPerDollar: number;
  /** Points per $1 of deposited funds, per HOUR. */
  holdingFundsMultiplier: number;
  /** Points per $1 of card balance held, per HOUR. */
  cardBalancePointsPerDollarPerHour: number;
}

/** One product's per-tier rates, as fractions (0.005 = 0.5%). */
export interface FeeRates {
  enabled: boolean;
  tier1: number;
  tier2: number;
  tier3: number;
}

/**
 * Per-tier product fees — the revenue side of the tier system.
 *
 * Fees apply only at the edges of the product: swapping tokens, converting
 * currency, and moving money in or out. Holding and spending in USD is free on
 * every tier, and there is deliberately no monthly-fee field — no competitor in
 * the benchmark charges its free tier one, and the tier story is "stake FUSE
 * and every fee drops to zero".
 */
export interface ProductFeesConfig {
  /** Master kill-switch: when false, no product fee is ever charged. */
  enabled: boolean;
  /** Charged on in-app swaps, taken from the source token on-chain. */
  swap: FeeRates;
  /** Charged on stock trades, taken from the sell side in the CoW batch. */
  stocks: FeeRates;
  /** Charged when a purchase settles in a currency other than the card's. */
  fx: FeeRates;
  /**
   * Charged when funds leave Solid for a bank account, card off-ramp included.
   *
   * Named `offRamp` because that is the key it is stored under: the product
   * started as the card off-ramp before it grew to cover every withdrawal rail.
   */
  offRamp: FeeRates;
  /** Charged on fiat arriving from a bank, withheld from the amount credited. */
  bankDeposit: FeeRates;
  /** Charged on a settled TransFi buy-crypto order. */
  transfi: FeeRates;
  /** Computed fees below this (USD) are waived rather than charged. */
  minChargeUsd: number;
}

export interface FullRewardsConfig {
  tiers: TierThresholds;
  points: PointsEarningConfig;
  cashback: CashbackConfig;
  subscriptionDiscount: SubscriptionDiscountConfig;
  fuseStaking: FuseStakingConfig;
  referral: ReferralConfig;
  referralCashback: ReferralCashbackConfig;
  cardWelcomeBonus: CardWelcomeBonusConfig;
  productFees: ProductFeesConfig;
}

// Campaign Types
export type CampaignStatus = "Draft" | "Active" | "Paused" | "Ended";

export interface Campaign {
  _id: string;
  name: string;
  description?: string;
  country?: string;
  venueName?: string;
  venueLocation?: string;
  merchantName: string;
  cashbackPercentage: number;
  maxDailyCashback: number;
  isInstant: boolean;
  startDate: string;
  endDate: string;
  emailTemplateId?: number;
  status: CampaignStatus;
  totalCashbackPaid: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// User detail page ("view as user")
// ---------------------------------------------------------------------------

export type CardProvider = "rain" | "wirex" | "bridge";

/** Card as `GET /admin/v1/users/:id/card` reports it. */
export interface UserCardOverview {
  hasCard: boolean;
  cardId?: string;
  provider?: CardProvider;
  /** Issuer customer id — what support quotes when calling the provider. */
  providerCustomerId?: string;
  status?: string;
  frozen: boolean;
  /**
   * `customer` means the cardholder froze it and can unfreeze it in the app;
   * `developer` is an admin or system freeze they cannot lift themselves.
   */
  freezeInitiator?: "customer" | "developer" | "bridge";
  balanceUsd: number;
  /** Why a Wirex card's balance is what it is. Wirex cards only. */
  wirexSpend?: WirexSpendContext;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * The state behind a Wirex card's spending power.
 *
 * A Wirex card is never funded — it spends the cardholder's own assets where
 * they sit, through `SolidCashModule` on their Safe — so its "Card balance" is
 * whatever the module will release for the next tap. A $0 there has several
 * different causes with opposite answers for support: nothing to spend
 * (deposit), a spent cap (wait for the window to roll), revoked module consent
 * (re-enable in the app), a guardian pause (arrears or a fraud hold), or
 * everything committed to charges Wirex has not settled yet (wait). These are
 * the figures that tell them apart.
 *
 * Mirrors `AdminWirexSpendContext` in accounts-service. Absent when the chain
 * state could not be read, so an empty panel means "we could not check" rather
 * than "this user has nothing".
 */
export interface WirexSpendContext {
  /**
   * What the card can spend right now: the live value of every allowlisted
   * asset the Safe holds (USDC, USDT, soUSD), already clamped by the rolling
   * caps and net of unsettled authorizations. The next tap is decided
   * against this number.
   */
  spendableUsd: number;
  /** Committed to authorizations Wirex has not settled yet. */
  heldUsd: number;
  /**
   * Headroom left under the tighter of the daily and monthly caps. Distinct
   * from `spendableUsd`: plenty of assets behind an exhausted cap is a
   * different problem, with a different answer, than an empty Safe.
   */
  limitRemainingUsd: number;
  /** The Safe's own caps. `null` means no cap of its own — not zero. */
  dailyLimitUsd: number | null;
  monthlyLimitUsd: number | null;
  /** Both halves done: the module is enabled on the Safe *and* it registered. */
  registered: boolean;
  /**
   * The two halves separately, because they fail differently. Consent can be
   * revoked from any Safe client with no call to us, so `registeredOnChain`
   * with `moduleEnabled: false` means re-enable the module — registering
   * again reverts it.
   */
  registeredOnChain: boolean;
  moduleEnabled: boolean;
  /** Guardian pauses. `safePaused` is usually arrears or a fraud hold. */
  modulePaused: boolean;
  safePaused: boolean;
}

/** One entry in the admin audit trail for a card freeze or unfreeze. */
export interface CardFreezeAuditEntry {
  _id: string;
  action: "card_frozen" | "card_unfrozen";
  adminEmail: string;
  adminUsername: string;
  targetUserId: string;
  targetUsername?: string;
  reason?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type VaultKey = "USDC" | "FUSE" | "ETH";

/**
 * One vault's savings summary, exactly as the app's savings screen reads it.
 *
 * The `*USD` names are a soUSD-era misnomer: each figure is denominated in its
 * own vault's underlying asset, so soFUSE reports FUSE and soETH reports ETH.
 * Use `SavingsVaultResult.underlyingPriceUsd` to put them in dollars.
 */
export interface SavingsSummary {
  vault: string;
  vaultToken: string;
  balanceShares: string;
  exchangeRate: string;
  totalValueUSD: string;
  actualDepositedUSD: string;
  interestEarnedUSD: string;
  apyPercent: number;
  lastDepositAt: string | null;
  activityCount: number;
  calculatedAt: string;
}

export interface SavingsVaultResult {
  vault: VaultKey;
  summary: SavingsSummary | null;
  /** The unit `summary`'s `*USD` figures are really in: USD, FUSE or ETH. */
  underlyingSymbol?: string;
  /** USD price of one `underlyingSymbol`; null when it could not be read. */
  underlyingPriceUsd?: number | null;
  /** Why the vault could not be read, when `summary` is null. */
  error?: string;
}

export type RewardsTierName = "core" | "prime" | "ultra";

/** Tier and points as the app's rewards screen shows them. */
export interface UserRewardsData {
  currentTier: RewardsTierName;
  totalPoints: number;
  nextTier: RewardsTierName | null;
  nextTierPoints: number;
  pointsToNextTier: number;
  progressToNextTierPct: number;
  /**
   * The rate this cardholder actually earns — their tier's, unless an operator
   * has pinned one to them.
   */
  cashbackRate: number;
  /** What their tier pays by default, before any override. */
  tierCashbackRate?: number;
  /** Whether `cashbackRate` is pinned to them rather than coming from the tier. */
  hasCustomCashbackRate?: boolean;
  nextTierCashbackRate: number;
  cashbackThisMonth: number;
  maxCashbackMonthly: number;
  referralPoints: number;
  hasCard: boolean;
  hasOptedIn: boolean;
  legacyPoints: number;
  legacyCarryoverPoints: number;
  startingTier: RewardsTierName;
  yieldBoostPercentage: number;
  yieldBoostCap: number;
  yieldBoostEarned: number;
  subscriptionDiscountRate: number;
  subscriptionCategoryLimit: number;
  fuseSkipLine?: {
    enabled: boolean;
    balanceFuse: number;
    balanceUsd: number;
    unlockedTier: RewardsTierName;
  };
}

export interface CashbackEntry {
  _id: string;
  transactionId: string;
  fiatAmount: string;
  fiatCurrency: string;
  soUsdAmount?: string;
  soUsdRate?: string;
  fuseAmount?: string;
  fuseUsdPrice?: string;
  status: string;
  type?: string;
  merchantName?: string;
  subscriptionCategory?: string;
  payoutTxHash?: string;
  payoutAt?: string;
  createdAt: string;
  lastError?: string;
  /** The rate the row was created at, and which of the three levels set it. */
  cashbackPercentage?: number;
  cashbackPercentageSource?: CashbackPercentageSource;
}

/** Cashback rows plus the totals support is usually actually after. */
export interface CashbackHistory {
  entries: CashbackEntry[];
  totalPaidSoUsd: number;
  totalPaidUsd: number;
  totalQualifyingSpend: number;
  pendingCount: number;
  failedCount: number;
}

export interface IntercomConversationSummary {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  state?: string;
  open?: boolean;
  read?: boolean;
  title?: string;
  initiatedBy?: string;
  url?: string;
}

/** Intercom support history; `configured: false` when no API key is set. */
export interface IntercomUserHistory {
  configured: boolean;
  error?: string;
  contact: {
    id: string;
    email?: string;
    name?: string;
    created_at?: number;
    last_seen_at?: number;
    url?: string;
  } | null;
  totalConversations: number;
  openConversations: number;
  lastContactAt?: number;
  conversations: IntercomConversationSummary[];
}

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------

export type CohortGroup = "general" | "rain" | "wirex" | "inactive";

export interface CohortSnapshot {
  cohortId: string;
  cohortName: string;
  description: string;
  /** Absent on snapshots taken before cohorts were grouped; treat as general. */
  group?: CohortGroup;
  /** Absent on pre-grouping snapshots; treat as active. */
  active?: boolean;
  count: number;
  usersWithEmail: number;
  date: string;
}

/** Section headings for the cohorts page, in the order they are shown. */
export const COHORT_GROUP_META: Record<
  CohortGroup,
  { label: string; description: string }
> = {
  general: {
    label: "General",
    description: "Product-wide funnel, whichever card the user holds",
  },
  rain: {
    label: "Rain Card",
    description: "The primary card program",
  },
  wirex: {
    label: "Wirex Card",
    description: "The EU/EEA card program",
  },
  inactive: {
    label: "Inactive",
    description: "Retired programs, kept for historical exports",
  },
};
