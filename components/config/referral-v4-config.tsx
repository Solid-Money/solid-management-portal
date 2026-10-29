"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Eye, Loader2, PauseCircle, Save, X } from "lucide-react";
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
import { REFERRAL_V4_KEYS, useReferralV4Access } from "@/hooks/use-referral-v4";
import {
  REFERRAL_V4_NUMBER_BOUNDS,
  WEEKDAYS,
  formatUtc,
  isNotAvailable,
  isoToUtcInput,
  payoutScheduleLabel,
  utcHourLabel,
  utcInputToIso,
  weekdayName,
  type ReferralV4NumericField,
} from "@/lib/referral-v4";
import { formatNumber, formatUsd } from "@/lib/utils";
import type { ReferralV4Config } from "@/types/referral-v4";

/** Every numeric field, for the blank and bounds checks before saving. */
const NUMERIC_FIELDS = Object.keys(
  REFERRAL_V4_NUMBER_BOUNDS,
) as ReferralV4NumericField[];

/** What each number is called when a save is refused over it. */
const FIELD_LABELS: Record<ReferralV4NumericField, string> = {
  welcomeReferrerUsd: "Welcome bonus — referrer",
  welcomeFriendUsd: "Welcome bonus — friend",
  welcomeSpendTargetUsd: "Welcome bonus — spend target",
  welcomeMerchantTarget: "Welcome bonus — distinct shops",
  welcomeWindowDays: "Welcome bonus — window",
  bigSpenderReferrerUsd: "Big spender — referrer",
  bigSpenderFriendUsd: "Big spender — friend",
  bigSpenderSpendTargetUsd: "Big spender — spend target",
  bigSpenderWindowDays: "Big spender — window",
  upgradePrimeUsd: "Upgrade bonus — Prime",
  upgradeUltraUsd: "Upgrade bonus — Ultra",
  upgradePrimeLockFuse: "Upgrade bonus — Prime lock",
  upgradeUltraLockFuse: "Upgrade bonus — Ultra lock",
  upgradeLockHoldDays: "Upgrade bonus — lock hold",
  spendShareRate: "Spend share rate",
  spendShareCapPerFriendUsd: "Cap per friend",
  spendShareMaxWeeklyPayoutUsd: "Max weekly payout",
  minWeeklyPayoutUsd: "Min weekly payout",
  holdDays: "Hold",
  payoutWeekday: "Payout day",
  payoutHourUtc: "Payout hour",
  settlementGraceDays: "Settlement grace",
  bonusLimitBase: "Bonus limit — starting limit",
  bonusLimitPerActiveFriend: "Bonus limit — per active friend",
  bonusLimitActiveSpendUsd: "Bonus limit — active friend spend",
  monthTwoFromDays: "Month two starts",
  monthTwoToDays: "Month two ends",
  reviewMonthlyThreshold: "Review threshold",
  reviewWindowDays: "Review window",
  maxBoostMultiplier: "Max boost multiplier",
  linkMaxDaysAfterSignup: "Code added within",
  clawbackWatchDays: "Clawback watch window",
  debtWriteOffDays: "Write off after",
  debtWaiveBelowUsd: "Waive below",
};

const ISO2 = /^[A-Z]{2}$/;

/** A stored fraction as the percent its box shows, or blank mid-edit. */
function fractionAsPercent(value: number): number | string {
  return (value as unknown) === "" ? "" : Math.round(value * 1e6) / 1e4;
}

/** Whole dollars without cents, anything else with them. */
function money(value: unknown): string {
  const amount = Number(value) || 0;
  return formatUsd(amount, Number.isInteger(amount) ? 0 : 2);
}

/**
 * A field's allowed range as the operator types it: "0–60", "0%–5%", or with
 * `joiner` " and " for a sentence.
 */
function rangeText(key: ReferralV4NumericField, joiner = "–"): string {
  const { min, max } = REFERRAL_V4_NUMBER_BOUNDS[key];
  if (key === "spendShareRate") {
    return `${fractionAsPercent(min)}%${joiner}${fractionAsPercent(max)}%`;
  }
  return `${formatNumber(min, 2, 0)}${joiner}${formatNumber(max, 2, 0)}`;
}

/**
 * Why this config can't be saved, or null when it can. Mirrors what the
 * backend refuses — a blank box, a number out of its range, a fraction where
 * a whole number belongs, month two ending before it starts — so the operator
 * hears it here instead of from a 400.
 */
