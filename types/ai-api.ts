/** Why every key on a user's account is stopped at once. */
export type AiApiPauseReason = "wallet_empty" | "billing_mandate" | "admin";

export type AiApiKeyStatus = "active" | "limit_reached" | "paused" | "disabled";

export type AiApiChargeStatus = "open" | "processing" | "charged" | "waived";

export type AiApiChargeFailure =
  | "wallet_empty"
  | "billing_mandate"
  | "too_early"
  | "transient"
  /** Solid put the Safe on hold in the billing module. */
  | "safe_held";

export type AiApiCashbackStatus = "none" | "pending" | "paid" | "failed";

/** GET /admin/v1/ai-api — totals over a date range. */
export interface AiApiAdminOverview {
  from: string;
  to: string;
  usage: {
    requests: number;
    tokens: number;
    /** What the upstream calls cost at our prices, before limits. */
    costUsd: number;
    /** What users are charged: cost, clamped to each key's limit. */
    billedUsd: number;
    /** Requests metered from an estimate (a stream the client abandoned). */
    estimatedRequests: number;
    activeUsers: number;
    activeKeys: number;
  };
  charges: {
    count: number;
    chargedUsd: number;
    openCount: number;
    openUsd: number;
    failingCount: number;
  };
  cashback: { bookedUsd: number; paidUsd: number; pendingUsd: number };
  keys: { active: number; users: number };
  pausedAccounts: number;
  byModel: {
    model: string;
    name: string;
    requests: number;
    tokens: number;
    costUsd: number;
    billedUsd: number;
  }[];
  byDay: { day: string; requests: number; billedUsd: number; users: number }[];
}

export interface AiApiAdminUserRow {
  userId: string;
  username: string | null;
  email: string | null;
  keys: number;
  spentThisMonthUsd: number;
  requestsThisMonth: number;
  paused: boolean;
  pausedReason: AiApiPauseReason | null;
}

export interface AiApiAdminUsersPage {
  data: AiApiAdminUserRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AiApiAdminKey {
  id: string;
  name: string;
  last4: string;
  monthlyLimitUsd: number;
  spentThisMonthUsd: number;
  cashbackThisMonthUsd: number;
  requestsThisMonth: number;
  status: AiApiKeyStatus;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  disabledBy: string | null;
}

export interface AiApiAdminCharge {
  id: string;
  status: AiApiChargeStatus;
  fromDay: string;
  toDay: string;
  amountUsd: number;
  requests: number;
  keys: { keyId: string; name: string; amountUsd: number; requests: number }[];
  attempts: number;
  failure: AiApiChargeFailure | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  chargedAt: string | null;
  transactionHash: string | null;
  cashbackUsd: number;
  cashbackStatus: AiApiCashbackStatus;
  cashbackPayoutAt: string | null;
  cashbackPaidAt: string | null;
  cashbackTxHash: string | null;
  cashbackLastError: string | null;
}

export interface AiApiAdminMandate {
  moduleEnabled: boolean;
  registered: boolean;
  paused: boolean;
  cancelled: boolean;
  maxPerPeriodUsd: number;
  periodSeconds: number;
}

/** GET /admin/v1/ai-api/users/:userId */
export interface AiApiAdminUser {
  user: {
    userId: string;
    username: string | null;
    email: string | null;
    safeAddress: string | null;
  };
  /** Whether this user may create keys now (rollout gate and kill switch). */
  available: boolean;
  month: {
    key: string;
    spentUsd: number;
    cashbackUsd: number;
    requests: number;
    resetsAt: string;
  };
  daily: { day: string; spentUsd: number }[];
  topModels: {
    model: string;
    name: string;
    tokens: number;
    requests: number;
    spentUsd: number;
  }[];
  billing: {
    configured: boolean;
    chainId: number;
    moduleAddress: string | null;
    periodSeconds: number;
    mandate: AiApiAdminMandate | null;
    requiredMandateUsd: number;
    needsMandate: boolean;
    walletUsdcUsd: number | null;
    openChargeUsd: number;
  };
  account: {
    paused: boolean;
    pausedReason: AiApiPauseReason | null;
    pausedAt: string | null;
    pausedBy: string | null;
  };
  keys: AiApiAdminKey[];
  charges: AiApiAdminCharge[];
  cashback: { pendingUsd: number; paidUsd: number };
}

export interface AiApiModelConfig {
  /** What users put in `model`. */
  id: string;
  name: string;
  /** What is sent to the gateway in its place. */
  upstreamModel: string;
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  cachedInputUsdPerMTok?: number;
  cacheWriteUsdPerMTok?: number;
  aliases?: string[];
  enabled: boolean;
}

export interface AiApiSettings {
  enabled: boolean;
  /** 0.5 is 50%. */
  cashbackRate: number;
  /** 0 means no cap. */
  cashbackMonthlyCapUsd: number;
  maxKeysPerUser: number;
  maxMonthlyLimitUsd: number;
  models: AiApiModelConfig[];
  /** From the environment; read-only here. */
  cohortOnly: boolean;
  upstreamConfigured: boolean;
  upstreamBaseUrl: string;
  publicBaseUrl: string | null;
}

export type AiApiSettingsPatch = Partial<
  Omit<
    AiApiSettings,
    "cohortOnly" | "upstreamConfigured" | "upstreamBaseUrl" | "publicBaseUrl"
  >
>;

export type AiApiKeyAction = "disable" | "enable" | "revoke";
export type AiApiAccountAction = "pause" | "resume" | "retry-charge";
