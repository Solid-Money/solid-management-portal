import { isoToUtcInput, utcInputToIso } from "@/lib/referral-v4";
import type { BadgeVariant } from "@/lib/referral-v4";
import type {
  FeePromotion,
  FeePromotionStatus,
} from "@/types/fee-promotions";

/** The backend's bounds, used until the list has loaded its own. */
export const FEE_PROMOTION_DEFAULT_LIMITS = {
  maxFreeCountPerUser: 50,
  maxDays: 366,
};

export const FEE_PROMOTION_NAME_MAX = 80;

const DAY_MS = 24 * 60 * 60 * 1000;

export const FEE_PROMOTION_STATUS_LABEL: Record<FeePromotionStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  ended: "Ended",
  disabled: "Off",
};

export const FEE_PROMOTION_STATUS_VARIANT: Record<
  FeePromotionStatus,
  BadgeVariant
> = {
  scheduled: "info",
  live: "success",
  ended: "muted",
  disabled: "warning",
};

/**
 * Where a promotion stands at `now`, the way the backend decides it: off when
 * switched off, else scheduled before its start, live until its end (which is
 * exclusive), then ended.
 */
export function feePromotionStatus(
  promotion: Pick<FeePromotion, "enabled" | "startsAt" | "endsAt">,
  now: number = Date.now(),
): FeePromotionStatus {
  if (!promotion.enabled) return "disabled";
  if (now < new Date(promotion.startsAt).getTime()) return "scheduled";
  if (now >= new Date(promotion.endsAt).getTime()) return "ended";
  return "live";
}

export interface FeePromotionDraft {
  name: string;
  enabled: boolean;
  /** ISO instants, or null when not set. */
  startsAt: string | null;
  endsAt: string | null;
  /** As typed. */
  freeCountPerUser: string;
}

/**
 * Why a draft can't be saved, or null. The same rules the backend applies, so
 * a typo is caught before the request — the backend holds the line either way
 * (and is the only one that can check for an overlapping promotion).
 *
 * `current` is the promotion being edited, or null for a new one: an ended
 * window only stops a save that switches the promotion on or moves its end,
 * so one left on past its end can still be renamed or recounted.
 */
export function feePromotionDraftError(
  draft: FeePromotionDraft,
  limits: { maxFreeCountPerUser: number; maxDays: number } = FEE_PROMOTION_DEFAULT_LIMITS,
  now: number = Date.now(),
  current: Pick<FeePromotion, "enabled" | "endsAt"> | null = null,
): string | null {
  const name = draft.name.trim();
  if (!name) return "Give the promotion a name.";
  if (name.length > FEE_PROMOTION_NAME_MAX) {
    return `The name can be at most ${FEE_PROMOTION_NAME_MAX} characters.`;
  }
  const count = Number(draft.freeCountPerUser);
  if (
    draft.freeCountPerUser.trim() === "" ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > limits.maxFreeCountPerUser
  ) {
    return `Free deposits per user must be a whole number from 1 to ${limits.maxFreeCountPerUser}.`;
  }
  if (!draft.startsAt || !draft.endsAt) return "Set both the start and the end.";
  const start = new Date(draft.startsAt).getTime();
  const end = new Date(draft.endsAt).getTime();
  if (end <= start) return "The end has to be after the start.";
  if (end - start > limits.maxDays * DAY_MS) {
    return `A promotion can run for at most ${limits.maxDays} days.`;
  }
  if (draft.enabled && end <= now) {
    if (!current?.enabled) {
      return "That window has already ended. Move the end into the future to switch it on.";
    }
    if (new Date(current.endsAt).getTime() !== end) {
      return "That end has already passed. Move it into the future, or switch the promotion off.";
    }
  }
  return null;
}

/**
 * The fields of a draft that differ from the promotion being edited, as the
 * PATCH body sends them. Unchanged fields are left out so the backend's
 * change notice lists only what moved.
 */
export function feePromotionChanges(
  current: Pick<
    FeePromotion,
    "name" | "enabled" | "startsAt" | "endsAt" | "freeCountPerUser"
  >,
  draft: FeePromotionDraft,
): {
  name?: string;
  enabled?: boolean;
  startsAt?: string;
  endsAt?: string;
  freeCountPerUser?: number;
} {
  const changes: ReturnType<typeof feePromotionChanges> = {};
  const name = draft.name.trim();
  if (name !== current.name) changes.name = name;
  if (draft.enabled !== current.enabled) changes.enabled = draft.enabled;
  if (
    draft.startsAt &&
    new Date(draft.startsAt).getTime() !== new Date(current.startsAt).getTime()
  ) {
    changes.startsAt = draft.startsAt;
  }
  if (
    draft.endsAt &&
    new Date(draft.endsAt).getTime() !== new Date(current.endsAt).getTime()
  ) {
    changes.endsAt = draft.endsAt;
  }
  const count = Number(draft.freeCountPerUser);
  if (count !== current.freeCountPerUser) changes.freeCountPerUser = count;
  return changes;
}

/** "3 free deposits" / "1 free deposit". */
export function freeDepositsLabel(count: number): string {
  return `${count} free deposit${count === 1 ? "" : "s"}`;
}

/**
 * The instant a window input stands for. The input only holds minutes, so a
 * stored boundary with seconds would come back moved by up to 59 of them and
 * read as an edit; while the input still shows the stored minute, the stored
 * instant is kept as it is.
 */
export function windowInstant(
  input: string,
  stored?: string | null,
): string | null {
  if (stored && input === isoToUtcInput(stored)) return stored;
  return utcInputToIso(input);
}

/**
 * When the status shown for any of these promotions next changes — its
 * nearest start or end still ahead of `now` — or null when none will.
 */
export function nextStatusChange(
  promotions: Pick<FeePromotion, "enabled" | "startsAt" | "endsAt">[],
  now: number = Date.now(),
): number | null {
  let next: number | null = null;
  for (const promotion of promotions) {
    if (!promotion.enabled) continue;
    for (const boundary of [promotion.startsAt, promotion.endsAt]) {
      const at = new Date(boundary).getTime();
      if (Number.isFinite(at) && at > now && (next === null || at < next)) {
        next = at;
      }
    }
  }
  return next;
}