function saveRefusal(v4: ReferralV4Config): string | null {
  // These size real payouts. A cleared box would go out as 0 and quietly
  // switch a reward off, so it is refused instead.
  if (NUMERIC_FIELDS.some((key) => (v4[key] as unknown) === "")) {
    return "Fill in every Referral v4 field before saving";
  }
  for (const key of NUMERIC_FIELDS) {
    const value = Number(v4[key]);
    const { min, max, integer } = REFERRAL_V4_NUMBER_BOUNDS[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      return `${FIELD_LABELS[key]} must be between ${rangeText(key, " and ")}`;
    }
    if (integer && !Number.isInteger(value)) {
      return `${FIELD_LABELS[key]} must be a whole number`;
    }
  }
  if (Number(v4.monthTwoToDays) <= Number(v4.monthTwoFromDays)) {
    return "Month two has to end after it starts";
  }
  if (v4.enabled && !v4.launchAt) {
    return "Set a launch time before opening referral v4 to new signups";
  }
  return null;
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

/** The one-line explanation under a field. */
function Help({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <p className={`mt-1 text-xs ${error ? "text-red-600" : "text-gray-500"}`}>
      {children}
    </p>
  );
}

/** A numeric field picked from a fixed list (weekday, hour). */
function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
  help,
}: {
  label: string;
  value: number;
  options: Array<{ value: number; label: string }>;
  onChange: (value: number) => void;
  disabled: boolean;
  help: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 text-sm font-medium text-gray-700">{label}</label>
      <select
        aria-label={label}
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Help>{help}</Help>
    </div>
  );
}

