"use client";

import { useState } from "react";
import {
  Calendar,
  Coins,
  CreditCard,
  Eye,
  Gift,
  KeyRound,
  Mail,
  Percent,
  Play,
  RefreshCw,
  Save,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  ConfigSection,
  InfoTooltip,
  InputField,
  TierCard,
  TierGrid,
  ToggleField,
} from "@/components/config/config-fields";
import TierEmailModal from "@/components/tier-email-modal";
import TierUsersModal from "@/components/tier-users-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConfigEditor } from "@/hooks/use-config-editor";
import api from "@/lib/api";
import {
  SubscriptionCategoryRatesMigrationResult,
  SubscriptionDiscountCategory,
  YieldBoostRunResult,
} from "@/types";

/**
 * An ISO timestamp as the day it names, or a dash.
 *
 * The two grandfather dates are the only values on this page the backend
 * computes rather than stores, and they are read to the day — the window is
 * measured in days and the time of day is noise.
 */
function asDay(iso?: string): string {
  if (!iso) return "—";
  const at = new Date(iso);

  return Number.isNaN(at.getTime()) ? "—" : at.toISOString().slice(0, 10);
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * A stored fraction as the percent its box shows, or blank mid-edit. Rounded,
 * because 0.07 * 100 is 7.000000000000001 in floating point.
 */
function fractionAsPercent(value: number): number | string {
  return (value as unknown) === "" ? "" : Math.round(value * 1e6) / 1e4;
}

const YIELD_BOOST_TIERS = [
  { key: "tier1", label: "Tier 1" },
  { key: "tier2", label: "Tier 2" },
  { key: "tier3", label: "Tier 3" },
] as const;

/** One line on what an accrual run did, for the admin who started it. */
function describeAccrualRun(result: YieldBoostRunResult): string {
  const { dayKey, outcome, stats, error } = result;

  if (outcome === "disabled") {
    return `Accrual is switched off, so nothing was earned for ${dayKey}.`;
  }
  if (outcome === "skipped") {
    // A finished day is re-run on request, so the only reason to skip now is
    // another run holding the day.
    return `Another run is working on ${dayKey} right now. Try again in a minute.`;
  }
  if (outcome === "failed" || !stats) {
    return `${dayKey} could not run: ${error ?? "unknown error"}. The hourly pass retries it.`;
  }

  const earned =
    `${dayKey}: ${stats.accrued} users earned ${usd.format(stats.totalUsd)} ` +
    `(${stats.totalSoFuse} soFUSE); ${stats.alreadyAccrued} already had the day` +
    // Holders whose tier earns no boost — the usual reason a run pays nobody.
    (stats.notEligible > 0
      ? `; ${stats.notEligible} hold savings but their tier earns no boost.`
      : ".");

  return outcome === "partial"
    ? `${earned} ${stats.incomplete} Safes could not be read and are retried hourly.`
    : earned;
}

export default function RewardsConfigPage() {
  const {
    config,
    loading,
    saving,
    hasChanges,
    updateConfig,
    handleNumericUpdate,
    setConfig,
    saveSection,
    clearCache,
    refetch,
  } = useConfigEditor();
  const [tierUsersModal, setTierUsersModal] = useState<number | null>(null);
  const [tierEmailModal, setTierEmailModal] = useState<number | null>(null);
  const [accrualDay, setAccrualDay] = useState<"yesterday" | "today">(
    "yesterday",
  );
  const [runningAccrual, setRunningAccrual] = useState(false);
  const [migratingRates, setMigratingRates] = useState(false);
  const [migrationResult, setMigrationResult] =
    useState<SubscriptionCategoryRatesMigrationResult | null>(null);
  const [accrualResult, setAccrualResult] =
    useState<YieldBoostRunResult | null>(null);

  const updateCategory = (
    index: number,
    patch: Partial<SubscriptionDiscountCategory>,
  ) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const categories = prev.subscriptionDiscount.categories.map((cat, i) =>
        i === index ? { ...cat, ...patch } : cat,
      );
      return {
        ...prev,
        subscriptionDiscount: { ...prev.subscriptionDiscount, categories },
      };
    });
  };

  const updateCategoryMerchants = (index: number, rawMerchants: string) => {
    updateCategory(index, {
      merchants: rawMerchants
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m.length > 0),
    });
  };

  /**
   * Set (or clear) one tier's rate on one category.
   *
   * The field is in percentage points and stored as a fraction. Clearing it
   * drops the key so the category falls back to the tier's flat percentage —
   * which is NOT the same as typing 0, and the difference is load-bearing:
   * 0 locks the category for that tier (Airlines for Prime), while absent means
   * "price it like everything else".
   */
  const updateCategoryRate = (
    index: number,
    tierKey: "tier1" | "tier2" | "tier3",
    rawPercent: string,
  ) => {
    const current = config?.subscriptionDiscount.categories[index];
    if (!current) return;

    const rates = { ...(current.rates ?? {}) };
    const trimmed = rawPercent.trim();
    const parsed = Number(trimmed);

    if (trimmed === "" || !Number.isFinite(parsed) || parsed < 0) {
      delete rates[tierKey];
    } else {
      rates[tierKey] = parsed / 100;
    }

    updateCategory(index, {
      rates: Object.keys(rates).length > 0 ? rates : undefined,
    });
  };

  /**
   * Whether a category is live.
   *
   * Absent means live: categories stored before the toggle existed carry no
   * flag, and reading a missing value as "off" would silently pause every one
   * of them the first time this page loads.
   */
  const isCategoryEnabled = (category: SubscriptionDiscountCategory): boolean =>
    category.enabled !== false;

  /** Categories currently switched on, for the count above the list. */
  const liveCategoryCount = (
    config?.subscriptionDiscount.categories ?? []
  ).filter(isCategoryEnabled).length;

  /** A stored fraction as the percentage-point string the input shows. */
  const rateFieldValue = (
    category: SubscriptionDiscountCategory,
    tierKey: "tier1" | "tier2" | "tier3",
  ): string => {
    const rate = category.rates?.[tierKey];
    return typeof rate === "number" && Number.isFinite(rate)
      ? String(Number((rate * 100).toFixed(4)))
      : "";
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
        enabled: config.fuseStaking.enabled,
        tier2Amount: Number(config.fuseStaking.tier2Amount),
        tier3Amount: Number(config.fuseStaking.tier3Amount),
      },
      "fuseStaking",
    );
  };

  /**
   * Saves the whole v3 section, which spans two config groups.
   *
   * The FUSE amounts live under `fuseStaking` because a tier costs the same
   * FUSE whether it is held or locked — one pair of numbers, two features. The
   * v3 section edits them in place rather than sending the admin up the page,
   * so its save has to cover them too. Skipped when untouched, so saving the
   * annual charge does not rewrite the staking config.
   */
  const saveTierMembershipConfig = async () => {
    if (!config) return;

    if (hasChanges("fuseStaking")) await saveFuseStakingConfig();

    await saveSection(
      "Tier Membership",
      "tier-membership",
      {
        pointsUnlockEnabled: config.tierMembership.pointsUnlockEnabled,
        lockEnabled: config.tierMembership.lockEnabled,
        lockDurationDays: Number(config.tierMembership.lockDurationDays),
        lockTier2Amount: Number(config.tierMembership.lockTier2Amount),
        lockTier3Amount: Number(config.tierMembership.lockTier3Amount),
        legacyGrandfatherDays: Number(
          config.tierMembership.legacyGrandfatherDays,
        ),
        subscriptionEnabled: config.tierMembership.subscriptionEnabled,
        primeAnnualUsd: Number(config.tierMembership.primeAnnualUsd),
        ultraAnnualUsd: Number(config.tierMembership.ultraAnnualUsd),
        graceDays: Number(config.tierMembership.graceDays),
        renewalNoticeDays: Number(config.tierMembership.renewalNoticeDays),
      },
      "tierMembership",
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

  const saveYieldBoostConfig = async () => {
    if (!config) return;

    const boost = config.yieldBoost;
    const amounts = {
      tier1Apy: boost.tier1.apy,
      tier1MaxDepositUsd: boost.tier1.maxDepositUsd,
      tier2Apy: boost.tier2.apy,
      tier2MaxDepositUsd: boost.tier2.maxDepositUsd,
      tier3Apy: boost.tier3.apy,
      tier3MaxDepositUsd: boost.tier3.maxDepositUsd,
      maxClaimUsd: boost.maxClaimUsd,
      maxClaimSoFuse: boost.maxClaimSoFuse,
      maxDailyPayoutUsd: boost.maxDailyPayoutUsd,
    };

    // These size real transfers. A cleared box would go out as 0 and quietly
    // switch a tier's boost — or every claim — off, so it is refused instead.
    if (Object.values(amounts).some((value) => (value as unknown) === "")) {
      toast.error("Fill in every Yield Boost field before saving");
      return;
    }

    await saveSection(
      "Yield Boost",
      "yield-boost",
      {
        enabled: boost.enabled,
        claimsEnabled: boost.claimsEnabled,
        ...Object.fromEntries(
          Object.entries(amounts).map(([field, value]) => [
            field,
            Number(value),
          ]),
        ),
      },
      "yieldBoost",
    );
  };

  const runYieldBoostAccrual = async () => {
    try {
      setRunningAccrual(true);
      setAccrualResult(null);
      const response = await api.post<YieldBoostRunResult>(
        "/admin/v1/rewards-config/yield-boost/run-accrual",
        { day: accrualDay },
      );
      setAccrualResult(response.data);
    } catch (error) {
      console.error("Failed to run the yield boost accrual:", error);
      toast.error("Failed to run the yield boost accrual");
    } finally {
      setRunningAccrual(false);
    }
  };

  /**
   * Preview or commit the move onto per-category subscription rates.
   *
   * Rewards config is seeded from code once and owned by the database after
   * that, so deploying new rates does not move an environment that has run
   * before — this is what moves it. Both buttons hit the same endpoint and the
   * same planner, so the preview is exactly what Apply will write.
   *
   * Safe to press more than once: the backend recomputes the plan from live
   * config every call, so committing against already-migrated config writes
   * nothing and comes back `alreadyApplied`.
   */
  const runCategoryRatesMigration = async (apply: boolean) => {
    try {
      setMigratingRates(true);
      const response =
        await api.post<SubscriptionCategoryRatesMigrationResult>(
          "/admin/v1/rewards-config/subscription-discount/migrate-category-rates",
          { apply },
        );
      setMigrationResult(response.data);

      if (response.data.applied) {
        toast.success("Category rates migrated", {
          description: `${response.data.changes.length} change(s) written. The config cache has been cleared.`,
        });
        // Pull the written config back so the fields below show the new rates.
        await refetch();
      } else if (response.data.alreadyApplied) {
        toast.success("Already up to date", {
          description: "Stored config already matches the shipped rates.",
        });
      }
    } catch (error) {
      console.error("Failed to migrate category rates:", error);
      toast.error(
        apply
          ? "Failed to apply the category rates migration"
          : "Failed to preview the category rates migration",
      );
    } finally {
      setMigratingRates(false);
    }
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
          onClick={refetch}
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
          description="Two-sided USD cashback, paid in soFUSE once a referred friend gets a card and proves everyday use — so the reward lands as a savings position that earns yield and counts towards the FUSE skip-the-line unlock, and turning it into dollars is a swap the user pays a fee on. Rewards earned before the payout switch (REFERRAL_FUSE_PAYOUT_START_DATE) still settle in soUSD. Separate from the points-based referral rewards above."
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

        {/* Yield Boost */}
        <ConfigSection
          title="Yield Boost"
          description="Extra APY on each user's total savings across soUSD, soETH and soFUSE, earned daily and claimed in soFUSE from the payout wallet"
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
        >
          <div className="flex flex-wrap items-center gap-6">
            <ToggleField
              label="Accrual Enabled"
              value={config.yieldBoost.enabled}
              onChange={(v) => updateConfig("yieldBoost", "enabled", v)}
              tooltip="Off stops new boost being earned. Boost already earned stays claimable."
            />
            <ToggleField
              label="Claims Enabled"
              value={config.yieldBoost.claimsEnabled}
              onChange={(v) => updateConfig("yieldBoost", "claimsEnabled", v)}
              tooltip="Off refuses every claim, so nothing leaves the payout wallet. Accrual carries on, so nobody loses a day."
            />
          </div>
          <TierGrid>
            {YIELD_BOOST_TIERS.map(({ key, label }) => {
              const tier = config.yieldBoost[key];
              const yearly = Number(tier.apy) * Number(tier.maxDepositUsd);

              return (
                <TierCard key={key} tier={label}>
                  <InputField
                    label="Boost APY"
                    value={fractionAsPercent(tier.apy)}
                    onChange={(v) =>
                      handleNumericUpdate("yieldBoost", `${key}.apy`, v, true)
                    }
                    type="number"
                    suffix="%"
                    step="0.1"
                    tooltip="Extra APY on top of the vaults' own, paid in soFUSE. 0 means no boost for this tier."
                  />
                  <InputField
                    label="Max Boosted Savings"
                    value={tier.maxDepositUsd}
                    onChange={(v) =>
                      handleNumericUpdate(
                        "yieldBoost",
                        `${key}.maxDepositUsd`,
                        v,
                      )
                    }
                    type="number"
                    suffix="$"
                    tooltip="Savings across all three vaults together that the boost applies to. Anything above earns the base yield only."
                  />
                  <p className="text-xs text-gray-500">
                    {Number.isFinite(yearly) && yearly > 0
                      ? `At most ${usd.format(yearly)} a year per user`
                      : "No boost"}
                  </p>
                </TierCard>
              );
            })}
          </TierGrid>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-800">
              Payout Limits
              <InfoTooltip text="The brakes on the payout wallet. Whatever the accrual computes — even if a vault's price or APY jumps — no claim and no day can pay more than these allow." />
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InputField
                label="Max Per Claim"
                value={config.yieldBoost.maxClaimUsd}
                onChange={(v) =>
                  handleNumericUpdate("yieldBoost", "maxClaimUsd", v)
                }
                type="number"
                suffix="$"
                tooltip="Most one claim transaction may pay, and so one user in any rolling 24 hours. Anything above stays claimable later."
              />
              <InputField
                label="Max Per Claim (soFUSE)"
                value={config.yieldBoost.maxClaimSoFuse}
                onChange={(v) =>
                  handleNumericUpdate("yieldBoost", "maxClaimSoFuse", v)
                }
                type="number"
                suffix="soFUSE"
                tooltip="The same ceiling in tokens, so a wrong FUSE price cannot size an oversized transfer."
              />
              <InputField
                label="Daily Payout Budget"
                value={config.yieldBoost.maxDailyPayoutUsd}
                onChange={(v) =>
                  handleNumericUpdate("yieldBoost", "maxDailyPayoutUsd", v)
                }
                type="number"
                suffix="$"
                tooltip="Most the payout wallet may send across all users in one UTC day. Claims past it are refused until the next day, and the team is alerted."
              />
            </div>
          </div>
          <button
            onClick={saveYieldBoostConfig}
            disabled={saving || !hasChanges("yieldBoost")}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Yield Boost Config
          </button>
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-800">
              Run Accrual Now
              <InfoTooltip text="The accrual runs every hour and earns each finished UTC day, so this is for testing on QA, recovering a day after an outage, or applying a rate change to today. A day can be run again: users who already have it are left as they are, and anyone eligible who doesn't earns it on their balance right now." />
            </h4>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={accrualDay}
                onChange={(event) =>
                  setAccrualDay(event.target.value as "yesterday" | "today")
                }
                disabled={runningAccrual}
                className="block w-40 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="yesterday">Yesterday</option>
                <option value="today">Today</option>
              </select>
              <button
                onClick={runYieldBoostAccrual}
                disabled={runningAccrual}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="h-4 w-4 mr-2" />
                {runningAccrual ? "Running…" : "Run Accrual"}
              </button>
            </div>
            {accrualResult && (
              <p className="mt-2 text-sm text-gray-700">
                {describeAccrualRun(accrualResult)}
              </p>
            )}
          </div>
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
          description="Cashback on eligible card spend, priced per category: Prime earns 10% on AI, Streaming and Music and 8% on Rides; Ultra earns 20%, 10% on Rides and 10% on Airlines. A category with no rates of its own falls back to the tier default. Prime unlocks 2 categories/month, Ultra unlocks 4 — one subscription per category per month (first-paid-wins), paid as soUSD and drawn from the same monthly cashback cap."
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
              label="Max Cashback / Service / Month"
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
              tooltip="Most cashback one eligible service can earn in a calendar month (e.g. $50). Caps the cashback, NOT the charge: a $600 subscription at Prime's 10% earns $50, not 10% of the first $50. Rewards Terms §5 promises this figure — changing it changes what the published terms owe."
            />
          </div>
          <div className="mt-4 space-y-3">
            <label className="text-sm font-medium text-gray-700 block">
              Categories, Rates &amp; Eligible Merchants
              <InfoTooltip text="Each category's merchants (comma-separated) and what each tier earns on it. A card transaction is matched to a category when its merchant name contains one of these aliases (case/punctuation-insensitive), and the matched category's rate for the cardholder's tier is what gets paid. A blank rate falls back to the tier default below; 0 locks the category for that tier. The per-category switch is separate from both: off takes the category off the app and stops it paying anyone, where 0 only locks it for one tier and still advertises the upgrade." />
            </label>
            <p className="text-xs text-gray-600">
              {liveCategoryCount} of{" "}
              {config.subscriptionDiscount.categories?.length ?? 0} categories
              live.{" "}
              {liveCategoryCount === 0
                ? "With none on, the app hides subscription cashback entirely and every eligible charge earns regular tier cashback."
                : "A paused category is hidden in the app and pays nobody."}
            </p>
            {config.subscriptionDiscount.categories?.map((cat, index) => (
              <div
                key={cat.key}
                className={`border rounded-md p-3 ${
                  isCategoryEnabled(cat)
                    ? "border-gray-200 bg-gray-50"
                    : "border-gray-300 bg-gray-100"
                }`}
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-800">
                    {cat.label}
                    <span className="ml-2 font-mono text-xs font-normal text-gray-500">
                      {cat.key}
                    </span>
                    {!isCategoryEnabled(cat) && (
                      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Paused
                      </span>
                    )}
                  </div>
                  <ToggleField
                    label={isCategoryEnabled(cat) ? "On" : "Off"}
                    value={isCategoryEnabled(cat)}
                    onChange={(v) => updateCategory(index, { enabled: v })}
                    tooltip={`Turn ${cat.label} on or off. Off hides it from the app and pauses the payout — a matching charge earns regular tier cashback instead and does not use up one of the cardholder's category slots. Cashback already accrued on it is not touched, and this month's claims keep their slots. Save the section to apply.`}
                  />
                </div>
                <textarea
                  value={cat.merchants.join(", ")}
                  onChange={(e) =>
                    updateCategoryMerchants(index, e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {(
                    [
                      ["tier1", "Core %"],
                      ["tier2", "Prime %"],
                      ["tier3", "Ultra %"],
                    ] as const
                  ).map(([tierKey, label]) => (
                    <InputField
                      key={tierKey}
                      label={label}
                      value={rateFieldValue(cat, tierKey)}
                      onChange={(v) => updateCategoryRate(index, tierKey, v)}
                      type="number"
                      min={0}
                      step="0.5"
                      suffix="%"
                      tooltip={`What ${label.replace(" %", "")} earns on ${cat.label}. Leave BLANK to use this tier's default rate below. Enter 0 to lock the category for the tier — that is not the same thing, and it is how Airlines stays Ultra-only.`}
                    />
                  ))}
                </div>
                {!cat.rates && (
                  <p className="mt-2 text-xs text-gray-500">
                    No rates set — this category pays each tier&apos;s default
                    rate below.
                  </p>
                )}
              </div>
            ))}
          </div>
          <TierGrid>
            <TierCard tier="Tier 1">
              <InputField
                label="Default Discount %"
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
                tooltip="This tier's DEFAULT rate, used only by categories that set no rate of their own above (Gaming today). Every category that prices itself ignores it. Paid instead of this tier's regular card cashback on that charge, not on top of it."
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
                label="Default Discount %"
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
                tooltip="This tier's DEFAULT rate, used only by categories that set no rate of their own above (Gaming today). Every category that prices itself ignores it. Paid instead of this tier's regular card cashback on that charge, not on top of it."
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
                label="Default Discount %"
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
                tooltip="This tier's DEFAULT rate, used only by categories that set no rate of their own above (Gaming today). Every category that prices itself ignores it. Paid instead of this tier's regular card cashback on that charge, not on top of it."
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
          {/*
            One-time move onto per-category rates. Config is seeded from code
            once and owned by the database afterwards, so a deploy alone does
            not move an environment that has run before.
          */}
          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-gray-800">
              Migrate to per-category rates
              <InfoTooltip text="Writes the shipped category list and per-tier rates over this environment's stored config, and moves the tier default rates to 10% / 20%. Merchant aliases you added by hand are kept, categories you added that we do not ship are left alone, and category limits are not touched. A category this environment has never had is added PAUSED — switch it on above once you are happy with it. Categories that already exist keep whatever you set their switch to. Preview first — it writes nothing." />
            </div>
            <p className="mt-1 text-xs text-gray-600">
              Rewards config is seeded from code the first time it is read and
              owned by the database after that, so deploying new rates does not
              move an environment that has run before. Safe to press more than
              once: the plan is recomputed from live config each time, so
              applying twice writes nothing. Already-accrued cashback is not
              repriced. Categories it adds arrive switched off, so nothing
              starts paying until you turn it on above and save.
            </p>
            <p className="mt-2 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-900">
              <strong>Existing subscriptions are not re-priced.</strong> The
              first apply that lowers a tier rate also pins today&rsquo;s rates
              as the grandfather. A subscription a member is already being paid
              on keeps its current rate for as long as it keeps charging; only
              subscriptions started after the cutover earn the category rates.
              The cutover is pinned once and never moved, so pressing Apply
              again cannot re-price anything.
              {config.subscriptionDiscount.legacy?.cutoverAt ? (
                <>
                  {" "}
                  Pinned{" "}
                  {new Date(
                    config.subscriptionDiscount.legacy.cutoverAt,
                  ).toLocaleString()}{" "}
                  at Prime{" "}
                  {config.subscriptionDiscount.legacy.tier2 * 100}%, Ultra{" "}
                  {config.subscriptionDiscount.legacy.tier3 * 100}%.
                </>
              ) : (
                <> Nothing pinned yet.</>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => runCategoryRatesMigration(false)}
                disabled={migratingRates}
                className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="h-4 w-4 mr-2" />
                {migratingRates ? "Working…" : "Preview changes"}
              </button>
              <button
                onClick={() => runCategoryRatesMigration(true)}
                disabled={
                  migratingRates ||
                  // Nothing to apply until a preview has shown changes. This is
                  // belt-and-braces: the backend no-ops an unnecessary apply.
                  !migrationResult ||
                  migrationResult.alreadyApplied
                }
                className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {migratingRates ? "Working…" : "Apply migration"}
              </button>
              {migrationResult?.alreadyApplied && (
                <span className="text-sm font-medium text-green-700">
                  ✓ Already migrated — nothing to change
                </span>
              )}
            </div>
            {migrationResult && !migrationResult.alreadyApplied && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-800">
                  {migrationResult.applied
                    ? `Applied ${migrationResult.changes.length} change(s):`
                    : `${migrationResult.changes.length} change(s) would be made:`}
                </p>
                <ul className="mt-1 list-disc pl-5 text-sm text-gray-700">
                  {migrationResult.changes.map((change) => (
                    <li key={`${change.kind}:${change.key}`}>
                      {change.detail}
                    </li>
                  ))}
                </ul>
                {!migrationResult.applied && (
                  <p className="mt-2 text-xs text-gray-600">
                    Nothing has been written yet.
                  </p>
                )}
              </div>
            )}
          </div>
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
          description={`"Skip the line": HOLDING FUSE in the soFUSE savings vault unlocks a tier outright, bypassing the points ladder — the tier lasts only while the balance stays above the threshold. The toggle here gates that route alone. The two amounts are shared with the v3 FUSE lock below and apply to it whether this toggle is on or off, which is why they are editable in both places.`}
          icon={<Wallet className="h-5 w-5 text-orange-600" />}
        >
          <div className="mb-4">
            <ToggleField
              label="Skip the Line Enabled"
              value={config.fuseStaking.enabled}
              onChange={(v) => updateConfig("fuseStaking", "enabled", v)}
              tooltip="When off, a FUSE balance grants no tier to anyone — grandfathered users included — and the app hides the Skip the line section. Leave it on through the grandfather window: the app already hides it from everyone not on the list."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Prime FUSE Amount"
              value={config.fuseStaking.tier2Amount}
              onChange={(v) =>
                handleNumericUpdate("fuseStaking", "tier2Amount", v)
              }
              type="number"
              suffix="FUSE"
              tooltip="FUSE that must sit in the soFUSE vault to hold Prime. 0 disables this rung — it never unlocks."
            />
            <InputField
              label="Ultra FUSE Amount"
              value={config.fuseStaking.tier3Amount}
              onChange={(v) =>
                handleNumericUpdate("fuseStaking", "tier3Amount", v)
              }
              type="number"
              suffix="FUSE"
              tooltip="FUSE that must sit in the soFUSE vault to hold Ultra. 0 disables this rung — it never unlocks."
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

        {/* Tier Membership (rewards v3) */}
        <ConfigSection
          title="Tier Membership (v3)"
          description="How a tier is bought. Each route has its own switch and its own numbers; a tier costs the same whichever way it is reached."
          icon={<KeyRound className="h-5 w-5 text-emerald-600" />}
        >
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Both purchase routes need their contract deployed first.</strong>{" "}
            A route with no address configured stays hidden in the app whatever
            its switch says, so turning one on before its deployment is safe but
            does nothing.
          </div>

          {/* 1 — the v2 ladder */}
          <div className="mb-6 rounded-lg border border-gray-200 p-4">
            <h4 className="mb-1 text-sm font-semibold text-gray-900">
              Points
            </h4>
            <p className="mb-3 text-xs text-gray-500">
              The v2 route, and the rollback switch for the whole of v3.
            </p>
            <ToggleField
              label="Points Still Unlock Tiers"
              value={config.tierMembership.pointsUnlockEnabled}
              onChange={(v) =>
                updateConfig("tierMembership", "pointsUnlockEnabled", v)
              }
              tooltip="Off retires the points ladder for everyone, grandfathered users included — a tier can then only be bought. Leave it on through the grandfather window: points already take nobody higher than the tier the list caps them at, and the app shows the membership card instead of the points card to everyone they cannot raise."
            />
          </div>

          {/* 2 — the lock route, with the numbers it actually uses */}
          <div className="mb-6 rounded-lg border border-gray-200 p-4">
            <h4 className="mb-1 text-sm font-semibold text-gray-900">
              Lock FUSE
            </h4>
            <p className="mb-3 text-xs text-gray-500">
              Lock soFUSE for a term to hold a tier. These amounts are the
              lock&rsquo;s own, separate from &ldquo;FUSE Staking for Tier
              Unlock&rdquo; above: editing one pair does not change the other.
              A lock is graded against the amounts in force when it was opened,
              so a change here prices new locks only.
            </p>
            <div className="mb-4">
              <ToggleField
                label="FUSE Lock Enabled"
                value={config.tierMembership.lockEnabled}
                onChange={(v) =>
                  updateConfig("tierMembership", "lockEnabled", v)
                }
                tooltip="Whether locking FUSE for a term buys a tier. Locks already taken keep their own term and are unaffected by turning this off."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField
                label="Prime FUSE Amount"
                value={config.tierMembership.lockTier2Amount}
                onChange={(v) =>
                  handleNumericUpdate("tierMembership", "lockTier2Amount", v)
                }
                type="number"
                suffix="FUSE"
                tooltip="FUSE that must be LOCKED to hold Prime. 0 disables this rung. Separate from the FUSE Staking amount above, which is what a held balance is measured against — raise this one when the lock is re-priced and grandfathered holders keep the terms they joined at."
              />
              <InputField
                label="Ultra FUSE Amount"
                value={config.tierMembership.lockTier3Amount}
                onChange={(v) =>
                  handleNumericUpdate("tierMembership", "lockTier3Amount", v)
                }
                type="number"
                suffix="FUSE"
                tooltip="FUSE that must be LOCKED to hold Ultra. 0 disables this rung. Separate from the FUSE Staking amount above — see the Prime field."
              />
              <InputField
                label="Lock Duration"
                value={config.tierMembership.lockDurationDays}
                onChange={(v) =>
                  handleNumericUpdate("tierMembership", "lockDurationDays", v)
                }
                type="number"
                suffix="days"
                tooltip="The term a NEW lock carries. Each lock stores its own expiry, so raising this cannot extend a commitment a user has already made. Keep it equal to the contract's own lockDuration — this value is what the app promises, the contract's is what binds."
              />
            </div>
          </div>

          {/* 3 — retiring the routes v3 replaces */}
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h4 className="mb-1 text-sm font-semibold text-gray-900">
              Retiring Skip-the-Line and Points
            </h4>
            <p className="mb-3 text-xs text-gray-500">
              Holding FUSE in Savings, and the points ladder, keep granting a
              tier only to users who held one through them on the launch date —
              up to the tier they had then — and only for the window below.
              Everyone else gets v3 only, however old their account, and the
              app shows them only the v3 routes. The list records what each
              route would grant whatever its toggle says, so a toggle only
              ever hides a route — for everyone on the list too — and never
              erases the list. Both dates are read-only
              here except the window: the launch date is stamped the first time
              the backend needs it, so it records when v3 actually went live.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InputField
                label="Launched"
                value={asDay(config.tierMembership.legacyGrandfatherFrom)}
                onChange={() => {}}
                disabled
                tooltip="The day rewards v3 went live in this environment, and the day the grandfather list was taken: users holding a tier through the old routes that day keep it; nobody else gets them. Stamped by the backend the first time it is needed, so it records the real launch rather than a value someone typed."
              />
              <InputField
                label="Grandfather Window"
                value={config.tierMembership.legacyGrandfatherDays}
                onChange={(v) =>
                  handleNumericUpdate(
                    "tierMembership",
                    "legacyGrandfatherDays",
                    v,
                  )
                }
                type="number"
                suffix="days"
                tooltip="How long users on the grandfather list keep the old routes. Counted from the launch date. The rewards spec commits to at least 30 days' notice before any change of this kind, and six months (180) for this one."
              />
              <InputField
                label="Old Routes Stop"
                value={asDay(config.tierMembership.legacyGrandfatherUntil)}
                onChange={() => {}}
                disabled
                tooltip="Launch date plus the window. After this, holding FUSE and points grant nothing to anyone, and every tier comes from a lock or an annual charge."
              />
            </div>
          </div>

          {/* 4 — the cash route */}
          <div className="mb-4 rounded-lg border border-gray-200 p-4">
            <h4 className="mb-1 text-sm font-semibold text-gray-900">
              Annual Charge
            </h4>
            <p className="mb-3 text-xs text-gray-500">
              Pay once a year in USDC to hold a tier. Nothing to do with the
              Fees config — this is a membership price, not a rate taken on a
              transaction.
            </p>
            <div className="mb-4">
              <ToggleField
                label="Annual Charge Enabled"
                value={config.tierMembership.subscriptionEnabled}
                onChange={(v) =>
                  updateConfig("tierMembership", "subscriptionEnabled", v)
                }
                tooltip="Whether a tier can be bought with an annual USDC charge. Off stops new sign-ups; memberships already running keep billing until they are cancelled."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Prime Annual Charge"
                value={config.tierMembership.primeAnnualUsd}
                onChange={(v) =>
                  handleNumericUpdate("tierMembership", "primeAnnualUsd", v)
                }
                type="number"
                suffix="USD"
                tooltip="Set -1 (or any value at or below 0) to stop selling Prime for cash, leaving the FUSE lock as its only route. A price change does not re-price anyone already subscribed: their mandate is signed at the price they agreed to, and a higher one asks them to sign again."
              />
              <InputField
                label="Ultra Annual Charge"
                value={config.tierMembership.ultraAnnualUsd}
                onChange={(v) =>
                  handleNumericUpdate("tierMembership", "ultraAnnualUsd", v)
                }
                type="number"
                suffix="USD"
                tooltip="-1 by default, meaning not for sale: Ultra is held by locking FUSE, not by paying. Enter a positive price to sell it for cash too, and the app shows both routes. Anything at or below 0 means not sold, and the app hides the cash route entirely rather than showing a $0 offer."
              />
              <InputField
                label="Grace Period"
                value={config.tierMembership.graceDays}
                onChange={(v) =>
                  handleNumericUpdate("tierMembership", "graceDays", v)
                }
                type="number"
                suffix="days"
                tooltip="How long a membership keeps its tier after a renewal charge first fails. The usual cause is a Safe briefly short of USDC; the charge is retried on a backoff throughout. Never applies to a first charge — a membership that has paid for nothing gets no grace."
              />
              <InputField
                label="Renewal Notice"
                value={config.tierMembership.renewalNoticeDays}
                onChange={(v) =>
                  handleNumericUpdate("tierMembership", "renewalNoticeDays", v)
                }
                type="number"
                suffix="days"
                tooltip="How far ahead of a renewal the user is told it is coming."
              />
            </div>
          </div>

          <button
            onClick={saveTierMembershipConfig}
            disabled={
              saving ||
              (!hasChanges("tierMembership") && !hasChanges("fuseStaking"))
            }
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Tier Membership Config
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
