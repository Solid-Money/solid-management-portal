import type {
  AiApiCashbackStatus,
  AiApiChargeFailure,
  AiApiChargeStatus,
  AiApiKeyStatus,
  AiApiPauseReason,
  AiApiUpstreamModel,
  AiApiUpstreamOffer,
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
  safe_held: "Safe on hold in the module",
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

/**
 * What AntSeed charges for a gateway model as entered in the table: the
 * pinned seller's offer for `<peerId>@<serviceId>`, otherwise the cheapest
 * seller's, which is where the gateway routes a request that names only a
 * model. Null when the catalog doesn't list it.
 */
export function antseedOfferFor(
  models: AiApiUpstreamModel[] | undefined,
  upstreamModel: string,
): AiApiUpstreamOffer | null {
  const wanted = upstreamModel.trim().toLowerCase();
  if (!models || !wanted) return null;

  const at = wanted.indexOf("@");
  if (at > 0) {
    const peerId = wanted.slice(0, at);
    const serviceId = wanted.slice(at + 1);
    for (const model of models) {
      const offer = model.offers.find(
        (candidate) =>
          candidate.peerId.toLowerCase() === peerId &&
          candidate.serviceId.toLowerCase() === serviceId,
      );
      if (offer) return offer;
    }
    return null;
  }

  const model = models.find(
    (candidate) =>
      candidate.id.toLowerCase() === wanted ||
      candidate.aliases.some((alias) => alias.toLowerCase() === wanted),
  );
  return model?.offers[0] ?? null;
}

/** A rate times a multiple, as a price to type: no float noise, at most 6 decimals. */
export const scaledPrice = (rate: number, multiple: number): string =>
  String(Number((rate * multiple).toFixed(6)));

/** How many times AntSeed's rate a typed price is, as `4.0×`; null when it can't be said. */
export function priceMultiple(price: string, rate: number): string | null {
  const value = Number(price);
  if (price.trim() === "" || !Number.isFinite(value) || rate <= 0) return null;
  return `${(value / rate).toFixed(1)}×`;
}

/** A per-million-token rate: `$2.40`, `$0.0003`. */
export const formatRate = (usd: number): string =>
  usd >= 1 ? `$${usd.toFixed(2)}` : `$${Number(usd.toPrecision(3))}`;
