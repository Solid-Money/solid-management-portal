import type {
  AiApiCashbackStatus,
  AiApiChargeFailure,
  AiApiChargeStatus,
  AiApiKeyStatus,
  AiApiModelPriceState,
  AiApiPauseReason,
  AiApiTokenRates,
  AiApiUpstreamModel,
  AiApiUpstreamOffer,
} from "@/types/ai-api";
import { formatDateTime, formatNumber } from "@/lib/utils";

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

/** Output speed as `85 tok/s`; `—` when too few requests ran to say. */
export const formatTokensPerSecond = (value: number | null | undefined): string =>
  value == null || !Number.isFinite(value) ? "—" : `${formatNumber(value, 0, 0)} tok/s`;

/** Time to first token, ms, as `1.2 s`; `—` when too few requests ran to say. */
export const formatFirstToken = (ms: number | null | undefined): string =>
  // Rounded in tenths first: `(0.35).toFixed(1)` is "0.3".
  ms == null || !Number.isFinite(ms) ? "—" : `${(Math.round(ms / 100) / 10).toFixed(1)} s`;

/**
 * At this share of a key's monthly limit used (as a whole percent), the users
 * table flags its holder, so support can reach out before requests stop. Only
 * the user can raise a limit: it needs a mandate they sign.
 */
export const NEAR_LIMIT_PERCENT = 80;

/** A share of a limit as a whole percent: 0.82 → 82. */
export const usedPercent = (share: number): number =>
  Number.isFinite(share) ? Math.round(share * 100) : 0;

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

/** Three rates as one line: `in $0.08 · out $0.60 · cached $0.04`. */
export const formatRates = (rates: AiApiTokenRates): string =>
  `in ${formatRate(rates.inputUsdPerMTok)} · out ${formatRate(
    rates.outputUsdPerMTok,
  )} · cached ${formatRate(rates.cachedInputUsdPerMTok)}`;

/**
 * What a markup is worth to us after the most generous tier's cashback, as a
 * multiple of AntSeed's rate: 4× with 50% back nets 2×. Under 1 loses money
 * on every request a capped user makes.
 */
export const netMultiple = (markup: number, cashbackRates: number[]): number =>
  markup * (1 - Math.min(1, Math.max(0, ...cashbackRates)));

/**
 * What the row under a model priced from AntSeed says about its price: what
 * users pay now and AntSeed's typical rate, or why the fixed prices still
 * apply. `live` is whether the saved model is priced from AntSeed, at this
 * gateway model: the draft may have just turned it on.
 */
export function autoPriceStatus(
  state: AiApiModelPriceState | undefined,
  upstreamModel: string,
  live: boolean,
): { text: string; warn: boolean } {
  const same =
    !!state &&
    state.upstreamModel.trim().toLowerCase() ===
      upstreamModel.trim().toLowerCase();
  if (!live || !same) {
    return {
      text: "Priced from AntSeed as soon as this is saved. The fixed prices above apply until its rates are read.",
      warn: false,
    };
  }
  if (!state.listed) {
    return {
      text: `Not on AntSeed's model list${
        state.unlistedSince ? ` since ${formatDateTime(state.unlistedSince)}` : ""
      }: ${state.prices ? "it keeps its last price" : "the fixed prices above apply"}.`,
      warn: true,
    };
  }
  const reference = state.reference;
  const typical = !reference
    ? ""
    : reference.sellers === 0
      ? " Every AntSeed seller gives it away right now, so it keeps its last price."
      : ` AntSeed's typical rate: ${formatRates(reference)}, across ${reference.sellers} seller${
          reference.sellers === 1 ? "" : "s"
        }.`;
  if (!state.prices) {
    return {
      text: `Waiting for a paid AntSeed rate; the fixed prices above apply.${typical}`,
      warn: false,
    };
  }
  return {
    text: `Users pay ${formatRates(state.prices)}${
      state.pricedAt ? `, set ${formatDateTime(state.pricedAt)}` : ""
    }.${typical}`,
    warn: false,
  };
}
