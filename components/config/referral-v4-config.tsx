"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Eye, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";

import {
  ConfigSection,
  InfoTooltip,
  InputField,
  ToggleField,
} from "@/components/config/config-fields";
import { NotAvailableYet } from "@/components/referral-v4/not-available";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ConfigEditor } from "@/hooks/use-config-editor";
import { useReferralV4Access } from "@/hooks/use-referral-v4";
import {
  formatUtc,
  isNotAvailable,
  isoToUtcInput,
  utcInputToIso,
} from "@/lib/referral-v4";
import { formatUsd } from "@/lib/utils";
import type { ReferralV4Config } from "@/types/referral-v4";

type NumericField = {
  [K in keyof ReferralV4Config]: ReferralV4Config[K] extends number ? K : never;
}[keyof ReferralV4Config];

/** Every numeric field, for the "nothing left blank" check before saving. */
const NUMERIC_FIELDS: NumericField[] = [
  "welcomeReferrerUsd",
  "welcomeFriendUsd",
  "welcomeSpendTargetUsd",
  "welcomeMerchantTarget",
  "welcomeWindowDays",
  "bigSpenderReferrerUsd",
  "bigSpenderFriendUsd",
  "bigSpenderSpendTargetUsd",
  "bigSpenderWindowDays",
  "upgradePrimeUsd",
  "upgradeUltraUsd",
  "upgradePrimeLockFuse",
  "upgradeUltraLockFuse",
  "upgradeLockHoldDays",
  "spendShareRate",
  "spendShareCapPerFriendUsd",
  "spendShareMaxWeeklyPayoutUsd",
  "holdDays",
  "bonusLimitBase",
  "bonusLimitPerActiveFriend",
  "bonusLimitActiveSpendUsd",
  "reviewMonthlyThreshold",
  "linkMaxDaysAfterSignup",
];

const ISO2 = /^[A-Z]{2}$/;

/** A stored fraction as the percent its box shows, or blank mid-edit. */
function fractionAsPercent(value: number): number | string {
  return (value as unknown) === "" ? "" : Math.round(value * 1e6) / 1e4;
}

function Group({
  title,
  tooltip,
  children,
}: {
  title: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border-2 border-gray-200 bg-white p-4 shadow-sm">
      <h4 className="mb-3 font-semibold text-gray-800">
        {title}
        {tooltip && <InfoTooltip text={tooltip} />}
      </h4>
      {children}
    </div>
  );
}

/** ISO-2 country codes as removable chips; type and press Enter or comma. */
function CountryChips({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const codes = draft
      .split(/[\s,;]+/)
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length === 0) return;

    const invalid = codes.filter((code) => !ISO2.test(code));
    if (invalid.length > 0) {
      toast.error(`Not an ISO-2 country code: ${invalid.join(", ")}`);
    }
    const next = [...value];
    for (const code of codes) {
      if (ISO2.test(code) && !next.includes(code)) next.push(code);
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-2 ${
        disabled ? "bg-gray-100" : "bg-white"
      }`}
    >
      {value.length === 0 && disabled && (
        <span className="text-sm text-gray-400">None</span>
      )}
      {value.map((code) => (
        <span
          key={code}
          className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-800"
        >
          {code}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(value.filter((c) => c !== code))}
              className="cursor-pointer text-gray-400 hover:text-gray-700"
              aria-label={`Remove ${code}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add();
            } else if (
              event.key === "Backspace" &&
              draft === "" &&
              value.length > 0
            ) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={add}
          placeholder="Add a code, e.g. NG"
          className="min-w-32 flex-1 border-none px-1 text-sm outline-none"
        />
      )}
    </div>
  );
}

type Props = Pick<
  ConfigEditor,
  | "config"
  | "savedConfig"
  | "saving"
  | "hasChanges"
  | "updateConfig"
  | "handleNumericUpdate"
  | "saveSection"
>;

/**
 * Referral program v4: card credit for friends who sign up at or after the
 * launch time, a share of their card spend for the referrer.
 *
 * Saved through its own endpoint (`referral-v4`), so it never touches the
 * legacy cashback section above it — friends from before launch keep being
 * paid by those settings. Editable only by the admins the backend allows
 * (`GET /referral-v4/access`); everyone else sees it read-only.
 */
