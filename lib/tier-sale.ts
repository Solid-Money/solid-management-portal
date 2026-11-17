import { formatUtc } from "@/lib/referral-v4";
import type { TierMembershipConfig } from "@/types";

/**
 * The cash prices of the tier membership: the annual (list) price each tier
 * renews at, and the time-boxed first-year sale price.
 *
 * Kept out of the page so the rules are tested, and so they stay the backend's
 * rules: a sale applies only while `[saleStartsAt, saleEndsAt)` is open and
 * only to a tier whose sale price is positive and strictly below its list
 * price. The mandate is still signed at, and renews at, the list price.
 */

export type TierPricing = Pick<
  TierMembershipConfig,
  | "primeAnnualUsd"
  | "ultraAnnualUsd"
  | "primeSaleUsd"
  | "ultraSaleUsd"
  | "saleStartsAt"
  | "saleEndsAt"
>;

const TIERS = [
  { name: "Prime", list: "primeAnnualUsd", sale: "primeSaleUsd" },
  { name: "Ultra", list: "ultraAnnualUsd", sale: "ultraSaleUsd" },
] as const;

/**
 * A box the admin cleared. The config editor keeps a cleared number as ""
 * rather than 0, and `Number("")` is 0 — which for a list price means "not for
 * sale" — so a blank has to be caught before the payload is built.
 */
function isBlank(value: unknown): boolean {
  return (
    value === "" ||
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

const asTime = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  return Number.isFinite(at) ? at : null;
};

const dollars = (value: number) => `$${value}`;

/**
 * Why the prices can't be saved, or null. The backend applies the same rules
 * and holds the line either way; this names the box that is wrong before the
 * request goes out.
 */
export function tierPricingError(pricing: TierPricing): string | null {
  for (const tier of TIERS) {
    const list = pricing[tier.list];
    if (isBlank(list) || !Number.isFinite(Number(list))) {
      return `Set the ${tier.name} Annual Charge before saving (-1 stops selling ${tier.name} for cash).`;
    }
  }
  for (const tier of TIERS) {
    const sale = pricing[tier.sale];
    if (isBlank(sale) || !Number.isFinite(Number(sale))) {
      return `Set the ${tier.name} Sale Price before saving (-1 means no sale for ${tier.name}).`;
    }
  }

  let anySale = false;
  for (const tier of TIERS) {
    const list = Number(pricing[tier.list]);
    const sale = Number(pricing[tier.sale]);
    if (sale <= 0) continue;
    anySale = true;
    if (list <= 0) {
      return `${tier.name} is not sold for cash (its Annual Charge is ${list}), so it can't have a sale price. Set ${tier.name} Sale Price to -1.`;
    }
    if (sale >= list) {
      return `${tier.name} Sale Price (${dollars(sale)}) has to be below the ${tier.name} Annual Charge (${dollars(list)}).`;
    }
  }

  const start = asTime(pricing.saleStartsAt);
  const end = asTime(pricing.saleEndsAt);
  if (anySale && (start === null || end === null)) {
    return "A sale price needs both Sale Starts and Sale Ends (UTC). Set them, or set the sale prices to -1.";
  }
  if (start !== null && end !== null && end <= start) {
    return "Sale Ends has to be after Sale Starts.";
  }
  return null;
}

/** A tier whose sale price would actually be charged while the window is open. */
export interface TierSaleOffer {
  tier: "Prime" | "Ultra";
  saleUsd: number;
  listUsd: number;
}

/** The tiers on sale: sold for cash, with a sale price above 0 and below list. */
export function tierSaleOffers(pricing: TierPricing): TierSaleOffer[] {
  const offers: TierSaleOffer[] = [];
  for (const tier of TIERS) {
    if (isBlank(pricing[tier.list]) || isBlank(pricing[tier.sale])) continue;
    const listUsd = Number(pricing[tier.list]);
    const saleUsd = Number(pricing[tier.sale]);
    if (listUsd > 0 && saleUsd > 0 && saleUsd < listUsd) {
      offers.push({ tier: tier.name, saleUsd, listUsd });
    }
  }
  return offers;
}

export type TierSaleStatus =
  | { kind: "none" }
  | { kind: "scheduled"; startsAt: string; endsAt: string; offers: TierSaleOffer[] }
  | { kind: "live"; endsAt: string; offers: TierSaleOffer[] }
  | { kind: "ended"; endsAt: string; offers: TierSaleOffer[] };

/**
 * Where the sale stands at `now`, the way the backend decides it: no sale
 * without a tier on offer and a well-formed window, else scheduled before the
 * start, live until the end (exclusive), then ended.
 */
export function tierSaleStatus(
  pricing: TierPricing,
  now: number = Date.now(),
): TierSaleStatus {
  const offers = tierSaleOffers(pricing);
  const start = asTime(pricing.saleStartsAt);
  const end = asTime(pricing.saleEndsAt);
  if (offers.length === 0 || start === null || end === null || end <= start) {
    return { kind: "none" };
  }
  const startsAt = pricing.saleStartsAt as string;
  const endsAt = pricing.saleEndsAt as string;
  if (now < start) return { kind: "scheduled", startsAt, endsAt, offers };
  if (now >= end) return { kind: "ended", endsAt, offers };
  return { kind: "live", endsAt, offers };
}

/** "No sale" / "Scheduled: starts …" / "Live until …" / "Ended …". */
export function tierSaleStatusLabel(status: TierSaleStatus): string {
  switch (status.kind) {
    case "none":
      return "No sale";
    case "scheduled":
      return `Scheduled: starts ${formatUtc(status.startsAt)}, ends ${formatUtc(status.endsAt)}`;
    case "live":
      return `Live until ${formatUtc(status.endsAt)}`;
    case "ended":
      return `Ended ${formatUtc(status.endsAt)}`;
  }
}

/** "Prime $159 first year, then $199/yr · Ultra $799 first year, then $999/yr". */
export function tierSaleOffersLabel(offers: TierSaleOffer[]): string {
  return offers
    .map(
      (offer) =>
        `${offer.tier} ${dollars(offer.saleUsd)} first year, then ${dollars(offer.listUsd)}/yr`,
    )
    .join(" · ");
}
