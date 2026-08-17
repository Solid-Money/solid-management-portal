"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Settings,
  Gift,
  Percent,
  Coins,
  Users,
  Calendar,
  Wallet,
  HelpCircle,
  CreditCard,
  Mail,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { FullRewardsConfig, ReferralCashbackConfig } from "@/types";
import TierUsersModal from "@/components/tier-users-modal";
import TierEmailModal from "@/components/tier-email-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help inline-block ml-1" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface ConfigSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function ConfigSection({
  title,
  description,
  icon,
  children,
  defaultOpen = false,
}: ConfigSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
      >
        <div className="flex items-center space-x-3">
          {icon}
          <div className="text-left">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="text-sm text-gray-500 font-normal">{description}</p>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>
      {isOpen && <div className="px-6 py-4 space-y-4">{children}</div>}
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  suffix?: string;
  disabled?: boolean;
  min?: number;
  step?: string;
  tooltip?: string;
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  suffix,
  disabled = false,
  min,
  step,
  tooltip,
}: InputFieldProps) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <div className="flex items-center">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          min={min}
          step={step}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        {suffix && (
          <span className="ml-2 text-sm text-gray-500 whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

interface ToggleFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  tooltip?: string;
}

function ToggleField({
  label,
  value,
  onChange,
  disabled = false,
  tooltip,
}: ToggleFieldProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
          value ? "bg-indigo-600" : "bg-gray-300"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function TierGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{children}</div>
  );
}

function TierCard({
  tier,
  children,
}: {
  tier: string;
  children: React.ReactNode;
}) {
  const tierColors: Record<string, string> = {
    "Tier 1": "border-gray-300 bg-gray-50",
    "Tier 2": "border-blue-300 bg-blue-50",
    "Tier 3": "border-purple-300 bg-purple-50",
  };

  return (
    <div
      className={`border-2 rounded-lg p-4 space-y-3 ${tierColors[tier] || "border-gray-300"}`}
    >
      <h4 className="font-semibold text-gray-800">{tier}</h4>
      {children}
    </div>
  );
}

/** Shipped defaults for the referral cashback program (mirrors the backend). */
const REFERRAL_CASHBACK_DEFAULTS: ReferralCashbackConfig = {
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
 * Fill in fields an older backend may not send yet, so the inputs stay
 * controlled and a save never posts `undefined`/`NaN` for them. Applied to both
 * the working copy and the pristine copy so the defaults don't read as unsaved
 * changes.
 */
function withConfigDefaults(config: FullRewardsConfig): FullRewardsConfig {
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
  };
}