export default function ReferralV4ConfigSection({
  config,
  savedConfig,
  saving,
  hasChanges,
  updateConfig,
  handleNumericUpdate,
  saveSection,
}: Props) {
  const access = useReferralV4Access();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const v4 = config?.referralV4;
  const saved = savedConfig?.referralV4;
  const canEdit = access.data?.canEditConfig === true;
  const disabled = !canEdit;

  const field = (
    key: NumericField,
    label: string,
    options: {
      suffix?: string;
      step?: string;
      min?: number;
      tooltip?: string;
    } = {},
  ) => (
    <InputField
      label={label}
      value={v4?.[key] ?? ""}
      onChange={(value) => handleNumericUpdate("referralV4", key, value)}
      type="number"
      suffix={options.suffix}
      step={options.step ?? "1"}
      min={options.min ?? 0}
      disabled={disabled}
      tooltip={options.tooltip}
    />
  );

  if (!config) return null;

  const turningOn = !!v4?.enabled && !saved?.enabled;
  const launchMoved =
    !!v4?.enabled &&
    !!saved?.enabled &&
    (v4.launchAt || null) !== (saved.launchAt || null);

  const legacy = config.referralCashback;

  const save = async () => {
    if (!v4) return;
    setConfirmOpen(false);

    await saveSection(
      "Referral v4",
      "referral-v4",
      {
        enabled: v4.enabled,
        launchAt: v4.launchAt || null,
        ...Object.fromEntries(
          NUMERIC_FIELDS.map((key) => [key, Number(v4[key])]),
        ),
        bonusLimitEnabled: v4.bonusLimitEnabled,
        excludedCountries: v4.excludedCountries,
      },
      "referralV4",
    );
  };

  const requestSave = () => {
    if (!v4) return;

    // These size real payouts. A cleared box would go out as 0 and quietly
    // switch a reward off, so it is refused instead.
    if (NUMERIC_FIELDS.some((key) => (v4[key] as unknown) === "")) {
      toast.error("Fill in every Referral v4 field before saving");
      return;
    }
    if (NUMERIC_FIELDS.some((key) => Number(v4[key]) < 0)) {
      toast.error("Referral v4 amounts can't be negative");
      return;
    }
    if (Number(v4.spendShareRate) > 1) {
      toast.error("Spend share can't be more than 100%");
      return;
    }
    if (v4.enabled && !v4.launchAt) {
      toast.error("Set a launch time before turning referral v4 on");
      return;
    }
    if (turningOn || launchMoved) {
      setConfirmOpen(true);
      return;
    }
    void save();
  };

  const welcomeBothSides =
    (Number(v4?.welcomeReferrerUsd) || 0) + (Number(v4?.welcomeFriendUsd) || 0);
  const bigSpenderBothSides =
    (Number(v4?.bigSpenderReferrerUsd) || 0) +
    (Number(v4?.bigSpenderFriendUsd) || 0);

  return (
    <ConfigSection
      title="Referral v4 — card credit"
      description="Friends who sign up at or after the launch time earn card credit (welcome, big spender, upgrade) instead of soFUSE, and their referrer earns a share of their card spend, paid in soFUSE every Thursday, up to a cap per friend. Friends from before launch stay on the legacy cashback program below."
      icon={<CreditCard className="h-5 w-5 text-emerald-600" />}
    >
      {!v4 ? (
        <NotAvailableYet what="The referral v4 config" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={saved?.enabled ? "success" : "muted"}>
              {saved?.enabled ? "On" : "Off"}
            </Badge>
            {saved?.enabled && saved.launchAt && (
              <span className="text-xs text-gray-500">
                v4 for friends who signed up from {formatUtc(saved.launchAt)}
              </span>
            )}
            {!canEdit && !access.isLoading && (
              <Badge variant="warning">
                <Eye className="h-3 w-3" />
                View only
              </Badge>
            )}
            {access.isLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
            )}
          </div>
          {!canEdit && !access.isLoading && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {access.error
                ? isNotAvailable(access.error)
                  ? "Edit access can't be checked yet — the referral v4 access endpoint isn't served by this backend."
                  : "Edit access couldn't be checked. Reload to try again."
                : "You can view these settings but not change them. Editing is limited to the admins in REFERRAL_ADMIN_EMAILS."}
            </p>
          )}

          <Group
            title="Launch"
            tooltip="v4 applies by signup time: a friend who signs up at or after the launch time is on v4, everyone before stays on the legacy program."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-end pb-2">
                <ToggleField
                  label="Referral v4 enabled"
                  value={v4.enabled}
                  onChange={(value) =>
                    updateConfig("referralV4", "enabled", value)
                  }
                  disabled={disabled}
                  tooltip="While off, everyone stays on the legacy program and the app keeps today's referral screens."
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-1 text-sm font-medium text-gray-700">
                  Launch time (UTC)
                  <InfoTooltip text="Typed and shown in UTC, not your local time." />
                </label>
                <input
                  type="datetime-local"
                  value={isoToUtcInput(v4.launchAt)}
                  onChange={(event) =>
                    updateConfig(
                      "referralV4",
                      "launchAt",
                      utcInputToIso(event.target.value) ?? "",
                    )
                  }
                  disabled={disabled}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {v4.launchAt
                    ? `Friends signing up at or after ${formatUtc(
                        v4.launchAt,
                      )} are on v4; earlier friends keep the legacy reward.`
                    : "Not set. Friends signing up at or after this time will be on v4."}
                </p>
              </div>
            </div>
          </Group>

          <Group
            title="Welcome bonus"
            tooltip="Card credit for both sides when the friend clears the spend target across enough shops inside the window."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {field("welcomeReferrerUsd", "Referrer", { suffix: "$" })}
              {field("welcomeFriendUsd", "Friend", { suffix: "$" })}
              {field("welcomeSpendTargetUsd", "Spend target", {
                suffix: "$",
                step: "5",
              })}
              {field("welcomeMerchantTarget", "Distinct shops", {
                min: 1,
              })}
              {field("welcomeWindowDays", "Window", {
                suffix: "days",
                min: 1,
                tooltip: "Days from signup.",
              })}
            </div>
          </Group>

          <Group
            title="Big spender"
            tooltip="Card credit for both sides when the friend's spend reaches the target inside the window."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {field("bigSpenderReferrerUsd", "Referrer", { suffix: "$" })}
              {field("bigSpenderFriendUsd", "Friend", { suffix: "$" })}
              {field("bigSpenderSpendTargetUsd", "Spend target", {
                suffix: "$",
                step: "100",
              })}
              {field("bigSpenderWindowDays", "Window", {
                suffix: "days",
                min: 1,
                tooltip: "Days from signup.",
              })}
            </div>
          </Group>

          <Group
            title="Upgrade bonus"
            tooltip="Referrer only. Paid for the highest tier the friend reaches — by paying, or by keeping FUSE locked for the hold. Free trials never count. Ultra is the total: a referrer already paid for Prime gets the difference."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {field("upgradePrimeUsd", "Prime", { suffix: "$" })}
              {field("upgradeUltraUsd", "Ultra (total)", { suffix: "$" })}
              {field("upgradePrimeLockFuse", "Prime lock", {
                suffix: "FUSE",
                step: "1000",
              })}
              {field("upgradeUltraLockFuse", "Ultra lock", {
                suffix: "FUSE",
                step: "1000",
              })}
              {field("upgradeLockHoldDays", "Lock hold", {
                suffix: "days",
                tooltip:
                  "How long the FUSE has to stay locked before the lock route pays.",
              })}
            </div>
          </Group>

          <Group
            title="Spend share"
            tooltip="The referrer's share of each v4 friend's eligible settled card spend, net of refunds, per Monday-to-Monday UTC week, paid in soFUSE the following Thursday."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InputField
                label="Rate"
                value={fractionAsPercent(v4.spendShareRate)}
                onChange={(value) =>
                  handleNumericUpdate(
                    "referralV4",
                    "spendShareRate",
                    value,
                    true,
                  )
                }
                type="number"
                suffix="%"
                step="0.1"
                min={0}
                disabled={disabled}
                tooltip="Shown as a percent, stored as a fraction (1% = 0.01)."
              />
              {field("spendShareCapPerFriendUsd", "Cap per friend", {
                suffix: "$",
                step: "100",
                tooltip:
                  "A friend stops paying once the referrer has earned this much from them — bonuses and spend share together. Boosts don't count.",
              })}
              {field("spendShareMaxWeeklyPayoutUsd", "Max weekly payout", {
                suffix: "$ / referrer",
                step: "100",
                tooltip:
                  "Safety ceiling on one referrer's Thursday spend-share transfer.",
              })}
            </div>
          </Group>

          <Group title="Hold & limits">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {field("holdDays", "Hold", {
                  suffix: "days",
                  tooltip:
                    "Every bonus unlocks this many days after it is earned, then is credited in the next Thursday run.",
                })}
                {field("reviewMonthlyThreshold", "Review threshold", {
                  suffix: "/ month",
                  min: 1,
                  tooltip:
                    "Referrers with more qualified friends than this in a calendar month go to the review queue.",
                })}
                {field("linkMaxDaysAfterSignup", "Code added within", {
                  suffix: "days of signup",
                  tooltip:
                    "A referral code added later than this after signup earns nothing in v4.",
                })}
              </div>
              <div
                className={`rounded-lg border p-3 ${
                  v4.bonusLimitEnabled
                    ? "border-indigo-100"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <ToggleField
                  label="Bonus limit"
                  value={v4.bonusLimitEnabled}
                  onChange={(value) =>
                    updateConfig("referralV4", "bonusLimitEnabled", value)
                  }
                  disabled={disabled}
                  tooltip="Caps the referrer's welcome bonuses. Bonuses over the limit are kept and paid when it grows."
                />
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {field("bonusLimitBase", "Starting limit", {
                    suffix: "bonuses",
                  })}
                  {field("bonusLimitPerActiveFriend", "Per active friend", {
                    suffix: "more",
                  })}
                  {field("bonusLimitActiveSpendUsd", "Active friend spends", {
                    suffix: "$ in month 2",
                    step: "10",
                  })}
                </div>
              </div>
            </div>
          </Group>

          <Group
            title="Excluded countries"
            tooltip="No welcome or big-spender credit, on either side, when the friend's ID document country (or residence, if unknown) is listed. Spend share and upgrade still apply."
          >
            <CountryChips
              value={v4.excludedCountries ?? []}
              onChange={(next) =>
                updateConfig("referralV4", "excludedCountries", next)
              }
              disabled={disabled}
            />
          </Group>

          <p className="text-xs text-gray-500">
            Card credit per friend: {formatUsd(welcomeBothSides, 0)} when they
            clear the welcome bar (both sides),{" "}
            {formatUsd(welcomeBothSides + bigSpenderBothSides, 0)} if they also
            hit big spender — plus the referrer&apos;s upgrade bonus and{" "}
            {fractionAsPercent(v4.spendShareRate)}% of their spend. Boosts are
            set on{" "}
            <Link
              href="/referral-boosts"
              className="font-medium text-indigo-600 hover:underline"
            >
              Growth → Referral boosts
            </Link>
            .
          </p>

          <button
            onClick={requestSave}
            disabled={saving || disabled || !hasChanges("referralV4")}
            className="mt-2 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Referral v4 Config
          </button>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {turningOn
                    ? "Turn on referral v4?"
                    : "Move the referral v4 launch time?"}
                </DialogTitle>
                <DialogDescription>
                  Friends who sign up at or after{" "}
                  <span className="font-medium text-gray-900">
                    {formatUtc(v4.launchAt)}
                  </span>{" "}
                  will earn <strong>card credit</strong> instead of soFUSE, and
                  their referrer earns{" "}
                  {fractionAsPercent(v4.spendShareRate)}% of their card spend.
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li>
                  Friends who signed up before then keep the legacy reward (
                  {formatUsd(Number(legacy.referrerRewardUsd) || 0, 0)} +{" "}
                  {formatUsd(Number(legacy.newUserRewardUsd) || 0, 0)} in
                  soFUSE).
                </li>
                <li>
                  The app switches to the v4 referral screens once the change
                  propagates (up to 5 minutes, or clear the cache).
                </li>
                {launchMoved && (
                  <li>
                    Was {formatUtc(saved?.launchAt)}. Friends between the two
                    times change program.
                  </li>
                )}
              </ul>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void save()}
                  disabled={saving}
                  className="cursor-pointer"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {turningOn ? "Turn on v4" : "Save launch time"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </ConfigSection>
  );
}
