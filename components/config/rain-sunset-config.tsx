"use client";

import { useState } from "react";
import { Loader2, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import ConfirmationModal from "@/components/ui/confirmation-modal";
import { AnalyticsKpiCard } from "@/components/analytics/kpi-card";
import { FallbackNote, SourceBadge } from "@/components/config/rain-rtf-config";
import { useUpdateRainSunsetConfig } from "@/hooks/use-general-config";
import { formatNumber } from "@/lib/utils";
import type {
  RainSunsetConfig,
  RainSunsetSetting,
  UpdateRainSunsetConfig,
} from "@/types";

const SETTING = {
  ONBOARDING_CLOSED: "RAIN_SUNSET_ONBOARDING_CLOSED",
  MIGRATION_ENABLED: "RAIN_SUNSET_MIGRATION_ENABLED",
  NOTICE_ENABLED: "RAIN_SUNSET_NOTICE_ENABLED",
  CLOSES_AT: "RAIN_SUNSET_CLOSES_AT",
} as const;

type SwitchField = "onboardingClosed" | "migrationEnabled" | "noticeEnabled";

type RowSpec =
  | { name: string; kind: "switch"; field: SwitchField }
  | { name: string; kind: "date"; field: "closesAt" };

const ROWS: RowSpec[] = [
  {
    name: SETTING.ONBOARDING_CLOSED,
    kind: "switch",
    field: "onboardingClosed",
  },
  {
    name: SETTING.MIGRATION_ENABLED,
    kind: "switch",
    field: "migrationEnabled",
  },
  { name: SETTING.NOTICE_ENABLED, kind: "switch", field: "noticeEnabled" },
  { name: SETTING.CLOSES_AT, kind: "date", field: "closesAt" },
];

/** Whole numbers, grouped — counts of cards and users. */
const count = (value: number) => formatNumber(value, 0, 0);

interface RainSunsetConfigProps {
  config: RainSunsetConfig;
}

/**
 * Rain sunset: the switches that wind Rain down, and how far it has got.
 *
 * Closing onboarding stops every new Rain card, Rain application and Rain
 * virtual account; it does not touch the cards and accounts people already
 * hold. The move to Wirex is the user's own: they verify with Sumsub from the
 * app, and their Rain card and Rain account close when the Wirex card is
 * issued. The counts are there so an operator can watch that happen.
 */
export function RainSunsetConfigSection({ config }: RainSunsetConfigProps) {
  const update = useUpdateRainSunsetConfig();
  const [edits, setEdits] = useState<UpdateRainSunsetConfig>({});
  const [confirmingReopen, setConfirmingReopen] = useState(false);

  const settingFor = (name: string): RainSunsetSetting | undefined =>
    config.settings.find((setting) => setting.name === name);

  const savedBool = (name: string): boolean =>
    settingFor(name)?.effective === "true";

  const boolValue = (name: string, field: SwitchField): boolean => {
    const edited = edits[field];
    if (edited === null) {
      // Pending reset: show what the environment (or default) will give back.
      const setting = settingFor(name);
      return (setting?.environment ?? setting?.publishedDefault) === "true";
    }
    return edited ?? savedBool(name);
  };

  const dateValue = (): string =>
    edits.closesAt ?? settingFor(SETTING.CLOSES_AT)?.stored ?? "";

  const hasChanges = Object.keys(edits).length > 0;
  // While a save is in flight its success handler clears the edits, so no
  // control may take a newer edit that would be lost with them.
  const saving = update.isPending;

  const commit = () => {
    update.mutate(edits, {
      onSuccess: () => {
        setEdits({});
        toast.success("Rain sunset settings saved.");
      },
      onError: (error) => toast.error(describeError(error)),
    });
  };

  const save = () => {
    if (!hasChanges) {
      toast.info("Nothing to save.");
      return;
    }
    // Reopening Rain is the one change here that costs money and contradicts
    // the pause agreed with Rain: every new applicant becomes a paid Rain
    // application and a $10 card. Worth a second look — whether it comes from
    // switching it off or from a reset that hands the setting back to an
    // environment value of "false", so it is judged on the value that results.
    const reopening =
      edits.onboardingClosed !== undefined &&
      savedBool(SETTING.ONBOARDING_CLOSED) &&
      !boolValue(SETTING.ONBOARDING_CLOSED, "onboardingClosed");
    if (reopening) {
      setConfirmingReopen(true);
      return;
    }
    commit();
  };

  const reset = (field: keyof UpdateRainSunsetConfig, isSwitch: boolean) => {
    setEdits((prev) => ({ ...prev, [field]: isSwitch ? null : "" }));
  };

  const rows = ROWS.flatMap((spec) => {
    const setting = settingFor(spec.name);
    return setting ? [{ spec, setting }] : [];
  });

  const { summary, resolved } = config;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <AnalyticsKpiCard
          title="Rain cards held"
          value={count(summary.rainCardsHeld)}
          scope="Active, frozen or pending"
        />
        <AnalyticsKpiCard
          title="Moves started"
          value={count(summary.migrationsStarted)}
          scope="Sumsub check opened"
        />
        <AnalyticsKpiCard
          title="Moves verified"
          value={count(summary.migrationsVerified)}
          scope="Wirex approved"
        />
        <AnalyticsKpiCard
          title="Rain cards retired"
          value={count(summary.rainCardsRetired)}
          scope="Holder got a Wirex card"
        />
        <AnalyticsKpiCard
          title="Cancellations pending"
          value={count(summary.rainCancellationsPending)}
          scope="Retired, Rain not confirmed"
        />
      </div>

      <p className="text-xs text-gray-500">
        In force: new Rain onboarding{" "}
        <strong>{resolved.onboardingClosed ? "closed" : "open"}</strong>, move
        to Wirex{" "}
        <strong>{resolved.migrationEnabled ? "open" : "closed"}</strong>,
        closing notice <strong>{resolved.noticeEnabled ? "on" : "off"}</strong>,
        closing date <strong>{resolved.closesAt ?? "not announced"}</strong>.
      </p>

      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {rows.map(({ spec, setting }) => (
          <div key={setting.name} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {setting.label}
                  </span>
                  <SourceBadge setting={setting} />
                  <code className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-400">
                    {setting.name}
                  </code>
                </div>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">
                  {setting.description}
                </p>
                <FallbackNote setting={setting} />
              </div>

              <div className="flex items-center gap-2">
                {spec.kind === "switch" ? (
                  (() => {
                    const on = boolValue(setting.name, spec.field);
                    return (
                      <button
                        type="button"
                        aria-label={setting.label}
                        aria-pressed={on}
                        disabled={saving}
                        onClick={() =>
                          setEdits((prev) => ({ ...prev, [spec.field]: !on }))
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          on ? "bg-indigo-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            on ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    );
                  })()
                ) : (
                  <input
                    type="date"
                    aria-label={setting.label}
                    value={dateValue()}
                    disabled={saving}
                    onChange={(event) =>
                      setEdits((prev) => ({
                        ...prev,
                        closesAt: event.target.value,
                      }))
                    }
                    className="w-44 rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                )}

                {setting.source === "database" ? (
                  <button
                    type="button"
                    title="Clear this and fall back to the environment"
                    disabled={saving}
                    onClick={() => reset(spec.field, spec.kind === "switch")}
                    className="cursor-pointer rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : (
                  <span className="w-[30px]" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        {hasChanges ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => setEdits({})}
            className="cursor-pointer text-sm text-gray-500 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard changes
          </button>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={saving || !hasChanges}
          className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          Save
        </button>
      </div>

      <ConfirmationModal
        isOpen={confirmingReopen}
        title="Reopen new Rain onboarding?"
        isDestructive
        confirmText="Reopen Rain"
        onCancel={() => setConfirmingReopen(false)}
        onConfirm={() => {
          setConfirmingReopen(false);
          commit();
        }}
        message={
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                aria-hidden
              />
              <p>Only reopen Rain if the program has been resumed with Rain.</p>
            </div>
            <p>
              New users in Rain-only countries will be offered a Rain card
              again, and every one who applies becomes a paid Rain application
              and a new Rain card.
            </p>
          </div>
        }
      />
    </div>
  );
}

/** The backend's own reason, which names the field and why it was refused. */
function describeError(error: Error): string {
  const response = (
    error as Error & {
      response?: { data?: { message?: string | string[] } };
    }
  ).response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string" && message.trim()) return message;
  return "Could not save the Rain sunset settings.";
}
