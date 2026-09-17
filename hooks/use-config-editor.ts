"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import api from "@/lib/api";
import {
  FullRewardsConfig,
  ProductFeesConfig,
  ReferralCashbackConfig,
} from "@/types";

/** Shipped defaults for the referral cashback program (mirrors the backend). */
export const REFERRAL_CASHBACK_DEFAULTS: ReferralCashbackConfig = {
  enabled: true,
  referrerRewardUsd: 15,
  newUserRewardUsd: 15,
  spendTargetUsd: 75,
  merchantTarget: 3,
  qualifyWindowDays: 30,
  payoutDelayDays: 30,
  reversalWindowDays: 60,
  autoReviewMonthlyThreshold: 20,
};

/**
 * Day-one rates: 0.5% on Core, halving at Prime, zero at Ultra — and off.
 *
 * `enabled: false` is the real default. The fees page has no master switch, so
 * saving one product turns the program on, and a product still sitting on a
 * default would come on with it.
 */
const DEFAULT_RATES = {
  enabled: false,
  tier1: 0.005,
  tier2: 0.0025,
  tier3: 0,
};

/**
 * Shipped defaults for the product fee program (mirrors the backend).
 *
 * Charging users money is a launch decision made per product on the fees page,
 * not by a deploy.
 */
export const PRODUCT_FEES_DEFAULTS: ProductFeesConfig = {
  enabled: false,
  swap: { ...DEFAULT_RATES },
  stocks: { ...DEFAULT_RATES },
  fx: { ...DEFAULT_RATES },
  offRamp: { ...DEFAULT_RATES },
  bankDeposit: { ...DEFAULT_RATES },
  transfi: { ...DEFAULT_RATES },
  minChargeUsd: 0.01,
};

/**
 * Fill in fields an older backend may not send yet, so the inputs stay
 * controlled and a save never posts `undefined`/`NaN` for them. Applied to both
 * the working copy and the pristine copy so the defaults don't read as unsaved
 * changes.
 */
export function withConfigDefaults(
  config: FullRewardsConfig,
): FullRewardsConfig {
  const fees = config.productFees;

  return {
    ...config,
    points: {
      ...config.points,
      cardBalanceEnabled: config.points.cardBalanceEnabled ?? false,
      cardBalancePointsPerDollarPerHour:
        config.points.cardBalancePointsPerDollarPerHour ?? 1,
    },
    referralCashback: {
      ...REFERRAL_CASHBACK_DEFAULTS,
      ...config.referralCashback,
    },
    productFees: {
      ...PRODUCT_FEES_DEFAULTS,
      ...fees,
      swap: { ...PRODUCT_FEES_DEFAULTS.swap, ...fees?.swap },
      stocks: { ...PRODUCT_FEES_DEFAULTS.stocks, ...fees?.stocks },
      fx: { ...PRODUCT_FEES_DEFAULTS.fx, ...fees?.fx },
      offRamp: { ...PRODUCT_FEES_DEFAULTS.offRamp, ...fees?.offRamp },
      bankDeposit: {
        ...PRODUCT_FEES_DEFAULTS.bankDeposit,
        ...fees?.bankDeposit,
      },
      transfi: { ...PRODUCT_FEES_DEFAULTS.transfi, ...fees?.transfi },
    },
  };
}

