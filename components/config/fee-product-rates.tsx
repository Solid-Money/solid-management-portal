"use client";

import {
  ArrowLeftRight,
  ArrowUpFromLine,
  Globe,
  Landmark,
  ShoppingCart,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

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
  /** One line for the section header — what this fee is charged on. */
  summary: string;
  icon: LucideIcon;
  /** How this fee actually reaches us — the operational difference that matters. */
  collection: string;
  toggleTooltip: string;
  /**
   * The row's label in the app's own fee table, which is not always this
   * product's label here. Named so an admin flipping the visibility toggle can
   * see which row on the tier screen they are switching.
   */
  appRowLabel: string;
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
    summary: "Charged on fiat arriving from a bank",
    icon: Landmark,
    collection:
      "Withheld from the arriving amount before the user is credited, so it can never push a balance negative.",
    toggleTooltip:
      "Charged on fiat arriving from a bank. Taken out of the deposit rather than billed back afterwards.",
    appRowLabel: "Bank deposit",
    tierTooltips: {
      tier1: "Headline bank deposit rate.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra deposits for free.",
    },
  },
  {
    key: "swap",
    label: "Swaps",
    summary: "Charged on in-app token swaps",
    icon: ArrowLeftRight,
    collection:
      "Deducted from the source token and transferred on-chain inside the user's own swap transaction — no extra signature, and nothing to retry. Needs REVENUE_WALLET_ADDRESS set, or no transfer is built and nothing is collected.",
    toggleTooltip:
      "Charged on in-app token swaps. Collected on-chain at the moment of the swap.",
    appRowLabel: "Swaps",
    tierTooltips: {
      tier1: "Headline swap rate.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra swaps for free.",
    },
  },
  {
    key: "stocks",
    label: "Stocks",
    summary: "Charged on tokenised-equity trades",
    icon: TrendingUp,
    collection:
      "Taken from the sell side (USDC when buying, the stock when selling) inside the CoW pre-sign batch, on mainnet. Needs REVENUE_WALLET_ADDRESS set, as the swap fee does.",
    toggleTooltip:
      "Charged on tokenised-equity trades. Collected on-chain in the same batch that pre-signs the CoW order.",
    appRowLabel: "Stocks",
    tierTooltips: {
      tier1: "Headline stocks trading rate.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra trades for free.",
    },
  },
  {
    key: "fx",
    label: "FX Conversion",
    summary: "Charged when a card purchase settles in another currency",
    icon: Globe,
    collection:
      "Rain bills it against the card balance after the purchase settles. Wirex has no charge API, so its fees are collected by a separate on-chain spend from the cardholder's Safe — a different transaction from the settlement sweep, so a Safe too short for the fee never fails the purchase recovery.",
    toggleTooltip:
      "Charged when a card purchase settles in a currency other than USD. A purchase in USD is never charged an FX fee.",
    appRowLabel: "FX conversion",
    tierTooltips: {
      tier1: "Headline FX rate, applied on both the Rain and Wirex rails.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra converts currency for free.",
    },
  },
  {
    key: "offRamp",
    label: "Bank Withdrawal",
    summary: "Charged on money leaving Solid for a bank account",
    icon: ArrowUpFromLine,
    collection:
      "Charged when funds leave Solid for a bank account, which includes a completed card off-ramp.",
    toggleTooltip:
      "Charged on money leaving Solid. Only ever applied after the withdrawal completes, so it bills against money that actually moved.",
    appRowLabel: "Bank withdrawal",
    tierTooltips: {
      tier1: "Headline withdrawal rate.",
      tier2: "Reduced rate for Prime.",
      tier3: "Keep at 0 so Ultra withdraws for free.",
    },
  },
  {
    key: "transfi",
    label: "Buy Crypto (TransFi)",
    summary: "Charged on buy-crypto orders through TransFi",
    icon: ShoppingCart,
    collection:
      "Charged after the order settles, against the USDC that arrived rather than the fiat paid — TransFi takes its own cut in between. Billed on a Rain card; on Wirex it is collected from the cardholder's Safe, and a wallet-only buyer with no card Safe stays accrued.",
    toggleTooltip:
      "Charged on buy-crypto orders through TransFi's card and local payment rails.",
    appRowLabel: "Buy crypto",
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
 * One product's two switches and its three per-tier rates.
 *
 * Rendered per product rather than written out six times: the blocks are
 * identical apart from their labels, and six copies is how a rate ends up
 * validated on one product and not another.
 *
 * The two switches answer different questions and neither implies the other.
 * "Fees Enabled" decides whether the user is charged; "Show in App" decides
 * whether the app's tier fee table lists the product at all. Both mixed states
 * are ones we actually want: a fee that is live before it is announced, and a
 * row shown at "Free" on a product we have not switched on. So the rate inputs
 * are disabled by the charge switch only — hiding a row is a display decision
 * and must never be mistaken for turning a fee off.
 *
 * The charge switch is also the only gate on charging. There is no program-wide
 * switch above it — each fee is turned on and off on its own, so switching on
 * the one you are ready to charge cannot be blocked by, or accidentally enable,
 * the five you are not.
 *
 * Rates are stored as fractions and edited as percentages, so the input
 * multiplies by 100 on the way in. The empty-string check keeps the field
 * controlled while an admin is mid-edit — without it, clearing the box would
 * snap the value back to 0 and read as "this tier is free".
 */
export function FeeProductRates({
  product,
  rates,
  onToggle,
  onShowInAppToggle,
  onRateChange,
}: {
  product: FeeProductDefinition;
  rates: FeeRates;
  onToggle: (value: boolean) => void;
  onShowInAppToggle: (value: boolean) => void;
  onRateChange: (tier: FeeTierKey, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <ToggleField
        label={`${product.label} Fees Enabled`}
        value={rates.enabled}
        onChange={onToggle}
        tooltip={product.toggleTooltip}
      />
      <p className="text-sm text-gray-500">{product.collection}</p>
      <ToggleField
        label="Show in App"
        value={rates.showInApp}
        onChange={onShowInAppToggle}
        tooltip={`Lists the "${product.appRowLabel}" row in the app's tier Fees & Caps table. Display only: switching it off hides the row on every tier but does not stop the fee being charged.`}
      />
      <p className="text-sm text-gray-500">
        {rates.showInApp
          ? `Shown as "${product.appRowLabel}" on the tier benefits screen, at this tier's rate.`
          : `Hidden from the tier benefits screen.${
              rates.enabled
                ? " The fee is still charged — only the row is hidden."
                : ""
            }`}
      </p>
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
              disabled={!rates.enabled}
              tooltip={product.tierTooltips[tier.key]}
            />
          </TierCard>
        ))}
      </TierGrid>
    </div>
  );
}
