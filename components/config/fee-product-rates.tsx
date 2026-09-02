"use client";

import {
  InputField,
  TierCard,
  TierGrid,
  ToggleField,
} from "@/components/config/config-fields";
import { FeeRates, ProductFeesConfig } from "@/types";

/** A tier key on a fee rate block. */
export type FeeTierKey = "tier1" | "tier2" | "tier3";

/** The config field holding one product's rates. */
export type FeeProductKey =
  | "bankDeposit"
  | "swap"
  | "stocks"
  | "fx"
  | "offRamp"
  | "transfi";

export interface FeeProductDefinition {
  key: FeeProductKey;
  label: string;
  /** How this fee actually reaches us — the operational difference that matters. */
  collection: string;
  toggleTooltip: string;
  tierTooltips: Record<FeeTierKey, string>;
}

/**
 * The fee products, in the order the app's own fee table shows them.
 *
 * Each carries the copy explaining how its fee is collected, because that is
 * what differs between them and what an admin needs to know before switching
 * one on: an on-chain fee cannot fail, a withheld fee never touches a balance,
 * and a billed fee can push one negative.
 */
export const FEE_PRODUCTS: FeeProductDefinition[] = [
  {
    key: "bankDeposit",
    label: "Bank Deposit",
    collection:
      "Withheld from the arriving amount before the user is credited, so it can never push a balance negative.",
    toggleTooltip:
      "Charged on fiat arriving from a bank. Taken out of the deposit rather than billed back afterwards.",
    tierTooltips: {
      tier1: "Headline bank deposit rate.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra deposits for free.",
    },
  },
  {
    key: "swap",
    label: "Swaps",
    collection:
      "Deducted from the source token and transferred on-chain inside the user's own swap transaction — no extra signature, and nothing to retry.",
    toggleTooltip:
      "Charged on in-app token swaps. Collected on-chain at the moment of the swap.",
    tierTooltips: {
      tier1: "Headline swap rate.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra swaps for free.",
    },
  },
  {
    key: "stocks",
    label: "Stocks",
    collection:
      "Taken from the sell side (USDC when buying, the stock when selling) inside the CoW pre-sign batch, on mainnet.",
    toggleTooltip:
      "Charged on tokenised-equity trades. Collected on-chain in the same batch that pre-signs the CoW order.",
    tierTooltips: {
      tier1: "Headline stocks trading rate.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra trades for free.",
    },
  },
  {
    key: "fx",
    label: "FX Conversion",
    collection:
      "Rain bills it against the card balance after the purchase settles. Wirex has no charge API, so its fees accrue and await collection.",
    toggleTooltip:
      "Charged when a card purchase settles in a currency other than USD. A purchase in USD is never charged an FX fee.",
    tierTooltips: {
      tier1: "Headline FX rate, applied on both the Rain and Wirex rails.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra converts currency for free.",
    },
  },
  {
    key: "offRamp",
    label: "Bank Withdrawal",
    collection:
      "Charged when funds leave Solid for a bank account, which includes a completed card off-ramp.",
    toggleTooltip:
      "Charged on money leaving Solid. Only ever applied after the withdrawal completes, so it bills against money that actually moved.",
    tierTooltips: {
      tier1: "Headline withdrawal rate.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra withdraws for free.",
    },
  },
  {
    key: "transfi",
    label: "Buy Crypto (TransFi)",
    collection:
      "Charged after the order settles, against the USDC that arrived rather than the fiat paid — TransFi takes its own cut in between. Billed on a Rain card; accrued for Wirex and wallet-only users.",
    toggleTooltip:
      "Charged on buy-crypto orders through TransFi's card and local payment rails.",
    tierTooltips: {
      tier1: "Headline buy-crypto rate, on top of TransFi's own fee.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra buys crypto for free.",
    },
  },
];

export const FEE_TIERS: { key: FeeTierKey; card: string; tierName: string }[] =
  [
    { key: "tier1", card: "Tier 1", tierName: "Core" },
    { key: "tier2", card: "Tier 2", tierName: "Prime" },
    { key: "tier3", card: "Tier 3", tierName: "Ultra" },
  ];

/** Every product's rates, keyed the way the config document holds them. */
export type ProductFeeRatesMap = Pick<ProductFeesConfig, FeeProductKey>;

/**
 * One product's enable toggle and its three per-tier rates.
 *
 * Rendered per product rather than written out six times: the blocks are
 * identical apart from their labels, and six copies is how a rate ends up
 * validated on one product and not another.
 *
 * Rates are stored as fractions and edited as percentages, so the input
 * multiplies by 100 on the way in. The empty-string check keeps the field
 * controlled while an admin is mid-edit — without it, clearing the box would
 * snap the value back to 0 and read as "this tier is free".
 */
export function FeeProductRates({
  product,
  rates,
  programEnabled,
  onToggle,
  onRateChange,
}: {
  product: FeeProductDefinition;
  rates: FeeRates;
  programEnabled: boolean;
  onToggle: (value: boolean) => void;
  onRateChange: (tier: FeeTierKey, value: string) => void;
}) {
  const disabled = !programEnabled || !rates.enabled;

  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-4">
      <ToggleField
        label={`${product.label} Fees Enabled`}
        value={rates.enabled}
        onChange={onToggle}
        disabled={!programEnabled}
        tooltip={product.toggleTooltip}
      />
      <p className="text-sm text-gray-500">{product.collection}</p>
      <TierGrid>
        {FEE_TIERS.map((tier) => (
          <TierCard key={tier.key} tier={tier.card}>
            <InputField
              label={`${tier.tierName} ${product.label} Fee`}
              value={
                (rates[tier.key] as unknown as string) === ""
                  ? ""
                  : rates[tier.key] * 100
              }
              onChange={(v) => onRateChange(tier.key, v)}
              type="number"
              suffix="%"
              min={0}
              step="0.01"
              disabled={disabled}
              tooltip={product.tierTooltips[tier.key]}
            />
          </TierCard>
        ))}
      </TierGrid>
    </div>
  );
}
