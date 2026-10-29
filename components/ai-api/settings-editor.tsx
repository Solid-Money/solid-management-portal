"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAiApiSettings, useSaveAiApiSettings } from "@/hooks/use-ai-api";
import { fromPercentInput, toPercentInput } from "@/lib/cashback-percentage";
import type {
  AiApiModelConfig,
  AiApiSettings,
  AiApiSettingsPatch,
} from "@/types/ai-api";

interface ModelDraft {
  id: string;
  name: string;
  upstreamModel: string;
  input: string;
  output: string;
  cachedInput: string;
  cacheWrite: string;
  aliases: string;
  enabled: boolean;
}

interface TierDraft {
  tier: number;
  name: string;
  percent: string;
  capUsd: string;
}

interface Draft {
  enabled: boolean;
  tiers: TierDraft[];
  maxKeys: string;
  maxLimitUsd: string;
  chargeThresholdUsd: string;
  maxUnpaidUsd: string;
  balanceHeadroomUsd: string;
  models: ModelDraft[];
}

const priceText = (value?: number) => (value === undefined ? "" : String(value));

const toDraft = (settings: AiApiSettings): Draft => ({
  enabled: settings.enabled,
  tiers: settings.cashbackByTier.map((entry) => ({
    tier: entry.tier,
    name: entry.name,
    percent: toPercentInput(entry.rate),
    capUsd: String(entry.monthlyCapUsd),
  })),
  maxKeys: String(settings.maxKeysPerUser),
  maxLimitUsd: String(settings.maxMonthlyLimitUsd),
  chargeThresholdUsd: String(settings.chargeThresholdUsd),
  maxUnpaidUsd: String(settings.maxUnpaidUsd),
  balanceHeadroomUsd: String(settings.balanceHeadroomUsd),
  models: settings.models.map((model) => ({
    id: model.id,
    name: model.name,
    upstreamModel: model.upstreamModel,
    input: priceText(model.inputUsdPerMTok),
    output: priceText(model.outputUsdPerMTok),
    cachedInput: priceText(model.cachedInputUsdPerMTok),
    cacheWrite: priceText(model.cacheWriteUsdPerMTok),
    aliases: (model.aliases ?? []).join(", "),
    enabled: model.enabled,
  })),
});

const EMPTY_MODEL: ModelDraft = {
  id: "",
  name: "",
  upstreamModel: "",
  input: "",
  output: "",
  cachedInput: "",
  cacheWrite: "",
  aliases: "",
  enabled: true,
};

/** A dollar amount typed in, or NaN when it isn't one. */
const dollars = (text: string): number => (text.trim() === "" ? Number.NaN : Number(text));

const price = (text: string): number | null => {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
};

