import type { BadgeVariant } from "@/lib/referral-v4";
import { formatNumber, formatUsd } from "@/lib/utils";
import type {
  KolLimits,
  KolPerk,
  KolPerkIneligibleReason,
  KolPerkStatus,
  UpdateKolPerkBody,
} from "@/types/kols";

/** The backend's bounds, used until the overview has loaded its own. */
export const KOL_DEFAULT_LIMITS: KolLimits = {
  maxTierDiscountPct: 90,
  maxSepaFreeMonths: 12,
  maxSepaFreeCapUsd: 1_000_000,
  maxSignups: 1_000_000,
  maxDays: 366,
  codeMinLength: 6,
  codeMaxLength: 12,
  lateAddDays: 7,
};

export const KOL_PERK_NAME_MAX = 80;
export const KOL_NOTE_MAX = 280;

const DAY_MS = 24 * 60 * 60 * 1000;

export const KOL_PERK_STATUS_LABEL: Record<KolPerkStatus, string> = {
  unattached: "Not attached",
  disabled: "Off",
  scheduled: "Scheduled",
  live: "Live",
  ended: "Ended",
  full: "Full",
  kol_removed: "KOL removed",
};

export const KOL_PERK_STATUS_VARIANT: Record<KolPerkStatus, BadgeVariant> = {
  unattached: "muted",
  disabled: "warning",
  scheduled: "info",
  live: "success",
  ended: "muted",
  full: "muted",
  kol_removed: "danger",
};

export const KOL_PERK_INELIGIBLE_LABEL: Record<KolPerkIneligibleReason, string> = {
  disabled: "Perk was off",
  not_started: "Before the start",
  ended: "After the end",
  kol_removed: "KOL removed",
  signup_limit: "Signup limit reached",
  late_add: "Added the code too late",
};

/**
 * The QA portal is the one that talks to admins-qa; its links must open the
 * QA app and site, as the app's own share links do there.
 */
const IS_QA = /^https:\/\/admins-qa\.solid\.xyz\/?$/i.test(
  process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? "",
);

/** Where the app's own referral links point: the website and the app. */
export const REFERRAL_WEBSITE_URL = (
  process.env.NEXT_PUBLIC_SOLID_WEBSITE_URL ||
  (IS_QA ? "https://solid-qa.webflow.io" : "https://www.solid.xyz")
).replace(/\/+$/, "");

export const REFERRAL_APP_URL = (
  process.env.NEXT_PUBLIC_SOLID_APP_URL ||
  (IS_QA ? "https://app-qa.solid.xyz" : "https://app.solid.xyz")
).replace(/\/+$/, "");

/**
 * The two links a code is shared as, the same ones the app builds for a
 * user's own code: the website's referral page and the app's invite link
 * (which opens the app when installed).
 */
export function kolReferralLinks(code: string): { website: string; app: string } {
  const encoded = encodeURIComponent(code);
  return {
    website: `${REFERRAL_WEBSITE_URL}/refer?ref=${encoded}`,
    app: `${REFERRAL_APP_URL}/invite/${encoded}`,
  };
}