const WEEKDAY_OPTIONS = WEEKDAYS.map((name, index) => ({
  value: index,
  label: name,
}));

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: utcHourLabel(hour) ?? String(hour),
}));

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
 * Referral program v4: card credit for friends whose referral is recorded
 * while it is open to new signups, a share of their card spend for the
 * referrer.
 *
 * Saved through its own endpoint (`referral-v4`), so it never touches the
 * legacy cashback section below it — friends recorded before launch keep being
 * paid by those settings. Each friend is stamped with the program open when
 * their referral is recorded, so nothing here moves an existing friend between
 * programs. Editable only by the admins the backend allows
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
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const v4 = config?.referralV4;
  const saved = savedConfig?.referralV4;
  const canEdit = access.data?.canEditConfig === true;
  const disabled = !canEdit;

  const field = (
    key: ReferralV4NumericField,
    label: string,
    options: {
      suffix?: string;
      step?: string;
      tooltip?: string;
      /** A one-line explanation under the box, followed by its range. */
      help?: string;
      /** Shown in red in place of the help line. */
      error?: string | null;
    } = {},
  ) => (
    <div>
      <InputField
        label={label}
        value={v4?.[key] ?? ""}
        onChange={(value) => handleNumericUpdate("referralV4", key, value)}
        type="number"
        suffix={options.suffix}
        step={options.step ?? "1"}
        min={REFERRAL_V4_NUMBER_BOUNDS[key].min}
        disabled={disabled}
        tooltip={options.tooltip}
      />
      {options.error ? (
        <Help error>{options.error}</Help>
      ) : (
        options.help && (
          <Help>
            {options.help}{" "}
            <span className="text-gray-400">({rangeText(key)})</span>
          </Help>
        )
      )}
    </div>
  );

  if (!config) return null;

  const turningOn = !!v4?.enabled && !saved?.enabled;
  const launchMoved =
    !!v4?.enabled &&
    !!saved?.enabled &&
    (v4.launchAt || null) !== (saved.launchAt || null);

  const legacy = config.referralCashback;
  const legacyAmounts = `${money(legacy.referrerRewardUsd)} + ${money(
    legacy.newUserRewardUsd,
  )}`;
  const payoutDay = weekdayName(v4?.payoutWeekday);
  const schedule = payoutScheduleLabel(v4?.payoutWeekday, v4?.payoutHourUtc);
  const monthTwoInverted =
    !!v4 &&
    (v4.monthTwoFromDays as unknown) !== "" &&
    (v4.monthTwoToDays as unknown) !== "" &&
    Number(v4.monthTwoToDays) <= Number(v4.monthTwoFromDays);

  const save = async () => {
    if (!v4) return;
    setConfirmOpen(false);

    await saveSection(
      "Referral v4",
      "referral-v4",
      {
        enabled: v4.enabled,
        paused: v4.paused,
        launchAt: v4.launchAt || null,
        ...Object.fromEntries(
          NUMERIC_FIELDS.map((key) => [key, Number(v4[key])]),
        ),
        bonusLimitEnabled: v4.bonusLimitEnabled,
        clawbackEnabled: v4.clawbackEnabled,
        excludedCountries: v4.excludedCountries,
      },
      "referralV4",
    );
    // Boosts, review and analytics read the saved schedule and limits.
    void queryClient.invalidateQueries({ queryKey: REFERRAL_V4_KEYS.config });
  };

  const requestSave = () => {
    if (!v4) return;

    const refusal = saveRefusal(v4);
    if (refusal) {
      toast.error(refusal);
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
      description={`Friends whose referral is recorded while v4 is open to new signups earn card credit (welcome, big spender, upgrade) instead of soFUSE, and their referrer earns a share of their card spend, paid in soFUSE ${
        payoutDay ? `every ${payoutDay}` : "weekly"
      }, up to a cap per friend. Every friend keeps the program they were recorded under; friends from before launch stay on the legacy cashback program below.`}
      icon={<CreditCard className="h-5 w-5 text-emerald-600" />}
    >
      {!v4 ? (
        <NotAvailableYet what="The referral v4 config" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={saved?.enabled ? "success" : "muted"}>
              {saved?.enabled ? "Open to new signups" : "Closed to new signups"}
            </Badge>
            {saved?.paused && (
              <Badge variant="danger">
                <PauseCircle className="h-3 w-3" />
                Payouts paused
              </Badge>
            )}
            {saved?.enabled && saved.launchAt && (
              <span className="text-xs text-gray-500">
                New referrals go on v4 from {formatUtc(saved.launchAt)}
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
          {saved?.paused && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Payouts are paused: no card credit is being credited and no spend
              share is being sent. Friends keep earning, and nothing is lost —
              it is paid once payouts resume.
            </p>
          )}
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
            title="Program"
            tooltip="Which program a friend is on is decided once, when their referral is recorded, and stamped on them: v4 if it is open to new signups and the launch time has passed, legacy otherwise."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <ToggleField
                  label="Open to new signups"
                  value={v4.enabled}
                  onChange={(value) =>
                    updateConfig("referralV4", "enabled", value)
                  }
                  disabled={disabled}
                />
                <Help>
                  Friends are stamped with the program open at the moment their
                  referral is recorded, so changing this never moves existing
                  friends between programs. Existing (pre-launch) friends keep
                  the cashback program&apos;s {legacyAmounts}.
                </Help>
              </div>
              <div>
                <ToggleField
                  label="Pause payouts"
                  value={v4.paused}
                  onChange={(value) =>
                    updateConfig("referralV4", "paused", value)
                  }
                  disabled={disabled}
                />
                <Help>
                  Stops crediting card credit and sending spend share. Earning
                  continues and nothing is lost.
                </Help>
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
                <Help>
                  {v4.launchAt
                    ? `Referrals recorded at or after ${formatUtc(
                        v4.launchAt,
                      )}, while open to new signups, are on v4.`
                    : "Not set. v4 opens to new signups at this time."}
                </Help>
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
              {field("welcomeMerchantTarget", "Distinct shops")}
              {field("welcomeWindowDays", "Window", {
                suffix: "days",
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
            tooltip="The referrer's share of each v4 friend's eligible settled card spend, net of refunds, per Monday-to-Monday UTC week, paid in soFUSE in the weekly payout run (see Payout schedule)."
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
                  "Safety ceiling on one referrer's weekly spend-share transfer.",
              })}
            </div>
          </Group>

          <Group
            title="Payout schedule"
            tooltip="One weekly run credits the bonuses that have unlocked as card credit and sends each referrer last week's spend share in one soFUSE transfer."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
              <SelectField
                label="Payout day"
                value={v4.payoutWeekday}
                options={WEEKDAY_OPTIONS}
                onChange={(value) =>
                  updateConfig("referralV4", "payoutWeekday", value)
                }
                disabled={disabled}
                help="Weekday of the payout run."
              />
              <SelectField
                label="Payout hour"
                value={v4.payoutHourUtc}
                options={HOUR_OPTIONS}
                onChange={(value) =>
                  updateConfig("referralV4", "payoutHourUtc", value)
                }
                disabled={disabled}
                help="Hour of the payout run, in UTC."
              />
              {field("holdDays", "Hold", {
                suffix: "days",
                tooltip:
                  "Every bonus unlocks this many days after it is earned, then is credited in the next payout run.",
              })}
              {field("settlementGraceDays", "Settlement grace", {
                suffix: "days",
                help: "Days a step stays open after its window, for purchases that settle late.",
              })}
              {field("minWeeklyPayoutUsd", "Min weekly payout", {
                suffix: "$",
                step: "0.5",
                help: "Smaller weekly spend-share transfers wait for next week.",
              })}
            </div>
            {schedule && (
              <p className="mt-3 text-xs text-gray-500">
                Runs {schedule}.
              </p>
            )}
          </Group>

          <Group title="Limits & review">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {field("reviewMonthlyThreshold", "Review threshold", {
                  suffix: "friends",
                  tooltip:
                    "Referrers with more qualified friends than this within the review window go to the review queue.",
                })}
                {field("reviewWindowDays", "Review window", {
                  suffix: "days",
                  help: "Window the review threshold counts qualified friends over.",
                })}
                {field("linkMaxDaysAfterSignup", "Code added within", {
                  suffix: "days of signup",
                  tooltip:
                    "A referral code added later than this after signup earns nothing in v4.",
                })}
                {field("maxBoostMultiplier", "Max boost multiplier", {
                  suffix: "×",
                  step: "0.5",
                  help: "Highest multiplier a referral boost may be created with.",
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
                  tooltip="Caps the referrer's welcome bonuses: the starting limit, plus more for every friend who spends enough in their second month. Bonuses over the limit are kept and paid when it grows."
                />
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
                  {field("bonusLimitBase", "Starting limit", {
                    suffix: "bonuses",
                  })}
                  {field("bonusLimitPerActiveFriend", "Per active friend", {
                    suffix: "more",
                  })}
                  {field("bonusLimitActiveSpendUsd", "Active friend spends", {
                    suffix: "$ in month two",
                    step: "10",
                  })}
                  {field("monthTwoFromDays", "Month two starts", {
                    suffix: "days after signup",
                    help: "Start of a friend's second month, for the bonus limit.",
                  })}
                  {field("monthTwoToDays", "Month two ends", {
                    suffix: "days after signup",
                    help: "Its end. Must be after the start.",
                    error: monthTwoInverted
                      ? `Must be after the start (${v4.monthTwoFromDays} days).`
                      : null,
                  })}
                </div>
              </div>
            </div>
          </Group>

          <Group
            title="Clawback"
            tooltip="Only v4 welcome and big-spender bonuses, on either side, once credited. A refund during the hold still just cancels the bonus, spend share corrects itself, and the legacy program is untouched."
          >
            <div
              className={`rounded-lg border p-3 ${
                v4.clawbackEnabled
                  ? "border-indigo-100"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <ToggleField
                label="Clawback"
                value={v4.clawbackEnabled}
                onChange={(value) =>
                  updateConfig("referralV4", "clawbackEnabled", value)
                }
                disabled={disabled}
              />
              <Help>
                Reverses a credited spend bonus whose qualifying spend is later
                refunded below the bar, and books a debt that is recovered from
                the user&apos;s future v4 bonuses and spend share — never from
                their card credit.
              </Help>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                {field("clawbackWatchDays", "Watch window", {
                  suffix: "days after crediting",
                  help: "How long after crediting a refund still reverses the bonus.",
                })}
                {field("debtWriteOffDays", "Write off after", {
                  suffix: "days",
                  help: "An unrecovered debt is written off this many days after it is booked.",
                })}
                {field("debtWaiveBelowUsd", "Waive below", {
                  suffix: "$",
                  step: "0.5",
                  help: "A debt whose remainder falls below this is waived (closed).",
                })}
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
            {fractionAsPercent(v4.spendShareRate)}% of their spend. Boosts (up
            to ×{v4.maxBoostMultiplier}) are set on{" "}
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
                    ? "Open referral v4 to new signups?"
                    : "Move the referral v4 launch time?"}
                </DialogTitle>
                <DialogDescription>
                  Referrals recorded at or after{" "}
                  <span className="font-medium text-gray-900">
                    {formatUtc(v4.launchAt)}
                  </span>{" "}
                  will be on v4: the friend earns <strong>card credit</strong>{" "}
                  instead of soFUSE, and their referrer earns{" "}
                  {fractionAsPercent(v4.spendShareRate)}% of their card spend.
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li>
                  Friends already recorded keep the program they were stamped
                  with — existing friends stay on the cashback program&apos;s{" "}
                  {legacyAmounts} in soFUSE.
                </li>
                <li>
                  The app switches to the v4 referral screens once the change
                  propagates (up to 5 minutes, or clear the cache).
                </li>
                {launchMoved && (
                  <li>
                    Was {formatUtc(saved?.launchAt)}. Only referrals recorded
                    from now on follow the new time; nobody already recorded
                    changes program.
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
                  {turningOn ? "Open to new signups" : "Save launch time"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </ConfigSection>
  );
}
