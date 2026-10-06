"use client";

import { BadgeDollarSign, Percent, RefreshCw, Save } from "lucide-react";

import {
  ConfigSection,
  InputField,
} from "@/components/config/config-fields";
import {
  FEE_PRODUCTS,
  FeeProductRates,
  type FeeProductDefinition,
} from "@/components/config/fee-product-rates";
import {
  ONBOARDING_FEES,
  OnboardingFeeCharge,
  type OnboardingFeeDefinition,
} from "@/components/config/onboarding-fee-charge";
import { useConfigEditor } from "@/hooks/use-config-editor";
import { FeeFlatCharge, FeeRates, ProductFeesConfig } from "@/types";

/**
 * Flattens one product's rates into the field names the endpoint expects.
 *
 * `PATCH card-fees` takes all six products in one payload, so every save has to
 * send all six — see {@link FeesConfigPage} for why the other five come from the
 * saved copy rather than the working one.
 */
function productFields(
  key: FeeProductDefinition["key"],
  rates: FeeRates,
): Record<string, number | boolean> {
  return {
    [`${key}Enabled`]: rates.enabled,
    [`${key}Tier1Percentage`]: Number(rates.tier1),
    [`${key}Tier2Percentage`]: Number(rates.tier2),
    [`${key}Tier3Percentage`]: Number(rates.tier3),
  };
}

/**
 * Flattens one flat onboarding charge into the field names the endpoint
 * expects.
 *
 * The endpoint keys these on the SHORT names the stored config uses
 * (`rainVaOnboarding...`), which is not what the config field is called
 * (`rainVirtualAccountOnboarding`) — so the mapping lives here rather than
 * being derived from the key.
 */
function onboardingFields(
  key: OnboardingFeeDefinition["key"],
  charge: FeeFlatCharge,
): Record<string, number | boolean | Record<string, number>> {
  const prefix =
    key === "rainCardOnboarding" ? "rainCardOnboarding" : "rainVaOnboarding";

  return {
    [`${prefix}Enabled`]: charge.enabled,
    [`${prefix}AmountUsd`]: Number(charge.amountUsd),
    [`${prefix}CountryOverrides`]: charge.countryOverrides ?? {},
  };
}

/**
 * Product fees — the revenue side of the tier system.
 *
 * Its own page rather than a section of rewards config: rewards decide what we
 * pay users and fees decide what we charge them, and the two are set by
 * different people at different times. They still share one config document and
 * one endpoint, which is why both pages drive `useConfigEditor`.
 *
 * Each product is its own section with its own toggle and its own Save. There is
 * no program-wide switch: turning a fee on is a decision per product, and one
 * master toggle either blocks the fee you are ready to charge or, flipped, arms
 * the five you are not. The stored config still carries a program flag, which
 * this page keeps on — the per-product toggles are the real gate.
 *
 * Because all six products share one endpoint, a save has to send all six. It
 * sends the OTHER five from the last copy the server confirmed, so saving Swaps
 * cannot publish half-finished edits sitting in the Stocks section.
 */
