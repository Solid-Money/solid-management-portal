"use client";

import { Percent, RefreshCw, Save } from "lucide-react";

import {
  ConfigSection,
  InputField,
  ToggleField,
} from "@/components/config/config-fields";
import {
  FEE_PRODUCTS,
  FeeProductRates,
} from "@/components/config/fee-product-rates";
import { useConfigEditor } from "@/hooks/use-config-editor";

/**
 * Product fees — the revenue side of the tier system.
 *
 * Its own page rather than a section of rewards config: rewards decide what we
 * pay users and fees decide what we charge them, and the two are set by
 * different people at different times. They still share one config document and
 * one endpoint, which is why both pages drive `useConfigEditor`.
 */
export default function FeesConfigPage() {
  const {
    config,
    loading,
    saving,
    hasChanges,
    updateConfig,
    handleNumericUpdate,
    saveSection,
    clearCache,
  } = useConfigEditor();

  const saveProductFeesConfig = async () => {
    if (!config) return;

    const { swap, stocks, fx, offRamp, bankDeposit, transfi } =
      config.productFees;

    await saveSection(
      "Product Fees",
      // Endpoint keeps its original path, which is also what the stored config
      // keys are named after.
      "card-fees",
      {
        enabled: config.productFees.enabled,
        swapEnabled: swap.enabled,
        swapTier1Percentage: Number(swap.tier1),
        swapTier2Percentage: Number(swap.tier2),
        swapTier3Percentage: Number(swap.tier3),
        stocksEnabled: stocks.enabled,
        stocksTier1Percentage: Number(stocks.tier1),
        stocksTier2Percentage: Number(stocks.tier2),
        stocksTier3Percentage: Number(stocks.tier3),
        fxEnabled: fx.enabled,
        fxTier1Percentage: Number(fx.tier1),
        fxTier2Percentage: Number(fx.tier2),
        fxTier3Percentage: Number(fx.tier3),
        offRampEnabled: offRamp.enabled,
        offRampTier1Percentage: Number(offRamp.tier1),
        offRampTier2Percentage: Number(offRamp.tier2),
        offRampTier3Percentage: Number(offRamp.tier3),
        bankDepositEnabled: bankDeposit.enabled,
        bankDepositTier1Percentage: Number(bankDeposit.tier1),
        bankDepositTier2Percentage: Number(bankDeposit.tier2),
        bankDepositTier3Percentage: Number(bankDeposit.tier3),
        transfiEnabled: transfi.enabled,
        transfiTier1Percentage: Number(transfi.tier1),
        transfiTier2Percentage: Number(transfi.tier2),
        transfiTier3Percentage: Number(transfi.tier3),
        minChargeUsd: Number(config.productFees.minChargeUsd),
      },
      "productFees",
    );
  };

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

      <ConfigSection
        title="Product Fees"
        description="What Solid earns on every active product. Fees apply only at the edges — swapping, trading, converting currency, and moving money in or out — so holding a card and spending in USD is free on every tier, Core included. There is no monthly fee by design. Rates taper to zero at Ultra, so staking FUSE genuinely drops every fee to zero."
        icon={<Percent className="h-5 w-5 text-amber-600" />}
        defaultOpen
      >
        <div className="space-y-6">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">These values charge real money.</p>
            <p className="mt-1">
              Percentages are entered as percentages (0.5 means 0.5% of the
              transaction). How each fee is collected differs by product — the
              line under each toggle says which — and that difference decides
              what happens when a user is short: an on-chain fee cannot fail, a
              withheld fee never touches a balance, and a billed fee can push
              one negative.
            </p>
          </div>

          <ToggleField
            label="Product Fees Enabled"
            value={config.productFees.enabled}
            onChange={(v) => updateConfig("productFees", "enabled", v)}
            tooltip="Master switch. When off, no fee is charged on any product, on any tier."
          />

          {FEE_PRODUCTS.map((product) => (
            <FeeProductRates
              key={product.key}
              product={product}
              rates={config.productFees[product.key]}
              programEnabled={config.productFees.enabled}
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
          ))}

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
              disabled={!config.productFees.enabled}
              tooltip="Fees computing below this are waived instead of charged. Rain's own minimum is $0.01, and a sub-cent charge costs more in support than it earns."
            />
          </div>
        </div>
        <button
          onClick={saveProductFeesConfig}
          disabled={saving || !hasChanges("productFees")}
          className="mt-4 inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="mr-2 h-4 w-4" />
          Save Product Fees Config
        </button>
      </ConfigSection>
    </div>
  );
}