/** "50% off first year · 1 month free SEPA (up to $10,000)". */
export function perkBenefitsLabel(
  perk: Pick<KolPerk, "tierDiscountPct" | "sepaFreeMonths" | "sepaFreeCapUsd">,
): string {
  const parts: string[] = [];
  if (perk.tierDiscountPct > 0) {
    parts.push(`${perk.tierDiscountPct}% off first year`);
  }
  if (perk.sepaFreeMonths > 0) {
    parts.push(
      `${perk.sepaFreeMonths} month${perk.sepaFreeMonths === 1 ? "" : "s"} free SEPA (up to ${formatUsd(perk.sepaFreeCapUsd, 0)})`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "No benefits";
}

export function signupsLabel(granted: number, maxSignups: number | null): string {
  const count = formatNumber(granted, 0, 0);
  return maxSignups ? `${count} / ${formatNumber(maxSignups, 0, 0)}` : count;
}

/** A typed code as stored: trimmed and upper case. */
export function normalizePerkCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidPerkCode(
  code: string,
  limits: Pick<KolLimits, "codeMinLength" | "codeMaxLength"> = KOL_DEFAULT_LIMITS,
): boolean {
  return (
    /^[A-Za-z0-9]+$/.test(code) &&
    code.length >= limits.codeMinLength &&
    code.length <= limits.codeMaxLength
  );
}

export interface KolPerkDraft {
  name: string;
  /** As typed; empty means "generate one" on create. */
  code: string;
  enabled: boolean;
  /** ISO instants, or null when not set. */
  startsAt: string | null;
  endsAt: string | null;
  /** As typed. */
  tierDiscountPct: string;
  sepaFreeMonths: string;
  sepaFreeCapUsd: string;
  /** As typed; empty means no limit. */
  maxSignups: string;
}

const isWhole = (value: string) => /^\d+$/.test(value.trim());

/**
 * Why a draft can't be saved, or null. The backend's rules, so a typo is
 * caught before the request — the backend holds the line either way, and is
 * the only one that can tell whether a code is taken.
 *
 * `current` is the perk being edited: an ended window only stops a save that
 * switches it on or moves its end.
 */
export function kolPerkDraftError(
  draft: KolPerkDraft,
  limits: KolLimits = KOL_DEFAULT_LIMITS,
  now: number = Date.now(),
  current: Pick<KolPerk, "enabled" | "endsAt"> | null = null,
): string | null {
  const name = draft.name.trim();
  if (!name) return "Give the perk a name.";
  if (name.length > KOL_PERK_NAME_MAX) {
    return `The name can be at most ${KOL_PERK_NAME_MAX} characters.`;
  }

  const code = draft.code.trim();
  if ((current || code) && !isValidPerkCode(code, limits)) {
    return `The code must be ${limits.codeMinLength}–${limits.codeMaxLength} letters and digits.`;
  }

  if (!draft.startsAt || !draft.endsAt) return "Set a start and an end.";
  const start = Date.parse(draft.startsAt);
  const end = Date.parse(draft.endsAt);
  if (!(end > start)) return "The end has to be after the start.";
  if (end - start > limits.maxDays * DAY_MS) {
    return `A perk can run for at most ${limits.maxDays} days.`;
  }

  if (!isWhole(draft.tierDiscountPct)) {
    return "The membership discount must be a whole percentage.";
  }
  const pct = Number(draft.tierDiscountPct);
  if (pct > limits.maxTierDiscountPct) {
    return `The membership discount can be at most ${limits.maxTierDiscountPct}%.`;
  }

  if (!isWhole(draft.sepaFreeMonths)) {
    return "Free SEPA months must be a whole number.";
  }
  const months = Number(draft.sepaFreeMonths);
  if (months > limits.maxSepaFreeMonths) {
    return `Free SEPA can last at most ${limits.maxSepaFreeMonths} months.`;
  }
  if (months > 0) {
    const cap = Number(draft.sepaFreeCapUsd);
    // Read off the typed decimal, never `cap * 100`: 0.29 * 100 is
    // 28.999999999999996, which would refuse a valid cap.
    if (
      !/^\d+(\.\d{1,2})?$/.test(draft.sepaFreeCapUsd.trim()) ||
      !Number.isFinite(cap) ||
      cap <= 0
    ) {
      return "Free SEPA needs a cap above $0, to the cent.";
    }
    if (cap > limits.maxSepaFreeCapUsd) {
      return `The free SEPA cap can be at most ${formatUsd(limits.maxSepaFreeCapUsd, 0)}.`;
    }
  }
  if (pct === 0 && months === 0) {
    return "Give the perk a membership discount, free SEPA months, or both.";
  }

  if (draft.maxSignups.trim() !== "") {
    if (!isWhole(draft.maxSignups) || Number(draft.maxSignups) < 1) {
      return "The signup limit must be a whole number, or empty for none.";
    }
    if (Number(draft.maxSignups) > limits.maxSignups) {
      return `The signup limit can be at most ${formatNumber(limits.maxSignups, 0, 0)}.`;
    }
  }

  const switchingOn = draft.enabled && !current?.enabled;
  const endMoved = !!current && draft.endsAt !== current.endsAt;
  if (draft.enabled && (switchingOn || endMoved) && end <= now) {
    return "This perk has already ended. Move its end into the future to switch it on.";
  }
  return null;
}

/** The cap as sent: 0 when the perk gives no free SEPA. */
function capOf(draft: KolPerkDraft): number {
  return Number(draft.sepaFreeMonths) > 0 ? Number(draft.sepaFreeCapUsd) : 0;
}

/** A valid draft as the create body. */
export function kolPerkCreateBody(
  draft: KolPerkDraft,
  kolId?: string,
): {
  name: string;
  code?: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  tierDiscountPct: number;
  sepaFreeMonths: number;
  sepaFreeCapUsd: number;
  maxSignups: number | null;
  kolId?: string;
} {
  const code = normalizePerkCode(draft.code);
  return {
    name: draft.name.trim(),
    ...(code && { code }),
    enabled: draft.enabled,
    startsAt: draft.startsAt ?? "",
    endsAt: draft.endsAt ?? "",
    tierDiscountPct: Number(draft.tierDiscountPct),
    sepaFreeMonths: Number(draft.sepaFreeMonths),
    sepaFreeCapUsd: capOf(draft),
    maxSignups: draft.maxSignups.trim() === "" ? null : Number(draft.maxSignups),
    ...(kolId && { kolId }),
  };
}

/** What a valid draft changes on `current`: only those fields are sent. */
export function kolPerkChanges(
  current: KolPerk,
  draft: KolPerkDraft,
): Omit<UpdateKolPerkBody, "version"> {
  const changes: Omit<UpdateKolPerkBody, "version"> = {};
  const name = draft.name.trim();
  if (name !== current.name) changes.name = name;
  const code = normalizePerkCode(draft.code);
  if (code !== current.code) changes.code = code;
  if (draft.enabled !== current.enabled) changes.enabled = draft.enabled;
  if (draft.startsAt && draft.startsAt !== current.startsAt) {
    changes.startsAt = draft.startsAt;
  }
  if (draft.endsAt && draft.endsAt !== current.endsAt) {
    changes.endsAt = draft.endsAt;
  }
  const pct = Number(draft.tierDiscountPct);
  if (pct !== current.tierDiscountPct) changes.tierDiscountPct = pct;
  const months = Number(draft.sepaFreeMonths);
  if (months !== current.sepaFreeMonths) changes.sepaFreeMonths = months;
  const cap = capOf(draft);
  if (cap !== current.sepaFreeCapUsd) changes.sepaFreeCapUsd = cap;
  const maxSignups =
    draft.maxSignups.trim() === "" ? null : Number(draft.maxSignups);
  if (maxSignups !== current.maxSignups) changes.maxSignups = maxSignups;
  return changes;
}

/** The username as the backend looks it up: trimmed, no leading @, lower case. */
export function normalizeKolUsername(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}