export default function FeesConfigPage() {
  const {
    config,
    savedConfig,
    loading,
    saving,
    hasChanges,
    updateConfig,
    handleNumericUpdate,
    saveSection,
    clearCache,
  } = useConfigEditor();

  /**
   * Saves one block, taking every other block from the saved copy.
   *
   * @param field the `productFees` field being published, so only that one is
   * re-baselined and the other sections' Save buttons keep their own state.
   */
  const savePartial = async (
    label: string,
    field: keyof ProductFeesConfig,
    overrides: Record<string, number | boolean | Record<string, number>>,
  ) => {
    if (!config || !savedConfig) return;

    const saved = savedConfig.productFees;
    const published = FEE_PRODUCTS.reduce<
      Record<string, number | boolean | Record<string, number>>
    >(
      (fields, product) => ({
        ...fields,
        ...productFields(product.key, saved[product.key]),
      }),
      {},
    );

    // The flat onboarding lines ride the same endpoint, so they go out on every
    // save as well — from the SAVED copy, for the same reason the other five
    // products do: saving Swaps must not publish a half-typed country override.
    for (const fee of ONBOARDING_FEES) {
      Object.assign(published, onboardingFields(fee.key, saved[fee.key]));
    }

    await saveSection(
      label,
      // Endpoint keeps its original path, which is also what the stored config
      // keys are named after.
      "card-fees",
      {
        ...published,
        minChargeUsd: Number(saved.minChargeUsd),
        // The per-product toggles are the gate, so the program flag stays on.
        // Sending it false here would silently zero every rate on the page.
        enabled: true,
        ...overrides,
      },
      "productFees",
      field,
    );
  };

  const saveProduct = (product: FeeProductDefinition) =>
    savePartial(
      `${product.label} Fees`,
      product.key,
      productFields(product.key, config!.productFees[product.key]),
    );

  const saveOnboardingFee = (fee: OnboardingFeeDefinition) =>
    savePartial(
      `${fee.label} Fee`,
      fee.key,
      onboardingFields(fee.key, config!.productFees[fee.key]),
    );

  const saveMinimumCharge = () =>
    savePartial("Minimum Charge", "minChargeUsd", {
      minChargeUsd: Number(config!.productFees.minChargeUsd),
    });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Could not load the fee configuration.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-100 p-2">
            <Percent className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fees Config</h1>
            <p className="text-sm text-gray-500">
              What each product charges, per tier
            </p>
          </div>
        </div>
        <button
          onClick={clearCache}
          className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Clear Cache
        </button>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">These values charge real money.</p>
        <p className="mt-1">
          Percentages are entered as percentages (0.5 means 0.5% of the
          transaction). Each fee is switched on and saved on its own, so turning
          one on never arms the rest. How a fee is collected differs by product —
          the line under each toggle says which — and that difference decides
          what happens when a user is short: an on-chain fee cannot fail, a
          withheld fee never touches a balance, and a billed fee can push one
          negative. Fees apply only at the edges, so holding a card and spending
          in USD is free on every tier, Core included. Rates taper to zero at
          Ultra, so staking FUSE genuinely drops every fee to zero.
        </p>
      </div>

      {FEE_PRODUCTS.map((product, index) => (
        <ConfigSection
          key={product.key}
          title={product.label}
          description={product.summary}
          icon={<product.icon className="h-5 w-5 text-amber-600" />}
          // First one open, as on the rewards page, so the page opens on a
          // worked example rather than seven collapsed rows.
          defaultOpen={index === 0}
        >
          <FeeProductRates
            product={product}
            rates={config.productFees[product.key]}
            onToggle={(v) =>
              updateConfig("productFees", `${product.key}.enabled`, v)
            }
            onRateChange={(tier, v) =>
              handleNumericUpdate(
                "productFees",
                `${product.key}.${tier}`,
                v,
                true,
              )
            }
          />
          <button
            onClick={() => saveProduct(product)}
            disabled={saving || !hasChanges("productFees", product.key)}
            className="mt-4 inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="mr-2 h-4 w-4" />
            Save {product.label} Fees
          </button>
        </ConfigSection>
      ))}

      {ONBOARDING_FEES.map((fee) => (
        <ConfigSection
          key={fee.key}
          title={fee.label}
          description={fee.summary}
          icon={<BadgeDollarSign className="h-5 w-5 text-amber-600" />}
        >
          <OnboardingFeeCharge
            definition={fee}
            charge={config.productFees[fee.key]}
            onToggle={(v) =>
              updateConfig("productFees", `${fee.key}.enabled`, v)
            }
            onAmountChange={(v) =>
              handleNumericUpdate("productFees", `${fee.key}.amountUsd`, v)
            }
            onOverridesChange={(overrides) =>
              updateConfig(
                "productFees",
                `${fee.key}.countryOverrides`,
                overrides,
              )
            }
          />
          <button
            onClick={() => saveOnboardingFee(fee)}
            disabled={saving || !hasChanges("productFees", fee.key)}
            className="mt-4 inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="mr-2 h-4 w-4" />
            Save {fee.label} Fee
          </button>
        </ConfigSection>
      ))}

      <ConfigSection
        title="Minimum Charge"
        description="The floor below which a computed fee is waived instead of charged"
        icon={<Percent className="h-5 w-5 text-amber-600" />}
      >
        <div className="max-w-xs">
          <InputField
            label="Minimum Charge"
            value={config.productFees.minChargeUsd}
            onChange={(v) =>
              handleNumericUpdate("productFees", "minChargeUsd", v)
            }
            type="number"
            suffix="$"
            min={0}
            step="0.01"
            tooltip="Applies to every product. Rain's own minimum is $0.01, and a sub-cent charge costs more in support than it earns."
          />
        </div>
        <button
          onClick={saveMinimumCharge}
          disabled={saving || !hasChanges("productFees", "minChargeUsd")}
          className="mt-4 inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="mr-2 h-4 w-4" />
          Save Minimum Charge
        </button>
      </ConfigSection>
    </div>
  );
}
