import { formatNumber, formatUsd } from "@/lib/utils";
import type {
  TierBalanceAccessReason,
  TierBalanceAudience,
  TierBalanceConfig,
  TierBalanceConfigField,
  TierBalanceEventCause,
  TierBalanceEventType,
  TierBalanceGrantTier,
  TierBalanceRunKind,
  TierBalanceRunResult,
  TierBalanceRunStatus,
  TierBalanceRunTrigger,
  TierBalanceTrackStatus,
} from "@/types";

/**
 * The Hold in Earn tier route's form rules and labels, kept free of React so
 * the ranges are tested once. Every number the route runs on is admin config:
 * nothing here is a threshold or a day count, only the ranges the backend DTO
 * accepts (mirrored so the admin hears about a bad value before a 400).
 */

export type BadgeVariant = "warning" | "success" | "info" | "danger" | "muted";

export const TIER_BALANCE_NUMBER_FIELDS = [
  "primeUsd",
  "ultraUsd",
  "lookbackDays",
  "maxMissingDays",
  "graceDays",
  "reentryDays",
  "sampleIntervalMinutes",
  "watchFloorUsd",
] as const;

export const TIER_BALANCE_BOOLEAN_FIELDS = [
  "enabled",
  "collectionEnabled",
  "notificationsEnabled",
  "countCreditCollateral",
  "subtractCreditDebt",
  "countLockedFuse",
] as const;

export type TierBalanceNumberField = (typeof TIER_BALANCE_NUMBER_FIELDS)[number];
export type TierBalanceBooleanField =
  (typeof TIER_BALANCE_BOOLEAN_FIELDS)[number];

/**
 * The form as the admin edits it: numbers kept as typed, so a box can be
 * cleared to retype without the value jumping to 0. Mapped over every config
 * field, so a field added to the contract but missing from the lists above
 * fails to compile in {@link toTierBalanceDraft} instead of leaving the form.
 */
export type TierBalanceDraft = {
  [K in TierBalanceConfigField]: TierBalanceConfig[K] extends number
    ? string
    : TierBalanceConfig[K];
};

/**
 * The ranges the backend accepts. `ultraUsd` must also be above `primeUsd`, and
 * `maxMissingDays` below `lookbackDays` — checked in {@link tierBalanceFieldErrors}.
 */
export const TIER_BALANCE_BOUNDS: Record<
  TierBalanceNumberField,
  { min: number; max: number; integer?: true }
> = {
  primeUsd: { min: 100, max: 10_000_000 },
  ultraUsd: { min: 100, max: 100_000_000 },
  lookbackDays: { min: 1, max: 365, integer: true },
  maxMissingDays: { min: 0, max: 364, integer: true },
  graceDays: { min: 0, max: 90, integer: true },
  reentryDays: { min: 0, max: 365, integer: true },
  sampleIntervalMinutes: { min: 15, max: 1440, integer: true },
  watchFloorUsd: { min: 0, max: 10_000_000 },
};

const USD_FIELDS: ReadonlySet<TierBalanceConfigField> = new Set([
  "primeUsd",
  "ultraUsd",
  "watchFloorUsd",
]);
const DAY_FIELDS: ReadonlySet<TierBalanceConfigField> = new Set([
  "lookbackDays",
  "maxMissingDays",
  "graceDays",
  "reentryDays",
]);

/** What each field is called in the form and in a preview's change list. */
export const TIER_BALANCE_FIELD_LABELS: Record<TierBalanceConfigField, string> =
  {
    enabled: "Route grants tiers",
    collectionEnabled: "Measure Earn balances",
    audience: "Audience",
    notificationsEnabled: "Push notifications",
    primeUsd: "Prime threshold",
    ultraUsd: "Ultra threshold",
    lookbackDays: "Lookback",
    maxMissingDays: "Days allowed unmeasured",
    graceDays: "Grace",
    reentryDays: "Re-entry wait",
    sampleIntervalMinutes: "Intraday sample interval",
    watchFloorUsd: "Watch floor",
    countCreditCollateral: "Count Credit collateral",
    subtractCreditDebt: "Subtract Credit debt",
    countLockedFuse: "Count locked soFUSE",
  };

export const TIER_BALANCE_AUDIENCE_LABELS: Record<TierBalanceAudience, string> =
  {
    team: "Internal team (tagged members only)",
    everyone: "Everyone",
  };