export default function RewardsConfigPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<FullRewardsConfig | null>(null);
  const [originalConfig, setOriginalConfig] =
    useState<FullRewardsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tierUsersModal, setTierUsersModal] = useState<number | null>(null);
  const [tierEmailModal, setTierEmailModal] = useState<number | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/v1/rewards-config");
      const normalized = withConfigDefaults(response.data);
      setConfig(normalized);
      setOriginalConfig(JSON.parse(JSON.stringify(normalized)));
    } catch (error) {
      console.error("Failed to fetch rewards config:", error);
      toast.error("Failed to fetch rewards configuration");
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = (section: keyof FullRewardsConfig): boolean => {
    if (!config || !originalConfig) return false;
    return (
      JSON.stringify(config[section]) !==
      JSON.stringify(originalConfig[section])
    );
  };

  useEffect(() => {
    if (user) {
      fetchConfig();
    }
  }, [user]);

  const updateConfig = (
    section: keyof FullRewardsConfig,
    field: string,
    value: string | number | boolean | string[],
  ) => {
    if (!config) return;

    setConfig((prev) => {
      if (!prev) return prev;

      const sectionData = prev[section];

      if (typeof sectionData === "object" && sectionData !== null) {
        const keys = field.split(".");

        if (keys.length === 1) {
          return {
            ...prev,
            [section]: {
              ...(sectionData as any),
              [field]: value,
            },
          };
        } else if (keys.length === 2) {
          const [tier, prop] = keys;
          return {
            ...prev,
            [section]: {
              ...(sectionData as any),
              [tier]: {
                ...((sectionData as any)[tier] || {}),
                [prop]: value,
              },
            },
          };
        }
      }

      return prev;
    });
  };

  const handleNumericUpdate = (
    section: keyof FullRewardsConfig,
    field: string,
    value: string,
    isPercentage: boolean = false,
  ) => {
    if (value === "") {
      updateConfig(section, field, "");
      return;
    }

    const num = isPercentage ? parseFloat(value) / 100 : parseFloat(value);

    if (isNaN(num)) return;

    updateConfig(section, field, num);
  };

  const updateCategoryMerchants = (index: number, rawMerchants: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const categories = prev.subscriptionDiscount.categories.map((cat, i) =>
        i === index
          ? {
              ...cat,
              merchants: rawMerchants
                .split(",")
                .map((m) => m.trim())
                .filter((m) => m.length > 0),
            }
          : cat,
      );
      return {
        ...prev,
        subscriptionDiscount: { ...prev.subscriptionDiscount, categories },
      };
    });
  };

  const saveSection = async (
    section: string,
    endpoint: string,
    data: Record<string, unknown>,
    configKey: keyof FullRewardsConfig,
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
      // Update originalConfig to match current config for this section
      setOriginalConfig((prev) => {
        if (!prev || !config) return prev;
        return {
          ...prev,
          [configKey]: JSON.parse(JSON.stringify(config[configKey])),
        };
      });
    } catch (error) {
      console.error(`Failed to save ${section} config:`, error);
      toast.error(`Failed to save ${section} configuration`);
    } finally {
      setSaving(false);
    }
  };

  const saveTierThresholds = async () => {
    if (!config) return;

    await saveSection(
      "Tier Thresholds",
      "tiers",
      {
        tier1MinPoints: Number(config.tiers.tier1.min),
        tier1MaxPoints: Number(config.tiers.tier1.max),
        tier2MinPoints: Number(config.tiers.tier2.min),
        tier2MaxPoints: Number(config.tiers.tier2.max),
        tier3MinPoints: Number(config.tiers.tier3.min),
      },
      "tiers",
    );
  };

  const saveCashbackConfig = async () => {
    if (!config) return;

    await saveSection(
      "Cashback",
      "cashback",
      {
        enabled: config.cashback.enabled,
        settlementDays: Number(config.cashback.settlementDays),
        tier1Percentage: Number(config.cashback.tier1.percentage),
        tier1MonthlyCap: Number(config.cashback.tier1.monthlyCap),
        tier2Percentage: Number(config.cashback.tier2.percentage),
        tier2MonthlyCap: Number(config.cashback.tier2.monthlyCap),
        tier3Percentage: Number(config.cashback.tier3.percentage),
        tier3MonthlyCap: Number(config.cashback.tier3.monthlyCap),
      },
      "cashback",
    );
  };

  const saveSubscriptionDiscountConfig = async () => {
    if (!config) return;

    await saveSection(
      "Subscription Discount",
      "subscription-discount",
      {
        enabled: config.subscriptionDiscount.enabled,
        categories: config.subscriptionDiscount.categories,
        eligibleAmountCap: Number(
          config.subscriptionDiscount.eligibleAmountCap,
        ),
        tier1Percentage: Number(config.subscriptionDiscount.tier1.percentage),
        tier1CategoryLimit: Number(
          config.subscriptionDiscount.tier1.categoryLimit,
        ),
        tier2Percentage: Number(config.subscriptionDiscount.tier2.percentage),
        tier2CategoryLimit: Number(
          config.subscriptionDiscount.tier2.categoryLimit,
        ),
        tier3Percentage: Number(config.subscriptionDiscount.tier3.percentage),
        tier3CategoryLimit: Number(
          config.subscriptionDiscount.tier3.categoryLimit,
        ),
      },
      "subscriptionDiscount",
    );
  };

  const saveFuseStakingConfig = async () => {
    if (!config) return;

    await saveSection(
      "FUSE Staking",
      "fuse-staking",
      {
        tier2Amount: Number(config.fuseStaking.tier2Amount),
        tier3Amount: Number(config.fuseStaking.tier3Amount),
      },
      "fuseStaking",
    );
  };

  const saveReferralConfig = async () => {
    if (!config) return;

    await saveSection(
      "Referral",
      "referral",
      {
        recurringEnabled: config.referral.recurringEnabled,
        boostEnabled: config.referral.boostEnabled,
        recurringPercentage: Number(config.referral.recurringPercentage),
        boostPercentage: Number(config.referral.boostPercentage),
      },
      "referral",
    );
  };

  const saveReferralCashbackConfig = async () => {
    if (!config) return;

    await saveSection(
      "Referral Cashback",
      "referral-cashback",
      {
        enabled: config.referralCashback.enabled,
        referrerRewardUsd: Number(config.referralCashback.referrerRewardUsd),
        newUserRewardUsd: Number(config.referralCashback.newUserRewardUsd),
        spendTargetUsd: Number(config.referralCashback.spendTargetUsd),
        merchantTarget: Number(config.referralCashback.merchantTarget),
        qualifyWindowDays: Number(config.referralCashback.qualifyWindowDays),
        payoutDelayDays: Number(config.referralCashback.payoutDelayDays),
        reversalWindowDays: Number(config.referralCashback.reversalWindowDays),
        autoReviewMonthlyThreshold: Number(
          config.referralCashback.autoReviewMonthlyThreshold,
        ),
      },
      "referralCashback",
    );
  };

  const savePointsConfig = async () => {
    if (!config) return;

    await saveSection(
      "Points",
      "points",
      {
        cardSpendEnabled: config.points.cardSpendEnabled,
        swapEnabled: config.points.swapEnabled,
        holdingFundsEnabled: config.points.holdingFundsEnabled,
        cardBalanceEnabled: config.points.cardBalanceEnabled,
        cardSpendPointsPerDollar: Number(
          config.points.cardSpendPointsPerDollar,
        ),
        swapPointsPerDollar: Number(config.points.swapPointsPerDollar),
        holdingFundsMultiplier: Number(config.points.holdingFundsMultiplier),
        cardBalancePointsPerDollarPerHour: Number(
          config.points.cardBalancePointsPerDollarPerHour,
        ),
      },
      "points",
    );
  };

  const saveCardWelcomeBonusConfig = async () => {
    if (!config) return;

    await saveSection(
      "Card Welcome Bonus",
      "card-welcome-bonus",
      {
        enabled: config.cardWelcomeBonus.enabled,
        percentage: Number(config.cardWelcomeBonus.percentage),
        cap: Number(config.cardWelcomeBonus.cap),
      },
      "cardWelcomeBonus",
    );
  };

  const clearCache = async () => {
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
      toast.error("Failed to clear cache");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load configuration</p>
        <button
          onClick={fetchConfig}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Rewards Configuration
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure loyalty program parameters. Changes take effect after
            saving and may take up to 5 minutes to propagate.
          </p>
        </div>
        <div className="flex space-x-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={clearCache}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear Cache
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>
                Force the system to reload configuration values immediately
                instead of waiting for the automatic 5-minute refresh cycle.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="space-y-4">
        {/* Tier Thresholds */}
        <ConfigSection
          title="Tier Thresholds"
          description="Define points required to reach each loyalty tier"
          icon={<Settings className="h-5 w-5 text-indigo-600" />}
          defaultOpen
        >
          <TierGrid>
            <TierCard tier="Tier 1">
              <InputField
                label="Min Points"
                value={config.tiers.tier1.min}
                onChange={(v) => handleNumericUpdate("tiers", "tier1.min", v)}
                type="number"
                tooltip="Minimum points to enter this tier (usually 0 for Tier 1)"
              />
              <InputField
                label="Max Points"
                value={config.tiers.tier1.max}
                onChange={(v) => handleNumericUpdate("tiers", "tier1.max", v)}
                type="number"
                tooltip="Maximum points before user advances to next tier"
              />
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => setTierUsersModal(1)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Users
                </button>
                <button
                  onClick={() => setTierEmailModal(1)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Send Email
                </button>
              </div>
            </TierCard>
            <TierCard tier="Tier 2">
              <InputField
                label="Min Points"
                value={config.tiers.tier2.min}
                onChange={(v) => handleNumericUpdate("tiers", "tier2.min", v)}
                type="number"
                tooltip="Points required to unlock Tier 2 benefits"
              />
              <InputField
                label="Max Points"
                value={config.tiers.tier2.max}
                onChange={(v) => handleNumericUpdate("tiers", "tier2.max", v)}
                type="number"
                tooltip="Maximum points before user advances to Tier 3"
              />
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => setTierUsersModal(2)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Users
                </button>
                <button
                  onClick={() => setTierEmailModal(2)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Send Email
                </button>
              </div>
            </TierCard>
            <TierCard tier="Tier 3">
              <InputField
                label="Min Points"
                value={config.tiers.tier3.min}
                onChange={(v) => handleNumericUpdate("tiers", "tier3.min", v)}
                type="number"
                tooltip="Points required to unlock the highest tier benefits"
              />
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => setTierUsersModal(3)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Users
                </button>
                <button
                  onClick={() => setTierEmailModal(3)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Send Email
                </button>
              </div>
            </TierCard>
          </TierGrid>
          <button
            onClick={saveTierThresholds}
            disabled={saving || !hasChanges("tiers")}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Tier Thresholds
          </button>
        </ConfigSection>

        {/* Points Earning */}
        <ConfigSection
          title="Points Earning"
          description="Configure how users earn loyalty points through various activities"
          icon={<Coins className="h-5 w-5 text-yellow-600" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              className={`p-4 rounded-lg border-2 transition-all ${config.points.cardSpendEnabled ? "border-indigo-100 bg-white shadow-sm" : "border-gray-200 bg-gray-50 opacity-75"}`}
            >
              <ToggleField
                label="Card Spend Rewards Enabled"
                value={config.points.cardSpendEnabled}
                onChange={(v) => updateConfig("points", "cardSpendEnabled", v)}
                tooltip="Enable or disable earning points for card spend transactions"
              />
              <div className="mt-3">
                <InputField
                  label="Card Spend Points (per $1)"
                  value={config.points.cardSpendPointsPerDollar}
                  onChange={(v) =>
                    handleNumericUpdate("points", "cardSpendPointsPerDollar", v)
                  }
                  type="number"
                  step="0.01"
                  disabled={!config.points.cardSpendEnabled}
                  tooltip="Points earned for each dollar spent using the card"
                />
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 transition-all ${config.points.swapEnabled ? "border-indigo-100 bg-white shadow-sm" : "border-gray-200 bg-gray-50 opacity-75"}`}
            >
              <ToggleField
                label="Swap Rewards Enabled"
                value={config.points.swapEnabled}
                onChange={(v) => updateConfig("points", "swapEnabled", v)}
                tooltip="Enable or disable earning points for token swaps"
              />
              <div className="mt-3">
                <InputField
                  label="Swap Points (per $1)"
                  value={config.points.swapPointsPerDollar}
                  onChange={(v) =>
                    handleNumericUpdate("points", "swapPointsPerDollar", v)
                  }
                  type="number"
                  step="0.01"
                  disabled={!config.points.swapEnabled}
                  tooltip="Points earned for each dollar swapped"
                />
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 transition-all ${config.points.holdingFundsEnabled ? "border-indigo-100 bg-white shadow-sm" : "border-gray-200 bg-gray-50 opacity-75"}`}
            >
              <ToggleField
                label="Holding Funds Rewards Enabled"
                value={config.points.holdingFundsEnabled}
                onChange={(v) =>
                  updateConfig("points", "holdingFundsEnabled", v)
                }
                tooltip="Enable or disable earning points for holding funds"
              />
              <div className="mt-3">
                <InputField
                  label="Holding Funds Multiplier (per $1 per 1h)"
                  value={config.points.holdingFundsMultiplier}
                  onChange={(v) =>
                    handleNumericUpdate("points", "holdingFundsMultiplier", v)
                  }
                  type="number"
                  suffix="x"
                  step="0.1"
                  disabled={!config.points.holdingFundsEnabled}
                  tooltip="Multiplier applied to points earned per dollar for each hour funds are held"
                />
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 transition-all ${config.points.cardBalanceEnabled ? "border-indigo-100 bg-white shadow-sm" : "border-gray-200 bg-gray-50 opacity-75"}`}
            >
              <ToggleField
                label="Card Balance Rewards Enabled"
                value={config.points.cardBalanceEnabled}
                onChange={(v) =>
                  updateConfig("points", "cardBalanceEnabled", v)
                }
                tooltip="Enable or disable earning points for the balance held on the card"
              />
              <div className="mt-3">
                <InputField
                  label="Card Balance Points (per $1 per 1h)"
                  value={config.points.cardBalancePointsPerDollarPerHour}
                  onChange={(v) =>
                    handleNumericUpdate(
                      "points",
                      "cardBalancePointsPerDollarPerHour",
                      v,
                    )
                  }
                  type="number"
                  step="0.1"
                  disabled={!config.points.cardBalanceEnabled}
                  tooltip="Points earned per dollar of card balance for each hour it is held — the same unit as the Holding Funds multiplier"
                />
              </div>
            </div>
          </div>
          <button
            onClick={savePointsConfig}
            disabled={saving || !hasChanges("points")}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Points Config
          </button>
        </ConfigSection>

        {/* Referral System */}
        <ConfigSection
          title="Referral System"
          description="Rewards for users who refer new members to the platform"
          icon={<Users className="h-5 w-5 text-teal-600" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className={`p-4 rounded-lg border-2 transition-all ${config.referral.recurringEnabled ? "border-indigo-100 bg-white shadow-sm" : "border-gray-200 bg-gray-50 opacity-75"}`}
            >
              <ToggleField
                label="Recurring Rewards Enabled"
                value={config.referral.recurringEnabled}
                onChange={(v) =>
                  updateConfig("referral", "recurringEnabled", v)
                }
                tooltip="Enable or disable ongoing referral rewards based on referred user's activity"
              />
              <div className="mt-3">
                <InputField
                  label="Recurring %"
                  value={
                    (config.referral.recurringPercentage as any) === ""
                      ? ""
                      : config.referral.recurringPercentage * 100
                  }
                  onChange={(v) =>
                    handleNumericUpdate(
                      "referral",
                      "recurringPercentage",
                      v,
                      true,
                    )
                  }
                  type="number"
                  suffix="%"
                  step="0.1"
                  disabled={!config.referral.recurringEnabled}
                  tooltip="Percentage of referred user's ongoing rewards earned by referrer"
                />
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 transition-all ${config.referral.boostEnabled ? "border-indigo-100 bg-white shadow-sm" : "border-gray-200 bg-gray-50 opacity-75"}`}
            >
              <ToggleField
                label="Boost Rewards Enabled"
                value={config.referral.boostEnabled}
                onChange={(v) => updateConfig("referral", "boostEnabled", v)}
                tooltip="Enable or disable reward boost for referred users"
              />
              <div className="mt-3">
                <InputField
                  label="Boost %"
                  value={
                    (config.referral.boostPercentage as any) === ""
                      ? ""
                      : config.referral.boostPercentage * 100
                  }
                  onChange={(v) =>
                    handleNumericUpdate("referral", "boostPercentage", v, true)
                  }
                  type="number"
                  suffix="%"
                  step="0.1"
                  disabled={!config.referral.boostEnabled}
                  tooltip="Bonus percentage awarded to the referred user"
                />
              </div>
            </div>
          </div>
          <button
            onClick={saveReferralConfig}
            disabled={saving || !hasChanges("referral")}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Referral Config
          </button>
        </ConfigSection>

        {/* Referral Cashback Program */}
        <ConfigSection
          title="Referral Cashback Program"
          description="Two-sided USD cashback, paid in soUSD once a referred friend gets a card and proves everyday use. Separate from the points-based referral rewards above."
          icon={<Gift className="h-5 w-5 text-pink-600" />}
        >
          <div className="flex items-center justify-between">
            <ToggleField
              label="Referral Cashback Enabled"
              value={config.referralCashback.enabled}
              onChange={(v) => updateConfig("referralCashback", "enabled", v)}
              tooltip="Master switch for referral payouts. When off, referrals still qualify and queue up — they are paid once it is switched back on, nothing is lost."
            />
            <div className="text-right">
              <div className="text-sm font-medium text-gray-700">
                All-in cost per activated user
                <InfoTooltip text="Both legs of the reward added together — the number to compare against your cost of customer acquisition (COCA)." />
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                $
                {(Number(config.referralCashback.referrerRewardUsd) || 0) +
                  (Number(config.referralCashback.newUserRewardUsd) || 0)}
              </div>
            </div>
          </div>

          <div className="rounded-lg border-2 border-indigo-100 bg-white p-4 shadow-sm">
            <h4 className="mb-3 font-semibold text-gray-800">Rewards</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InputField
                label="Referrer Reward"
                value={config.referralCashback.referrerRewardUsd}
                onChange={(v) =>
                  handleNumericUpdate(
                    "referralCashback",
                    "referrerRewardUsd",
                    v,
                  )
                }
                type="number"
                suffix="$"
                min={0}
                step="1"
                disabled={!config.referralCashback.enabled}
                tooltip="Paid to the referrer for each friend who qualifies (you get)."
              />
              <InputField
                label="Friend Reward"
                value={config.referralCashback.newUserRewardUsd}
                onChange={(v) =>
                  handleNumericUpdate("referralCashback", "newUserRewardUsd", v)
                }
                type="number"
                suffix="$"
                min={0}
                step="1"
                disabled={!config.referralCashback.enabled}
                tooltip="Welcome cashback paid to the referred friend when they qualify (your friend gets)."
              />
            </div>
          </div>

          <div className="rounded-lg border-2 border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="mb-3 font-semibold text-gray-800">
              Qualification bar
              <InfoTooltip text="What a referred friend must do before either side is paid. The multi-merchant gate proves everyday use and blocks single-payment fraud." />
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InputField
                label="Spend Target"
                value={config.referralCashback.spendTargetUsd}
                onChange={(v) =>
                  handleNumericUpdate("referralCashback", "spendTargetUsd", v)
                }
                type="number"
                suffix="$"
                min={0}
                step="5"
                tooltip="Card spend the friend must reach inside the qualify window."
              />
              <InputField
                label="Distinct Merchants"
                value={config.referralCashback.merchantTarget}
                onChange={(v) =>
                  handleNumericUpdate("referralCashback", "merchantTarget", v)
                }
                type="number"
                min={1}
                step="1"
                tooltip="How many different merchants that spend has to be spread across."
              />
              <InputField
                label="Qualify Window"
                value={config.referralCashback.qualifyWindowDays}
                onChange={(v) =>
                  handleNumericUpdate(
                    "referralCashback",
                    "qualifyWindowDays",
                    v,
                  )
                }
                type="number"
                suffix="days"
                min={1}
                step="1"
                tooltip="Days from signup the friend has to clear the bar before the referral expires."
              />
            </div>
          </div>

          <div className="rounded-lg border-2 border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="mb-3 font-semibold text-gray-800">
              Payout &amp; risk
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InputField
                label="Payout Delay"
                value={config.referralCashback.payoutDelayDays}
                onChange={(v) =>
                  handleNumericUpdate("referralCashback", "payoutDelayDays", v)
                }
                type="number"
                suffix="days"
                min={0}
                step="1"
                tooltip="Days between qualifying and the money going out — covers disputes and chargebacks. The app counts down to this."
              />
              <InputField
                label="Reversal Window"
                value={config.referralCashback.reversalWindowDays}
                onChange={(v) =>
                  handleNumericUpdate(
                    "referralCashback",
                    "reversalWindowDays",
                    v,
                  )
                }
                type="number"
                suffix="days"
                min={0}
                step="1"
                tooltip="Window after qualifying in which a churn or chargeback claws the referrer bonus back."
              />
              <InputField
                label="Auto-review Threshold"
                value={config.referralCashback.autoReviewMonthlyThreshold}
                onChange={(v) =>
                  handleNumericUpdate(
                    "referralCashback",
                    "autoReviewMonthlyThreshold",
                    v,
                  )
                }
                type="number"
                suffix="/ 30 days"
                min={1}
                step="1"
                tooltip="Referrers above this many qualified referrals in a rolling 30 days are held for manual anti-abuse review instead of being auto-paid."
              />
            </div>
          </div>
          <button
            onClick={saveReferralCashbackConfig}
            disabled={saving || !hasChanges("referralCashback")}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Referral Cashback Config
          </button>
        </ConfigSection>

        {/* Cashback */}
        <ConfigSection
          title="Cashback on Card Transactions"
          description="Users earn FUSE tokens back on card purchases based on their tier"
          icon={<Percent className="h-5 w-5 text-green-600" />}
        >
          <div className="flex items-center justify-between mb-4">
            <ToggleField
              label="Cashback Enabled"
              value={config.cashback.enabled}
              onChange={(v) => updateConfig("cashback", "enabled", v)}
              tooltip="Enable or disable cashback rewards for all users"
            />
            <InputField
              label="Settlement Period"
              value={config.cashback.settlementDays}
              onChange={(v) =>
                handleNumericUpdate("cashback", "settlementDays", v)
              }
              type="number"
              suffix="days"
              tooltip="Number of days after a transaction before cashback is credited to user"
            />
          </div>
          <TierGrid>
            <TierCard tier="Tier 1">
              <InputField
                label="Cashback %"
                value={
                  (config.cashback.tier1.percentage as any) === ""
                    ? ""
                    : config.cashback.tier1.percentage * 100
                }
                onChange={(v) =>
                  handleNumericUpdate("cashback", "tier1.percentage", v, true)
                }
                type="number"
                suffix="%"
                step="0.1"
                tooltip="Percentage of card transaction returned as FUSE tokens"
              />
              <InputField
                label="Monthly Cap"
                value={config.cashback.tier1.monthlyCap}
                onChange={(v) =>
                  handleNumericUpdate("cashback", "tier1.monthlyCap", v)
                }
                type="number"
                suffix="$"
                tooltip="Maximum cashback amount user can earn per month"
              />
            </TierCard>
            <TierCard tier="Tier 2">
              <InputField
                label="Cashback %"
                value={
                  (config.cashback.tier2.percentage as any) === ""
                    ? ""
                    : config.cashback.tier2.percentage * 100
                }
                onChange={(v) =>
                  handleNumericUpdate("cashback", "tier2.percentage", v, true)
                }
                type="number"
                suffix="%"
                step="0.1"
                tooltip="Percentage of card transaction returned as FUSE tokens"
              />
              <InputField
                label="Monthly Cap"
                value={config.cashback.tier2.monthlyCap}
                onChange={(v) =>
                  handleNumericUpdate("cashback", "tier2.monthlyCap", v)
                }
                type="number"
                suffix="$"
                tooltip="Maximum cashback amount user can earn per month"
              />
            </TierCard>
            <TierCard tier="Tier 3">
              <InputField
                label="Cashback %"
                value={
                  (config.cashback.tier3.percentage as any) === ""
                    ? ""
                    : config.cashback.tier3.percentage * 100
                }
                onChange={(v) =>
                  handleNumericUpdate("cashback", "tier3.percentage", v, true)
                }
                type="number"
                suffix="%"
                step="0.1"
                tooltip="Percentage of card transaction returned as FUSE tokens"
              />
              <InputField
                label="Monthly Cap"
                value={config.cashback.tier3.monthlyCap}
                onChange={(v) =>
                  handleNumericUpdate("cashback", "tier3.monthlyCap", v)
                }
                type="number"
                suffix="$"
                tooltip="Maximum cashback amount user can earn per month"
              />
            </TierCard>
          </TierGrid>
          <button
            onClick={saveCashbackConfig}
            disabled={saving || !hasChanges("cashback")}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Cashback Config
          </button>
        </ConfigSection>

        {/* Card Welcome Bonus */}
        <ConfigSection
          title="Card Welcome Bonus"
          description="Bonus for users who make their first deposit via card (borrow deposits)"
          icon={<CreditCard className="h-5 w-5 text-blue-600" />}
        >
          <div className="space-y-4">
            <ToggleField
              label="Card Welcome Bonus Enabled"
              value={config.cardWelcomeBonus.enabled}
              onChange={(v) => updateConfig("cardWelcomeBonus", "enabled", v)}
              tooltip="Enable or disable welcome bonus for card deposits"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Bonus Percentage"
                value={
                  (config.cardWelcomeBonus.percentage as any) === ""
                    ? ""
                    : config.cardWelcomeBonus.percentage * 100
                }
                onChange={(v) =>
                  handleNumericUpdate("cardWelcomeBonus", "percentage", v, true)
                }
                type="number"
                suffix="%"
                step="0.1"
                disabled={!config.cardWelcomeBonus.enabled}
                tooltip="Percentage bonus applied to card deposits"
              />
              <InputField
                label="Lifetime Cap"
                value={config.cardWelcomeBonus.cap}
                onChange={(v) =>
                  handleNumericUpdate("cardWelcomeBonus", "cap", v)
                }
                type="number"
                suffix="$"
                disabled={!config.cardWelcomeBonus.enabled}
                tooltip="Maximum total bonus a user can earn from card welcome bonus (lifetime)"
              />
            </div>
          </div>
          <button
            onClick={saveCardWelcomeBonusConfig}
            disabled={saving || !hasChanges("cardWelcomeBonus")}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Card Welcome Bonus Config
          </button>
        </ConfigSection>

        {/* Subscription Discount */}
        <ConfigSection
          title="Category-based Subscription Discounts"
          description="Up to 50% back on monthly subscriptions (Netflix, Spotify, ChatGPT…). Prime unlocks 2 categories/month, Ultra unlocks 4. One subscription per category per month (first-paid-wins); paid as FUSE and drawn from the same monthly cashback cap."
          icon={<Calendar className="h-5 w-5 text-purple-600" />}
        >
          <ToggleField
            label="Subscription Discount Enabled"
            value={config.subscriptionDiscount.enabled}
            onChange={(v) => updateConfig("subscriptionDiscount", "enabled", v)}
            tooltip="Enable or disable subscription discounts for all users"
          />
          <div className="mt-4 max-w-xs">
            <InputField
              label="Eligible Amount Cap"
              value={config.subscriptionDiscount.eligibleAmountCap}
              onChange={(v) =>
                handleNumericUpdate(
                  "subscriptionDiscount",
                  "eligibleAmountCap",
                  v,
                )
              }
              type="number"
              suffix="$"
              tooltip="Only the first N dollars of each eligible subscription charge earn the discount (e.g. $50)."
            />
          </div>
          <div className="mt-4 space-y-3">
            <label className="text-sm font-medium text-gray-700 block">
              Categories &amp; Eligible Merchants
              <InfoTooltip text="Each category's merchants (comma-separated). A card transaction is matched to a category when its merchant name contains one of these aliases (case/punctuation-insensitive)." />
            </label>
            {config.subscriptionDiscount.categories?.map((cat, index) => (
              <div
                key={cat.key}
                className="border border-gray-200 rounded-md p-3 bg-gray-50"
              >
                <div className="text-sm font-semibold text-gray-800 mb-1">
                  {cat.label}
                </div>
                <textarea
                  value={cat.merchants.join(", ")}
                  onChange={(e) =>
                    updateCategoryMerchants(index, e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>
            ))}
          </div>
          <TierGrid>
            <TierCard tier="Tier 1">
              <InputField
                label="Discount %"
                value={
                  (config.subscriptionDiscount.tier1.percentage as any) === ""
                    ? ""
                    : config.subscriptionDiscount.tier1.percentage * 100
                }
                onChange={(v) =>
                  handleNumericUpdate(
                    "subscriptionDiscount",
                    "tier1.percentage",
                    v,
                    true,
                  )
                }
                type="number"
                suffix="%"
                step="1"
                tooltip="Percentage discount on eligible subscriptions"
              />
              <InputField
                label="Categories / month"
                value={config.subscriptionDiscount.tier1.categoryLimit}
                onChange={(v) =>
                  handleNumericUpdate(
                    "subscriptionDiscount",
                    "tier1.categoryLimit",
                    v,
                  )
                }
                type="number"
                tooltip="Number of subscription categories this tier can earn a discount on per month (Core 0, Prime 2, Ultra 4)"
              />
            </TierCard>
            <TierCard tier="Tier 2">
              <InputField
                label="Discount %"
                value={
                  (config.subscriptionDiscount.tier2.percentage as any) === ""
                    ? ""
                    : config.subscriptionDiscount.tier2.percentage * 100
                }
                onChange={(v) =>
                  handleNumericUpdate(
                    "subscriptionDiscount",
                    "tier2.percentage",
                    v,
                    true,
                  )
                }
                type="number"
                suffix="%"
                step="1"
              />
              <InputField
                label="Categories / month"
                value={config.subscriptionDiscount.tier2.categoryLimit}
                onChange={(v) =>
                  handleNumericUpdate(
                    "subscriptionDiscount",
                    "tier2.categoryLimit",
                    v,
                  )
                }
                type="number"
                tooltip="Number of subscription categories this tier can earn a discount on per month (Prime: 2)"
              />
            </TierCard>
            <TierCard tier="Tier 3">
              <InputField
                label="Discount %"
                value={
                  (config.subscriptionDiscount.tier3.percentage as any) === ""
                    ? ""
                    : config.subscriptionDiscount.tier3.percentage * 100
                }
                onChange={(v) =>
                  handleNumericUpdate(
                    "subscriptionDiscount",
                    "tier3.percentage",
                    v,
                    true,
                  )
                }
                type="number"
                suffix="%"
                step="1"
              />
              <InputField
                label="Categories / month"
                value={config.subscriptionDiscount.tier3.categoryLimit}
                onChange={(v) =>
                  handleNumericUpdate(
                    "subscriptionDiscount",
                    "tier3.categoryLimit",
                    v,
                  )
                }
                type="number"
                tooltip="Number of subscription categories this tier can earn a discount on per month (Ultra: 4)"
              />
            </TierCard>
          </TierGrid>
          <button
            onClick={saveSubscriptionDiscountConfig}
            disabled={saving || !hasChanges("subscriptionDiscount")}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Subscription Discount Config
          </button>
        </ConfigSection>

        {/* FUSE Staking */}
        <ConfigSection
          title="FUSE Staking for Tier Unlock"
          description="Alternative path to unlock higher tiers by staking FUSE tokens"
          icon={<Wallet className="h-5 w-5 text-orange-600" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Tier 2 FUSE Amount"
              value={config.fuseStaking.tier2Amount}
              onChange={(v) =>
                handleNumericUpdate("fuseStaking", "tier2Amount", v)
              }
              type="number"
              suffix="FUSE"
              tooltip="Amount of FUSE tokens user must stake to unlock Tier 2"
            />
            <InputField
              label="Tier 3 FUSE Amount"
              value={config.fuseStaking.tier3Amount}
              onChange={(v) =>
                handleNumericUpdate("fuseStaking", "tier3Amount", v)
              }
              type="number"
              suffix="FUSE"
              tooltip="Amount of FUSE tokens user must stake to unlock Tier 3"
            />
          </div>
          <button
            onClick={saveFuseStakingConfig}
            disabled={saving || !hasChanges("fuseStaking")}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save FUSE Staking Config
          </button>
        </ConfigSection>
      </div>

      <TierUsersModal
        isOpen={tierUsersModal !== null}
        onClose={() => setTierUsersModal(null)}
        tier={tierUsersModal ?? 1}
      />
      <TierEmailModal
        isOpen={tierEmailModal !== null}
        onClose={() => setTierEmailModal(null)}
        tier={tierEmailModal ?? 1}
      />
    </div>
  );
}