/** The draft as the API takes it, or the first thing wrong with it. */
function parseDraft(draft: Draft): { patch: AiApiSettingsPatch } | { error: string } {
  const cashbackByTier: NonNullable<AiApiSettingsPatch["cashbackByTier"]> = [];
  for (const row of draft.tiers) {
    const rate = fromPercentInput(row.percent);
    if (rate === undefined) {
      return { error: `${row.name}: cashback must be 0 to 100%.` };
    }
    const cap = Number(row.capUsd);
    if (row.capUsd.trim() === "" || !Number.isFinite(cap) || cap < 0) {
      return { error: `${row.name}: the monthly cap must be 0 or more (0 is no cap).` };
    }
    cashbackByTier.push({ tier: row.tier, rate, monthlyCapUsd: cap });
  }
  const maxKeys = Number(draft.maxKeys);
  if (!Number.isInteger(maxKeys) || maxKeys < 1 || maxKeys > 100) {
    return { error: "Keys per user must be a whole number from 1 to 100." };
  }
  const maxLimit = Number(draft.maxLimitUsd);
  if (!Number.isInteger(maxLimit) || maxLimit < 1 || maxLimit > 100_000) {
    return { error: "The highest monthly limit must be a whole number from 1 to 100,000." };
  }
  // The same bounds the backend holds them to.
  const chargeThreshold = dollars(draft.chargeThresholdUsd);
  if (Number.isNaN(chargeThreshold) || chargeThreshold < 1 || chargeThreshold > 100) {
    return { error: "Charge at must be $1 to $100: each charge is a transaction we pay gas for." };
  }
  const maxUnpaid = dollars(draft.maxUnpaidUsd);
  if (Number.isNaN(maxUnpaid) || maxUnpaid <= chargeThreshold || maxUnpaid > 1000) {
    return {
      error:
        "Most a user can owe must be more than Charge at, so users aren't stopped every time a charge is due, and at most $1,000.",
    };
  }
  const balanceHeadroom = dollars(draft.balanceHeadroomUsd);
  if (Number.isNaN(balanceHeadroom) || balanceHeadroom < 0 || balanceHeadroom > 100) {
    return { error: "Wallet headroom must be $0 to $100." };
  }

  const models: AiApiModelConfig[] = [];
  const ids = new Set<string>();
  for (const [index, row] of draft.models.entries()) {
    const label = row.id.trim() || `Row ${index + 1}`;
    const id = row.id.trim();
    if (!id || !row.name.trim() || !row.upstreamModel.trim()) {
      return { error: `${label}: model, name and gateway model are all required.` };
    }
    if (id.includes("@")) {
      return { error: `${label}: a model name can't pin a provider with "@".` };
    }
    const aliases = row.aliases
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean);
    for (const name of [id, ...aliases]) {
      const key = name.toLowerCase();
      if (ids.has(key)) return { error: `"${name}" is used by two models.` };
      ids.add(key);
    }
    const input = price(row.input);
    const output = price(row.output);
    const cachedInput = price(row.cachedInput);
    const cacheWrite = price(row.cacheWrite);
    if (input === null || output === null) {
      return { error: `${label}: input and output prices are required.` };
    }
    if ([input, output, cachedInput, cacheWrite].some((v) => Number.isNaN(v))) {
      return { error: `${label}: prices are dollars per million tokens, 0 or more.` };
    }
    models.push({
      id,
      name: row.name.trim(),
      upstreamModel: row.upstreamModel.trim(),
      inputUsdPerMTok: input,
      outputUsdPerMTok: output,
      ...(cachedInput !== null ? { cachedInputUsdPerMTok: cachedInput } : {}),
      ...(cacheWrite !== null ? { cacheWriteUsdPerMTok: cacheWrite } : {}),
      ...(aliases.length ? { aliases } : {}),
      enabled: row.enabled,
    });
  }

  return {
    patch: {
      enabled: draft.enabled,
      cashbackByTier,
      maxKeysPerUser: maxKeys,
      maxMonthlyLimitUsd: maxLimit,
      chargeThresholdUsd: chargeThreshold,
      maxUnpaidUsd: maxUnpaid,
      balanceHeadroomUsd: balanceHeadroom,
      models,
    },
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

/**
 * The AI API's settings: the kill switch, each tier's cashback, the limits
 * users choose within, and the models they can call with what each costs.
 *
 * Prices are what we charge, in dollars per million tokens; the gateway does
 * not report a cost per request, so usage is metered from these.
 */
export default function AiApiSettingsEditor() {
  const { data, isLoading } = useAiApiSettings();
  const save = useSaveAiApiSettings();
  // Null until the admin changes something, so the form shows what is saved —
  // including a save someone else made — until there are edits to keep.
  const [edits, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);

  const saved = data?.data;
  const draft = edits ?? (saved ? toDraft(saved) : null);
  const parsed = draft ? parseDraft(draft) : null;
  const isDirty =
    !!edits && !!saved && JSON.stringify(edits) !== JSON.stringify(toDraft(saved));

  if (isLoading || !draft || !saved) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const disabled = !data?.canEdit || save.isPending;
  const error = parsed && "error" in parsed ? parsed.error : null;
  const turningOff = saved.enabled && !draft.enabled;

  const updateTier = (index: number, patch: Partial<TierDraft>) =>
    setDraft({
      ...draft,
      tiers: draft.tiers.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });

  const updateModel = (index: number, patch: Partial<ModelDraft>) =>
    setDraft({
      ...draft,
      models: draft.models.map((model, i) =>
        i === index ? { ...model, ...patch } : model,
      ),
    });

  const handleSave = async () => {
    setConfirming(false);
    if (!parsed || "error" in parsed) return;
    try {
      await save.mutateAsync(parsed.patch);
      setDraft(null);
      toast.success("AI API settings saved", {
        description: "The app and the gateway pick them up within 5 minutes.",
      });
    } catch {
      // The API layer shows the server's reason; the draft stays to fix.
    }
  };

  return (
    <div className="space-y-6">
      {!data?.canEdit ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You can view these settings but not change them. Editing is limited
          to the admins in AI_API_ADMIN_EMAILS.
        </div>
      ) : null}

      <div className="grid gap-3 rounded-md border border-gray-200 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-gray-500">Gateway</div>
          <div className="truncate font-medium text-gray-900" title={saved.upstreamBaseUrl}>
            {saved.upstreamBaseUrl}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Gateway key</div>
          <Badge variant={saved.upstreamConfigured ? "success" : "danger"}>
            {saved.upstreamConfigured ? "Configured" : "Missing"}
          </Badge>
        </div>
        <div>
          <div className="text-gray-500">Base URL users see</div>
          <div className="truncate font-medium text-gray-900">
            {saved.publicBaseUrl ?? "The API host (/accounts/v1/ai)"}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Who can use it</div>
          <div className="font-medium text-gray-900">
            {saved.cohortOnly
              ? "Internal team members given AI API"
              : "Everyone (AI_API_COHORT_ONLY is false here)"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-gray-900">AI API on</div>
          <div className="text-xs text-gray-500">
            Off refuses every key&apos;s requests at once and stops new keys.
            Usage already made is still charged.
          </div>
        </div>
        <Switch
          aria-label="AI API on"
          checked={draft.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
        />
      </div>

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Cashback by tier</h3>
          <p className="text-xs text-gray-500">
            Of what each charge takes, at the tier the user is in when it is
            charged. The cap is per user per calendar month; 0 is no cap.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {draft.tiers.map((row, index) => (
            <div key={row.tier} className="grid gap-3 rounded-md border border-gray-200 p-3">
              <div className="text-sm font-medium text-gray-900">{row.name}</div>
              <Field label="Cashback (%)">
                <Input
                  aria-label={`${row.name} cashback (%)`}
                  inputMode="decimal"
                  value={row.percent}
                  disabled={disabled}
                  onChange={(e) => updateTier(index, { percent: e.target.value })}
                />
              </Field>
              <Field label="Cap per month (USD)">
                <Input
                  aria-label={`${row.name} cashback cap per month (USD)`}
                  inputMode="decimal"
                  value={row.capUsd}
                  disabled={disabled}
                  onChange={(e) => updateTier(index, { capUsd: e.target.value })}
                />
              </Field>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Keys per user">
          <Input
            inputMode="numeric"
            value={draft.maxKeys}
            disabled={disabled}
            onChange={(e) => setDraft({ ...draft, maxKeys: e.target.value })}
          />
        </Field>
        <Field
          label="Highest monthly limit (USD)"
          hint="Per key. The mandate users sign covers every key's limit."
        >
          <Input
            inputMode="numeric"
            value={draft.maxLimitUsd}
            disabled={disabled}
            onChange={(e) => setDraft({ ...draft, maxLimitUsd: e.target.value })}
          />
        </Field>
      </div>

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Pay as you go</h3>
          <p className="text-xs text-gray-500">
            We pay the gateway as requests run and take it from the user&apos;s
            Wallet after, so what a user has used but not yet been charged for is
            ours to lose if they empty their Wallet first. These set how much
            that can be.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Charge at (USD)"
            hint="A user's usage is charged once it reaches this, and whatever is left at each day's close. Each charge is a transaction we pay gas for."
          >
            <Input
              inputMode="decimal"
              value={draft.chargeThresholdUsd}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, chargeThresholdUsd: e.target.value })}
            />
          </Field>
          <Field
            label="Most a user can owe (USD)"
            hint="Requests stop until a charge clears: the most we can lose to one user when charging can't keep up."
          >
            <Input
              inputMode="decimal"
              value={draft.maxUnpaidUsd}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, maxUnpaidUsd: e.target.value })}
            />
          </Field>
          <Field
            label="Wallet headroom (USD)"
            hint="What the Wallet must hold beyond what the user owes for a request to run."
          >
            <Input
              inputMode="decimal"
              value={draft.balanceHeadroomUsd}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, balanceHeadroomUsd: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Models</h3>
            <p className="text-xs text-gray-500">
              Only these can be called. Prices are what users pay, in USD per
              million tokens. Cached and cache-write prices fall back to the
              input price when empty.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              setDraft({ ...draft, models: [...draft.models, { ...EMPTY_MODEL }] })
            }
            className="cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add model
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">On</th>
                <th className="px-3 py-2">Model (what users send)</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Gateway model</th>
                <th className="px-3 py-2">Input</th>
                <th className="px-3 py-2">Output</th>
                <th className="px-3 py-2">Cached in</th>
                <th className="px-3 py-2">Cache write</th>
                <th className="px-3 py-2">Aliases</th>
                <th className="px-3 py-2" aria-label="Remove" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {draft.models.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-gray-500">
                    No models yet. Users can create keys, but every request is
                    refused until a model is added.
                  </td>
                </tr>
              ) : null}
              {draft.models.map((model, index) => (
                <tr key={index}>
                  <td className="px-3 py-2">
                    <Switch
                      aria-label={`${model.id || "Model"} on`}
                      checked={model.enabled}
                      disabled={disabled}
                      onCheckedChange={(enabled) => updateModel(index, { enabled })}
                    />
                  </td>
                  {(
                    [
                      ["id", "kimi-k2.6", "w-40"],
                      ["name", "Kimi K2.6", "w-36"],
                      ["upstreamModel", "kimi-k2.6", "w-40"],
                      ["input", "0.60", "w-20"],
                      ["output", "2.50", "w-20"],
                      ["cachedInput", "", "w-20"],
                      ["cacheWrite", "", "w-20"],
                      ["aliases", "kimi", "w-36"],
                    ] as const
                  ).map(([field, placeholder, width]) => (
                    <td key={field} className="px-3 py-2">
                      <Input
                        className={width}
                        value={model[field]}
                        placeholder={placeholder}
                        disabled={disabled}
                        inputMode={
                          ["input", "output", "cachedInput", "cacheWrite"].includes(field)
                            ? "decimal"
                            : undefined
                        }
                        onChange={(e) => updateModel(index, { [field]: e.target.value })}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      aria-label={`Remove ${model.id || "model"}`}
                      disabled={disabled}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          models: draft.models.filter((_, i) => i !== index),
                        })
                      }
                      className="cursor-pointer text-gray-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isDirty ? (
        <div className="flex items-center justify-between gap-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
          <span className={`text-sm ${error ? "text-red-600" : "text-gray-700"}`}>
            {error ?? "Unsaved changes"}
          </span>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDraft(null)}
              disabled={save.isPending}
              className="cursor-pointer"
            >
              Discard
            </Button>
            <Button
              onClick={() => setConfirming(true)}
              disabled={disabled || !!error}
              className="cursor-pointer"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save settings
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={confirming}
        title={turningOff ? "Turn the AI API off?" : "Save AI API settings?"}
        message={
          turningOff
            ? "Every user's keys stop working within 5 minutes and no new keys can be made. Usage already made is still charged and its cashback still paid."
            : "New prices apply to requests made after the change. What has already been used keeps the price it was metered at."
        }
        confirmText={turningOff ? "Turn off" : "Save"}
        isDestructive={turningOff}
        onConfirm={handleSave}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
