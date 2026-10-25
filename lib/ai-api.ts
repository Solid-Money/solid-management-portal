import type {
  AiApiCashbackStatus,
  AiApiChargeFailure,
  AiApiChargeStatus,
  AiApiKeyStatus,
  AiApiPauseReason,
} from "@/types/ai-api";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "muted";

export const PAUSE_REASON_LABELS: Record<AiApiPauseReason, string> = {
  wallet_empty: "Wallet empty",
  billing_mandate: "No mandate",
  admin: "Paused by admin",
};

export const KEY_STATUS: Record<AiApiKeyStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "Active", variant: "success" },
  limit_reached: { label: "Limit reached", variant: "warning" },
  paused: { label: "Paused", variant: "warning" },
  disabled: { label: "Disabled", variant: "danger" },
};

export const CHARGE_STATUS: Record<AiApiChargeStatus, { label: string; variant: BadgeVariant }> = {
  open: { label: "Waiting", variant: "muted" },
  processing: { label: "Processing", variant: "info" },
  charged: { label: "Charged", variant: "success" },
  waived: { label: "Waived", variant: "muted" },
};

export const CHARGE_FAILURE_LABELS: Record<AiApiChargeFailure, string> = {
  wallet_empty: "Wallet empty",
  billing_mandate: "Mandate refused",
  too_early: "Too early in the period",
  transient: "Temporary error",
};

export const CASHBACK_STATUS: Record<
  AiApiCashbackStatus,
  { label: string; variant: BadgeVariant }
> = {
  none: { label: "None", variant: "muted" },
  pending: { label: "Pending", variant: "info" },
  paid: { label: "Paid", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

/** `1.2M`, `840.0K`, `312`. */
export const formatTokens = (tokens: number): string =>
  tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(1)}M`
    : tokens >= 1_000
      ? `${(tokens / 1_000).toFixed(1)}K`
      : tokens.toLocaleString();

/** A UTC day key (`2026-10-14`) as `Oct 14`. */
export const formatDay = (day: string): string =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
