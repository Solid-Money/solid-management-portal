"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  InputField,
  ToggleField,
} from "@/components/config/config-fields";
import { FeeFlatCharge } from "@/types";

/** The config field holding one flat onboarding charge. */
export type OnboardingFeeKey =
  | "rainCardOnboarding"
  | "rainVirtualAccountOnboarding";

export interface OnboardingFeeDefinition {
  key: OnboardingFeeKey;
  label: string;
  /** One line for the section header — what this charge buys. */
  summary: string;
  toggleTooltip: string;
  amountTooltip: string;
}

/**
 * The two one-time Rain onboarding charges.
 *
 * Separate products, not one shared "Rain onboarding": a user can open a card
 * and later a virtual account, each costs us its own Didit session and its own
 * Rain review, and each is charged once. Sharing a line would let the second
 * ride free on the first one's payment.
 */
export const ONBOARDING_FEES: OnboardingFeeDefinition[] = [
  {
    key: "rainCardOnboarding",
    label: "Rain Card Setup",
    summary: "Charged once, before a Rain card application is started",
    toggleTooltip:
      "Replaces the $10 savings balance applicants used to have to deposit and hold, which recovered none of what they cost us. Wirex applicants are never charged — they cost us nothing per head.",
    amountTooltip:
      "Covers roughly $1 for the Didit verification and $2.50 for Rain's own KYC, both paid before the applicant is worth anything.",
  },
  {
    key: "rainVirtualAccountOnboarding",
    label: "Rain Virtual Account Setup",
    summary: "Charged once, before a Rain USD virtual account is opened",
    toggleTooltip:
      "Charged separately from the card: a virtual account is its own Didit session and its own Rain review, so it costs us the same again.",
    amountTooltip:
      "Shown to the user on the fee sheet before they pay, and verified on-chain against the treasury before anything is started.",
  },
];

export interface OnboardingFeeChargeProps {
  definition: OnboardingFeeDefinition;
  charge: FeeFlatCharge;
  onToggle: (enabled: boolean) => void;
  onAmountChange: (value: string) => void;
  onOverridesChange: (overrides: Record<string, number>) => void;
}

/**
 * One flat onboarding charge: its switch, its headline amount, and the markets
 * priced apart from it.
 *
 * The overrides are edited as rows rather than raw JSON because a `0` here is
 * meaningful — it waives the fee for that market — and a hand-edited JSON blob
 * is exactly where a dropped key silently re-prices a country back to the
 * headline amount.
 */
export function OnboardingFeeCharge({
  definition,
  charge,
  onToggle,
  onAmountChange,
  onOverridesChange,
}: OnboardingFeeChargeProps) {
  const overrides = Object.entries(charge.countryOverrides ?? {});

  const setOverride = (
    previousCode: string,
    nextCode: string,
    amount: number,
  ) => {
    const next: Record<string, number> = { ...charge.countryOverrides };
    delete next[previousCode];
    const code = nextCode.trim().toUpperCase();
    if (code) next[code] = amount;
    onOverridesChange(next);
  };

  const removeOverride = (code: string) => {
    const next = { ...charge.countryOverrides };
    delete next[code];
    onOverridesChange(next);
  };

  const addOverride = () => {
    // An empty key is a row the admin has not filled in yet. It is never saved:
    // the endpoint refuses anything that is not a 2-letter code, so a blank row
    // left behind is caught rather than stored.
    onOverridesChange({ ...charge.countryOverrides, "": 0 });
  };

  return (
    <div className="space-y-4">
      <ToggleField
        label={`${definition.label} Fee Enabled`}
        value={charge.enabled}
        onChange={onToggle}
        tooltip={definition.toggleTooltip}
      />

      <div className="max-w-xs">
        <InputField
          label="Amount"
          value={charge.amountUsd}
          onChange={onAmountChange}
          type="number"
          suffix="$"
          min={0}
          step="0.01"
          tooltip={definition.amountTooltip}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">
            Country overrides
          </p>
          <button
            type="button"
            onClick={addOverride}
            className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add country
          </button>
        </div>

        <p className="mb-3 text-xs text-gray-500">
          Two-letter country codes (BD, US). A country listed here pays its own
          amount instead of the one above; <strong>0 waives the fee</strong>{" "}
          there. Priced from the user&apos;s KYC-verified residence, not their
          IP, so travel or a VPN cannot move anyone between bands.
        </p>

        {overrides.length === 0 ? (
          <p className="text-xs text-gray-400">
            No country is priced apart — everyone pays the amount above.
          </p>
        ) : (
          <div className="space-y-2">
            {overrides.map(([code, amount], index) => (
              <div key={`${code}-${index}`} className="flex items-end gap-2">
                <div className="w-28">
                  <InputField
                    label="Country"
                    value={code}
                    onChange={(v) => setOverride(code, v, amount)}
                  />
                </div>
                <div className="w-32">
                  <InputField
                    label="Amount"
                    value={amount}
                    onChange={(v) => setOverride(code, code, Number(v) || 0)}
                    type="number"
                    suffix="$"
                    min={0}
                    step="0.01"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeOverride(code)}
                  aria-label={`Remove ${code || "country"} override`}
                  className="mb-2 cursor-pointer rounded-md border border-gray-300 p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
