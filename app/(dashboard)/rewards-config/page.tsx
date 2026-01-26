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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { FullRewardsConfig } from "@/types";
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

export default function RewardsConfigPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<FullRewardsConfig | null>(null);
  const [originalConfig, setOriginalConfig] =
    useState<FullRewardsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/v1/rewards-config");
      setConfig(response.data);
      setOriginalConfig(JSON.parse(JSON.stringify(response.data)));
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
        eligibleServices: config.subscriptionDiscount.eligibleServices,
        tier1Percentage: Number(config.subscriptionDiscount.tier1.percentage),
        tier1ServiceLimit: Number(
          config.subscriptionDiscount.tier1.serviceLimit,
        ),
        tier2Percentage: Number(config.subscriptionDiscount.tier2.percentage),
        tier2ServiceLimit: Number(
          config.subscriptionDiscount.tier2.serviceLimit,
        ),
        tier3Percentage: Number(config.subscriptionDiscount.tier3.percentage),
        tier3ServiceLimit: Number(
          config.subscriptionDiscount.tier3.serviceLimit,
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

  const savePointsConfig = async () => {
    if (!config) return;

    await saveSection(
      "Points",
      "points",
      {
        cardSpendEnabled: config.points.cardSpendEnabled,
        swapEnabled: config.points.swapEnabled,
        holdingFundsEnabled: config.points.holdingFundsEnabled,
        cardSpendPointsPerDollar: Number(
          config.points.cardSpendPointsPerDollar,
        ),
        swapPointsPerDollar: Number(config.points.swapPointsPerDollar),
        holdingFundsMultiplier: Number(config.points.holdingFundsMultiplier),
      },
      "points",
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
            </TierCard>
            <TierCard tier="Tier 3">
              <InputField
                label="Min Points"
                value={config.tiers.tier3.min}
                onChange={(v) => handleNumericUpdate("tiers", "tier3.min", v)}
                type="number"
                tooltip="Points required to unlock the highest tier benefits"
              />
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

        {/* Subscription Discount */}
        <ConfigSection
          title="Subscription Discount (Not finalized)"
          description="Discounts on eligible subscription services based on tier (future feature)"
          icon={<Calendar className="h-5 w-5 text-purple-600" />}
        >
          <ToggleField
            label="Subscription Discount Enabled"
            value={config.subscriptionDiscount.enabled}
            onChange={(v) => updateConfig("subscriptionDiscount", "enabled", v)}
            tooltip="Enable or disable subscription discounts for all users"
          />
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Eligible Services (comma-separated)
              <InfoTooltip text="List of subscription services that qualify for discounts (e.g., Netflix, Spotify)" />
            </label>
            <textarea
              value={config.subscriptionDiscount.eligibleServices.join(", ")}
              onChange={(e) =>
                updateConfig(
                  "subscriptionDiscount",
                  "eligibleServices",
                  e.target.value.split(",").map((s) => s.trim()),
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
            />
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
                label="Service Limit"
                value={config.subscriptionDiscount.tier1.serviceLimit}
                onChange={(v) =>
                  handleNumericUpdate(
                    "subscriptionDiscount",
                    "tier1.serviceLimit",
                    v,
                  )
                }
                type="number"
                tooltip="Maximum number of services that can receive discount"
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
                label="Service Limit"
                value={config.subscriptionDiscount.tier2.serviceLimit}
                onChange={(v) =>
                  handleNumericUpdate(
                    "subscriptionDiscount",
                    "tier2.serviceLimit",
                    v,
                  )
                }
                type="number"
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
                label="Service Limit"
                value={config.subscriptionDiscount.tier3.serviceLimit}
                onChange={(v) =>
                  handleNumericUpdate(
                    "subscriptionDiscount",
                    "tier3.serviceLimit",
                    v,
                  )
                }
                type="number"
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
    </div>
  );
}