export interface ConfigEditor {
  config: FullRewardsConfig | null;
  /**
   * The last copy the server confirmed.
   *
   * Exposed because one endpoint can own several independently-saved blocks —
   * the fee page saves one product at a time through the same `card-fees`
   * endpoint that carries all six. Building that payload from this copy for
   * every block except the one being saved is what stops a Save on one product
   * publishing another product's half-finished edits.
   */
  savedConfig: FullRewardsConfig | null;
  loading: boolean;
  saving: boolean;
  /**
   * Whether a section — or one field within it — differs from what the server
   * last confirmed.
   */
  hasChanges: (section: keyof FullRewardsConfig, field?: string) => boolean;
  /** Set one field. `field` may be dotted for one level of nesting. */
  updateConfig: (
    section: keyof FullRewardsConfig,
    field: string,
    value: string | number | boolean | string[],
  ) => void;
  /** Set a numeric field, optionally converting a percentage to a fraction. */
  handleNumericUpdate: (
    section: keyof FullRewardsConfig,
    field: string,
    value: string,
    isPercentage?: boolean,
  ) => void;
  setConfig: React.Dispatch<React.SetStateAction<FullRewardsConfig | null>>;
  saveSection: (
    section: string,
    endpoint: string,
    data: Record<string, unknown>,
    configKey: keyof FullRewardsConfig,
    /**
     * The nested field that was actually published. Omit to re-baseline the
     * whole section; pass one when several fields share an endpoint, so the
     * others' Save buttons keep reflecting their own unsaved edits.
     */
    field?: string,
  ) => Promise<void>;
  clearCache: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Loading, dirty-tracking and saving for the admin config pages.
 *
 * One document (`/admin/v1/rewards-config`) is edited by more than one page, so
 * this owns the whole cycle rather than each page repeating it: fetch,
 * normalise against defaults, track per-section changes against a pristine
 * copy, and re-baseline only the section that was saved. That last part is what
 * lets a page save one section without the others' Save buttons going quiet.
 */
export function useConfigEditor(): ConfigEditor {
  const { user } = useAuth();
  const [config, setConfig] = useState<FullRewardsConfig | null>(null);
  const [originalConfig, setOriginalConfig] =
    useState<FullRewardsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/v1/rewards-config");
      const normalized = withConfigDefaults(response.data);
      setConfig(normalized);
      // A structural clone, not a reference: the pristine copy has to survive
      // every in-place edit to the working one.
      setOriginalConfig(JSON.parse(JSON.stringify(normalized)));
    } catch (error) {
      console.error("Failed to fetch rewards config:", error);
      toast.error("Failed to fetch configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void fetchConfig();
    }
  }, [user, fetchConfig]);

  const hasChanges = useCallback(
    (section: keyof FullRewardsConfig, field?: string): boolean => {
      if (!config || !originalConfig) return false;

      const current = config[section];
      const saved = originalConfig[section];

      if (!field) return JSON.stringify(current) !== JSON.stringify(saved);

      const read = (value: unknown) =>
        typeof value === "object" && value !== null
          ? (value as Record<string, unknown>)[field]
          : undefined;

      return JSON.stringify(read(current)) !== JSON.stringify(read(saved));
    },
    [config, originalConfig],
  );

  const updateConfig = useCallback(
    (
      section: keyof FullRewardsConfig,
      field: string,
      value: string | number | boolean | string[],
    ) => {
      setConfig((prev) => {
        if (!prev) return prev;

        const sectionData = prev[section];
        if (typeof sectionData !== "object" || sectionData === null) {
          return prev;
        }

        const keys = field.split(".");

        if (keys.length === 1) {
          return {
            ...prev,
            [section]: { ...sectionData, [field]: value },
          };
        }

        if (keys.length === 2) {
          const [group, prop] = keys;
          const nested = (sectionData as unknown as Record<string, unknown>)[
            group
          ];
          return {
            ...prev,
            [section]: {
              ...sectionData,
              [group]: {
                ...(typeof nested === "object" && nested !== null
                  ? nested
                  : {}),
                [prop]: value,
              },
            },
          };
        }

        return prev;
      });
    },
    [],
  );

  const handleNumericUpdate = useCallback(
    (
      section: keyof FullRewardsConfig,
      field: string,
      value: string,
      isPercentage = false,
    ) => {
      // An empty box stays empty rather than snapping to 0 — otherwise clearing
      // a rate mid-edit reads as "this tier is free".
      if (value === "") {
        updateConfig(section, field, "");
        return;
      }

      const num = isPercentage ? parseFloat(value) / 100 : parseFloat(value);
      if (isNaN(num)) return;

      updateConfig(section, field, num);
    },
    [updateConfig],
  );

  const saveSection = useCallback(
    async (
      section: string,
      endpoint: string,
      data: Record<string, unknown>,
      configKey: keyof FullRewardsConfig,
      field?: string,
    ) => {
      try {
        setSaving(true);
        await api.patch(`/admin/v1/rewards-config/${endpoint}`, data);
        toast.success(`${section} configuration saved`, {
          description:
            "The changes have been applied successfully and will propagate shortly.",
          duration: 5000,
          className: "p-5 text-lg",
          descriptionClassName: "text-base",
        });
        // Re-baseline only what was published, so everything else keeps
        // reflecting its own unsaved edits — the section, or one field within it
        // when several share an endpoint.
        setOriginalConfig((prev) => {
          if (!prev || !config) return prev;

          const clone = (value: unknown) =>
            JSON.parse(JSON.stringify(value)) as unknown;

          if (!field) {
            return { ...prev, [configKey]: clone(config[configKey]) };
          }

          const current = config[configKey] as unknown as Record<
            string,
            unknown
          >;
          return {
            ...prev,
            [configKey]: {
              ...(prev[configKey] as unknown as Record<string, unknown>),
              [field]: clone(current?.[field]),
            },
          };
        });
      } catch (error) {
        console.error(`Failed to save ${section} config:`, error);
        toast.error(`Failed to save ${section} configuration`);
      } finally {
        setSaving(false);
      }
    },
    [config],
  );

  const clearCache = useCallback(async () => {
    try {
      await api.post("/admin/v1/rewards-config/clear-cache");
      toast.success("Configuration cache cleared", {
        description:
          "The system cache has been refreshed with the latest values.",
        duration: 4000,
        className: "p-4 text-base",
      });
    } catch (error) {
      console.error("Failed to clear cache:", error);
      toast.error("Failed to clear configuration cache");
    }
  }, []);

  return {
    config,
    savedConfig: originalConfig,
    loading,
    saving,
    hasChanges,
    updateConfig,
    handleNumericUpdate,
    setConfig,
    saveSection,
    clearCache,
    refetch: fetchConfig,
  };
}