export function toTierBalanceDraft(config: TierBalanceConfig): TierBalanceDraft {
  const numbers = Object.fromEntries(
    TIER_BALANCE_NUMBER_FIELDS.map((field) => [field, String(config[field])]),
  ) as { [K in TierBalanceNumberField]: string };
  const switches = Object.fromEntries(
    TIER_BALANCE_BOOLEAN_FIELDS.map((field) => [field, config[field]]),
  ) as { [K in TierBalanceBooleanField]: boolean };
  return { ...numbers, ...switches, audience: config.audience };
}

/** A typed box as a number, or null when blank or not a number. */
function parsed(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function amount(field: TierBalanceNumberField, value: number): string {
  if (USD_FIELDS.has(field)) {
    return formatUsd(value, Number.isInteger(value) ? 0 : 2);
  }
  return formatNumber(value, 0, 0);
}

/** "between $100 and $10,000,000", in the field's own unit. */
function rangeText(field: TierBalanceNumberField, min: number, max: number) {
  return `between ${amount(field, min)} and ${amount(field, max)}`;
}

/**
 * Why each box cannot be saved, by field; empty when the form is valid.
 * Mirrors the backend DTO: blank, not a number, a fraction where a whole
 * number belongs, out of range, Ultra not above Prime, or more days allowed
 * unmeasured than the lookback leaves.
 */
export function tierBalanceFieldErrors(
  draft: TierBalanceDraft,
): Partial<Record<TierBalanceNumberField, string>> {
  const errors: Partial<Record<TierBalanceNumberField, string>> = {};
  const values: Partial<Record<TierBalanceNumberField, number>> = {};

  for (const field of TIER_BALANCE_NUMBER_FIELDS) {
    const value = parsed(draft[field]);
    const { min, max, integer } = TIER_BALANCE_BOUNDS[field];
    if (draft[field].trim() === "") {
      errors[field] = "Required.";
    } else if (value === null) {
      errors[field] = "Must be a number.";
    } else if (integer && !Number.isInteger(value)) {
      errors[field] = "Must be a whole number.";
    } else if (value < min || value > max) {
      errors[field] = `Must be ${rangeText(field, min, max)}.`;
    } else {
      values[field] = value;
    }
  }

  const prime = values.primeUsd;
  const ultra = values.ultraUsd;
  if (prime !== undefined && ultra !== undefined && ultra <= prime) {
    errors.ultraUsd = `Must be above the Prime threshold (${amount(
      "primeUsd",
      prime,
    )}).`;
  }

  const lookback = values.lookbackDays;
  const missing = values.maxMissingDays;
  if (lookback !== undefined && missing !== undefined && missing > lookback - 1) {
    errors.maxMissingDays =
      lookback === 1
        ? "Must be 0 while the lookback is 1 day."
        : `Must be ${rangeText("maxMissingDays", 0, lookback - 1)} — fewer than the lookback.`;
  }

  return errors;
}

/**
 * The fields the draft changes against the saved config, as the API takes
 * them. Only meaningful for a draft with no field errors.
 */
export function tierBalanceChanges(
  draft: TierBalanceDraft,
  saved: TierBalanceConfig,
): Partial<TierBalanceConfig> {
  const changes: Partial<TierBalanceConfig> = {};
  for (const field of TIER_BALANCE_BOOLEAN_FIELDS) {
    if (draft[field] !== saved[field]) changes[field] = draft[field];
  }
  if (draft.audience !== saved.audience) changes.audience = draft.audience;
  for (const field of TIER_BALANCE_NUMBER_FIELDS) {
    const value = parsed(draft[field]);
    if (value !== null && value !== saved[field]) changes[field] = value;
  }
  return changes;
}

/**
 * Whether a box holds the saved value, so its override can go. Numbers compare
 * as text against the saved number's own text: a half-typed "7500." stays an
 * override while the admin types instead of snapping back to "7500".
 */
function holdsSavedValue<K extends TierBalanceConfigField>(
  field: K,
  value: TierBalanceDraft[K],
  saved: TierBalanceConfig,
): boolean {
  const current: unknown = saved[field];
  return typeof value === "string" && field !== "audience"
    ? value.trim() === String(current)
    : value === current;
}

/**
 * The admin's overrides after setting one box. An override equal to the saved
 * value is dropped rather than kept: a box typed back to what is saved must
 * not become a rollback once another admin saves something else there.
 */
export function withTierBalanceEdit<K extends TierBalanceConfigField>(
  edits: Partial<TierBalanceDraft>,
  field: K,
  value: TierBalanceDraft[K],
  saved: TierBalanceConfig,
): Partial<TierBalanceDraft> {
  const next = { ...edits };
  if (holdsSavedValue(field, value, saved)) delete next[field];
  else next[field] = value;
  return next;
}

/**
 * The overrides still pending after a save: those the saved config now holds
 * (numbers compared as numbers) are dropped, and edits made while the preview
 * was open — not part of the save — are kept.
 */
export function pendingTierBalanceEdits(
  edits: Partial<TierBalanceDraft>,
  saved: TierBalanceConfig,
): Partial<TierBalanceDraft> {
  const next: Partial<TierBalanceDraft> = {};
  for (const [field, value] of Object.entries(edits) as Array<
    [TierBalanceConfigField, TierBalanceDraft[TierBalanceConfigField]]
  >) {
    const savedNow =
      typeof value === "string" && field !== "audience"
        ? parsed(value) === saved[field]
        : value === saved[field];
    if (!savedNow) Object.assign(next, { [field]: value });
  }
  return next;
}

/**
 * The overrides once a box is left: an override that is numerically the saved
 * value ("7500.00" over 7500) is dropped, so it cannot turn into a rollback
 * when a refresh brings another admin's save. While the box has focus its text
 * is kept as typed ({@link withTierBalanceEdit}). Returns `edits` itself when
 * nothing changes.
 */
export function settleTierBalanceEdit(
  edits: Partial<TierBalanceDraft>,
  field: TierBalanceConfigField,
  saved: TierBalanceConfig,
): Partial<TierBalanceDraft> {
  if (!(field in edits)) return edits;
  const kept = pendingTierBalanceEdits({ [field]: edits[field] }, saved);
  if (field in kept) return edits;
  const next = { ...edits };
  delete next[field];
  return next;
}

/** Whether a config grants tiers through the route to every user. */
function openToEveryone(config: Pick<TierBalanceConfig, "enabled" | "audience">) {
  return config.enabled && config.audience === "everyone";
}

/**
 * Whether going from `current` to `proposed` releases the route to every user:
 * the audience widening on an enabled route, or a route already set to
 * everyone being switched on. Mirrors the backend's release warning.
 */
export function releasesTierBalanceToEveryone(
  current: Pick<TierBalanceConfig, "enabled" | "audience">,
  proposed: Pick<TierBalanceConfig, "enabled" | "audience">,
): boolean {
  return !openToEveryone(current) && openToEveryone(proposed);
}

/** A config value as the preview's change list shows it. */
export function formatTierBalanceValue(
  field: TierBalanceConfigField,
  value: unknown,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (field === "audience") {
    return TIER_BALANCE_AUDIENCE_LABELS[value as TierBalanceAudience] ?? String(value);
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (USD_FIELDS.has(field)) {
    return formatUsd(number, Number.isInteger(number) ? 0 : 2);
  }
  if (DAY_FIELDS.has(field)) {
    return `${formatNumber(number, 0, 0)} day${number === 1 ? "" : "s"}`;
  }
  if (field === "sampleIntervalMinutes") {
    return `${formatNumber(number, 0, 0)} min`;
  }
  return String(value);
}

/** A USD figure from the route, or a dash when it has not been measured. */
export function tierBalanceUsd(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatUsd(value)
    : "—";
}

export const TIER_BALANCE_TIER_LABELS: Record<TierBalanceGrantTier, string> = {
  core: "Core",
  prime: "Prime",
  ultra: "Ultra",
};

export const TIER_BALANCE_TIER_VARIANT: Record<TierBalanceGrantTier, BadgeVariant> =
  {
    core: "muted",
    prime: "info",
    ultra: "success",
  };

export const TIER_BALANCE_TRACK_STATUS: Record<
  TierBalanceTrackStatus,
  { label: string; variant: BadgeVariant; hint: string }
> = {
  none: {
    label: "Not building",
    variant: "muted",
    hint: "The balance is below this tier's threshold.",
  },
  building: {
    label: "Building",
    variant: "info",
    hint: "At or above the threshold; unlocks once it holds through the lookback.",
  },
  active: {
    label: "Active",
    variant: "success",
    hint: "Unlocked through this route; kept while the balance stays at the pinned threshold.",
  },
  grace: {
    label: "In grace",
    variant: "warning",
    hint: "Below the threshold; the tier ends unless the balance is back above in time.",
  },
  cooldown: {
    label: "Cooldown",
    variant: "danger",
    hint: "Ended on this route recently; cannot unlock again until the re-entry date.",
  },
};

export const TIER_BALANCE_ACCESS_REASON: Record<
  TierBalanceAccessReason,
  { label: string; variant: BadgeVariant }
> = {
  team: { label: "Tagged on the internal team", variant: "success" },
  everyone: { label: "Released to everyone", variant: "success" },
  "not-tagged": {
    label: "Not tagged — the route is staged to tagged team members",
    variant: "muted",
  },
  disabled: { label: "The route is switched off", variant: "warning" },
};

export const TIER_BALANCE_EVENT_TYPE: Record<
  TierBalanceEventType,
  { label: string; variant: BadgeVariant }
> = {
  unlocked: { label: "Unlocked", variant: "success" },
  grace_started: { label: "Grace started", variant: "warning" },
  grace_cleared: { label: "Grace cleared", variant: "info" },
  ended: { label: "Ended", variant: "danger" },
  reevaluated: { label: "Re-evaluated by admin", variant: "muted" },
};

export const TIER_BALANCE_EVENT_CAUSE: Record<TierBalanceEventCause, string> = {
  outflow: "Money moved out",
  price: "Price moved",
  mixed: "Outflow and price",
  unknown: "Unknown",
};

export const TIER_BALANCE_RUN_STATUS: Record<
  TierBalanceRunStatus,
  { label: string; variant: BadgeVariant }
> = {
  running: { label: "Running", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  partial: { label: "Partial", variant: "warning" },
  failed: { label: "Failed", variant: "danger" },
};

export const TIER_BALANCE_RUN_KIND: Record<TierBalanceRunKind, string> = {
  full: "Full measurement",
  watch: "Intraday (watched users)",
  users: "Single users",
};

export const TIER_BALANCE_RUN_TRIGGER: Record<TierBalanceRunTrigger, string> = {
  cron: "Schedule",
  admin: "Admin",
  transfer: "Transfer",
};

const plural = (count: number, word: string) =>
  `${formatNumber(count, 0, 0)} ${word}${count === 1 ? "" : "s"}`;

/** One line on what a "Run now" did, for the admin who started it. */
export type TierBalanceRunOutcome = "success" | "warning" | "failed";

/**
 * How a "Run now" went, for its toast and icons: a failed measurement is not a
 * success, and a partial run or one the server did not report (another run
 * held the lock) is worth a second look.
 */
export function tierBalanceRunOutcome(
  result: TierBalanceRunResult,
): TierBalanceRunOutcome {
  if (result.action === "evaluate") return result.evaluated ? "success" : "warning";
  const run = result.run;
  if (!run) return "warning";
  if (run.status === "failed") return "failed";
  return run.status === "completed" ? "success" : "warning";
}

export function describeTierBalanceRun(result: TierBalanceRunResult): string {
  if (result.action === "evaluate") {
    const evaluated = result.evaluated;
    if (!evaluated) return "The server reported no evaluation.";
    return (
      `Evaluated ${evaluated.day}: ${plural(evaluated.users, "user")} checked; ` +
      `${formatNumber(evaluated.unlocked, 0, 0)} unlocked, ` +
      `${formatNumber(evaluated.graceStarted, 0, 0)} entered grace, ` +
      `${formatNumber(evaluated.graceCleared, 0, 0)} cleared grace, ` +
      `${formatNumber(evaluated.ended, 0, 0)} ended.`
    );
  }

  const run = result.run;
  if (!run) return "The server reported no measurement run.";
  const { stats } = run;
  const line =
    `${TIER_BALANCE_RUN_KIND[run.kind] ?? run.kind} for ${run.dayKey}: ` +
    `${(TIER_BALANCE_RUN_STATUS[run.status]?.label ?? run.status).toLowerCase()}. ` +
    `${plural(stats.scanned, "Safe")} scanned, ${formatNumber(stats.valued, 0, 0)} valued, ` +
    `${formatNumber(stats.written, 0, 0)} written, ${formatNumber(stats.incomplete, 0, 0)} incomplete, ` +
    `${formatNumber(stats.aboveFloor, 0, 0)} at or above the watch floor.`;
  return run.error ? `${line} Error: ${run.error}` : line;
}
