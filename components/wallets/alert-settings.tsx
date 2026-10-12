"use client";

import { useState } from "react";
import { UseMutationResult } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { WalletTreasurySettings } from "@/types";

type Save = UseMutationResult<
  WalletTreasurySettings,
  Error,
  Partial<WalletTreasurySettings>,
  unknown
>;

/**
 * The three numbers that decide what counts as urgent, and how often Slack
 * hears about it.
 *
 * They are settings rather than constants because none of them is a property
 * of the code. How many days of cover is "urgent" depends on how fast this
 * team can actually move money — which exchange, whose approval, what time
 * zone — and how often an alert is welcome depends on who is reading the
 * channel. Both were discovered to be wrong only once the alerts were live,
 * and neither should need a deploy to correct.
 */
export default function AlertSettings({
  settings,
  save,
}: {
  settings?: WalletTreasurySettings;
  save: Save;
}) {
  return (
    <div className="flex flex-wrap items-end justify-end gap-3 text-xs text-gray-600">
      <NumberSetting
        label="Critical at"
        suffix="days"
        value={settings?.criticalDays}
        step={0.5}
        min={0.25}
        max={30}
        title="Days of cover at or below which a token is urgent. This is the only level that reaches Slack."
        onCommit={(criticalDays) => save.mutate({ criticalDays })}
        saving={save.isPending}
      />
      <NumberSetting
        label="Low at"
        suffix="days"
        value={settings?.lowDays}
        step={0.5}
        min={0.5}
        max={60}
        title="Days of cover at or below which a token wants funding this week. Shown on the page; never sent to Slack."
        onCommit={(lowDays) => save.mutate({ lowDays })}
        saving={save.isPending}
      />
      <NumberSetting
        label="Alert at most every"
        suffix="min"
        value={settings?.alertIntervalMinutes}
        step={15}
        min={15}
        max={1440}
        title="The shortest gap between two Slack digests. The check runs every 15 minutes, so that is as fast as this goes."
        onCommit={(alertIntervalMinutes) =>
          save.mutate({ alertIntervalMinutes })
        }
        saving={save.isPending}
      />
    </div>
  );
}

function NumberSetting({
  label,
  suffix,
  value,
  step,
  min,
  max,
  title,
  onCommit,
  saving,
}: {
  label: string;
  suffix: string;
  value?: number;
  step: number;
  min: number;
  max: number;
  title: string;
  onCommit: (value: number) => void;
  saving: boolean;
}) {
  /**
   * Null except while somebody is typing.
   *
   * Derived rather than synced from the server value in an effect, which is
   * the same thing said in one fewer place: with no draft the field simply
   * shows what the server last said, so an answer arriving mid-edit cannot
   * overwrite what is being entered, and a save needs no reconciliation after
   * it lands.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value?.toString() ?? "";

  /** Committed on blur and on Enter, never per keystroke: each save is a write and an audit row. */
  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseFloat(draft);
    setDraft(null);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) return;
    if (parsed === value) return;
    onCommit(parsed);
  };

  return (
    <label className="flex items-center gap-1.5" title={title}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={shown}
        disabled={saving || value === undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(null);
        }}
        className="w-16 rounded border-gray-300 px-1 py-0.5 text-right text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
      />
      <span className="text-gray-500">{suffix}</span>
      {saving && <Loader2 className="h-3 w-3 animate-spin" />}
    </label>
  );
}
