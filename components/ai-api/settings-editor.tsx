"use client";

import { useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AntseedModelPicker,
  type AntseedPick,
} from "@/components/ai-api/antseed-model-picker";
import { ModelLogoInput } from "@/components/ai-api/model-logo-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useAiApiSettings,
  useAiApiUpstreamModels,
  useSaveAiApiSettings,
} from "@/hooks/use-ai-api";
import { antseedOfferFor, formatRate, priceMultiple } from "@/lib/ai-api";
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
  provider: string;
  logoUrl: string;
  officialInput: string;
  officialOutput: string;
  enabled: boolean;
}

/** The text fields of a model row. */
type ModelTextField = Exclude<keyof ModelDraft, "enabled" | "logoUrl" | "upstreamModel">;

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
    provider: model.provider ?? "",
    logoUrl: model.logoUrl ?? "",
    officialInput: priceText(model.officialInputUsdPerMTok),
    officialOutput: priceText(model.officialOutputUsdPerMTok),
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
  provider: "",
  logoUrl: "",
  officialInput: "",
  officialOutput: "",
  enabled: true,
};

/** A dollar amount typed in, or NaN when it isn't one. */
const dollars = (text: string): number => (text.trim() === "" ? Number.NaN : Number(text));

const price = (text: string): number | null => {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
};

/**
 * The draft as the API takes it, or the first thing wrong with it.
 *
 * Every field is checked, but only what changed from `base` — the settings as
 * they stood when editing began — is sent, so a save never writes back older
 * values over what another admin saved since for fields this one left alone.
 */
function parseDraft(
  draft: Draft,
  base: Draft,
): { patch: AiApiSettingsPatch } | { error: string } {
  const changed = <K extends keyof Draft>(key: K) =>
    JSON.stringify(draft[key]) !== JSON.stringify(base[key]);
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
    const before = base.tiers.find((entry) => entry.tier === row.tier);
    if (JSON.stringify(row) !== JSON.stringify(before)) {
      cashbackByTier.push({ tier: row.tier, rate, monthlyCapUsd: cap });
    }
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
    const officialInput = price(row.officialInput);
    const officialOutput = price(row.officialOutput);
    if (Number.isNaN(officialInput) || Number.isNaN(officialOutput)) {
      return { error: `${label}: official prices are dollars per million tokens, 0 or more.` };
    }
    const provider = row.provider.trim();
    if (provider.length > 40) {
      return { error: `${label}: the provider can be 40 characters at most.` };
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
      ...(provider ? { provider } : {}),
      ...(row.logoUrl ? { logoUrl: row.logoUrl } : {}),
      ...(officialInput !== null ? { officialInputUsdPerMTok: officialInput } : {}),
      ...(officialOutput !== null ? { officialOutputUsdPerMTok: officialOutput } : {}),
      enabled: row.enabled,
    });
  }

  return {
    patch: {
      ...(changed("enabled") ? { enabled: draft.enabled } : {}),
      ...(cashbackByTier.length ? { cashbackByTier } : {}),
      ...(changed("maxKeys") ? { maxKeysPerUser: maxKeys } : {}),
      ...(changed("maxLimitUsd") ? { maxMonthlyLimitUsd: maxLimit } : {}),
      ...(changed("chargeThresholdUsd") ? { chargeThresholdUsd: chargeThreshold } : {}),
      ...(changed("maxUnpaidUsd") ? { maxUnpaidUsd: maxUnpaid } : {}),
      ...(changed("balanceHeadroomUsd") ? { balanceHeadroomUsd: balanceHeadroom } : {}),
      // The table is saved whole: two admins editing it at once is still last
      // save wins, but an edit elsewhere no longer replaces it.
      ...(changed("models") ? { models } : {}),
    },
  };
}

/** The models on in `base` that the draft removes or switches off. */
const modelsTurnedOff = (draft: Draft, base: Draft): string[] => {
  const stillOn = new Set(
    draft.models.filter((model) => model.enabled).map((model) => model.id.trim()),
  );
  return base.models
    .filter((model) => model.enabled && !stillOn.has(model.id.trim()))
    .map((model) => model.id.trim());
};

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
  const { data, isLoading, isError, refetch } = useAiApiSettings();
  const save = useSaveAiApiSettings();
  // Null until the admin changes something, so the form shows what is saved —
  // including a save someone else made — until there are edits to keep.
  const [edits, setEdits] = useState<Draft | null>(null);
  // What was saved when editing began: a save sends only what differs from it.
  const [editBase, setEditBase] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  // The row the AntSeed picker fills, while it is open.
  const [pickingRow, setPickingRow] = useState<number | null>(null);
  // AntSeed's rates beside each row's prices, once asked for: it is a call to
  // the gateway, so the page doesn't make it on every visit.
  const [showRates, setShowRates] = useState(false);
  const catalog = useAiApiUpstreamModels(showRates);

  const saved = data?.data;
  const draft = edits ?? (saved ? toDraft(saved) : null);
  const base = editBase ?? (saved ? toDraft(saved) : null);
  const parsed = draft && base ? parseDraft(draft, base) : null;
  const isDirty = !!edits && !!base && JSON.stringify(edits) !== JSON.stringify(base);

  const setDraft = (next: Draft | null) => {
    if (next && !edits && saved) setEditBase(toDraft(saved));
    if (!next) setEditBase(null);
    setEdits(next);
  };

  if (isError && !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-sm text-gray-600">
        <p>Could not load the AI API settings.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (isLoading || !draft || !base || !saved) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const disabled = !data?.canEdit || save.isPending;
  const error = parsed && "error" in parsed ? parsed.error : null;
  const turningOff = saved.enabled && !draft.enabled;
  const modelsOff = modelsTurnedOff(draft, base);

  const updateTier = (index: number, patch: Partial<TierDraft>) =>
    setDraft({
      ...draft,
      tiers: draft.tiers.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });

  const updateModel = (index: number, patch: Partial<ModelDraft>) =>
    setDraft({
      ...draft,
      models: draft.models.map((model, i) => {
        if (i !== index) return model;
        const next = { ...model, ...patch };
        // A provider another row already has a logo for brings that logo, so
        // each provider's logo is uploaded once.
        if (patch.provider !== undefined && !next.logoUrl) {
          const provider = next.provider.trim().toLowerCase();
          next.logoUrl =
            draft.models.find(
              (other, j) =>
                j !== index &&
                other.logoUrl &&
                provider &&
                other.provider.trim().toLowerCase() === provider,
            )?.logoUrl ?? "";
        }
        return next;
      }),
    });

  /** Fill a row from the AntSeed picker: its gateway model, its id and name if blank, its prices if asked. */
  const applyPick = (index: number, pick: AntseedPick) => {
    const row = draft.models[index];
    if (!row) return;
    updateModel(index, {
      upstreamModel: pick.upstreamModel,
      ...(row.id.trim() ? {} : { id: pick.id }),
      ...(row.name.trim() ? {} : { name: pick.name }),
      ...(pick.prices ?? {}),
    });
  };

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Models</h3>
            <p className="text-xs text-gray-500">
              Only these can be called. Prices are what users pay, in USD per
              million tokens. Cached and cache-write prices fall back to the
              input price when empty. Provider, logo and official prices are
              what the app&apos;s price list shows; official prices give the
              &ldquo;vs official price&rdquo; discount.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRates((shown) => !shown)}
              className="cursor-pointer"
            >
              {showRates && catalog.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              {showRates ? "Hide AntSeed rates" : "Show AntSeed rates"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                setDraft({
                  ...draft,
                  models: [...draft.models, { ...EMPTY_MODEL }],
                });
                setPickingRow(draft.models.length);
              }}
              className="cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add from AntSeed
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                setDraft({
                  ...draft,
                  models: [...draft.models, { ...EMPTY_MODEL }],
                })
              }
              className="cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add model
            </Button>
          </div>
        </div>

        {showRates && catalog.isError ? (
          <p className="text-xs text-red-600">
            Couldn&apos;t load AntSeed&apos;s models from the gateway.
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">On</th>
                <th className="px-3 py-2">Logo</th>
                <th className="px-3 py-2">Model (what users send)</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Gateway model</th>
                <th className="px-3 py-2">Input</th>
                <th className="px-3 py-2">Output</th>
                <th className="px-3 py-2">Cached in</th>
                <th className="px-3 py-2">Cache write</th>
                <th className="px-3 py-2">Official in</th>
                <th className="px-3 py-2">Official out</th>
                <th className="px-3 py-2">Aliases</th>
                <th className="px-3 py-2" aria-label="Remove" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {draft.models.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    No models yet. Users can create keys, but every request is
                    refused until a model is added.
                  </td>
                </tr>
              ) : null}
              {draft.models.map((model, index) => {
                const offer =
                  showRates && catalog.data
                    ? antseedOfferFor(catalog.data.models, model.upstreamModel)
                    : null;
                const rateHint = (
                  price: string,
                  rate: number | null | undefined,
                ) =>
                  offer && rate !== null && rate !== undefined ? (
                    <span className="mt-1 block whitespace-nowrap text-[11px] text-gray-500">
                      AntSeed {formatRate(rate)}
                      {priceMultiple(price, rate)
                        ? ` · ${priceMultiple(price, rate)}`
                        : ""}
                    </span>
                  ) : null;
                const field = (
                  key: ModelTextField,
                  placeholder: string,
                  width: string,
                  hint?: React.ReactNode,
                ) => (
                  <td className="px-3 py-2 align-top">
                    <Input
                      className={width}
                      value={model[key]}
                      placeholder={placeholder}
                      disabled={disabled}
                      inputMode={
                        ["id", "name", "provider", "aliases"].includes(key)
                          ? undefined
                          : "decimal"
                      }
                      onChange={(e) =>
                        updateModel(index, { [key]: e.target.value })
                      }
                    />
                    {hint}
                  </td>
                );
                return (
                  <tr key={index}>
                    <td className="px-3 py-2 align-top pt-4">
                      <Switch
                        aria-label={`${model.id || "Model"} on`}
                        checked={model.enabled}
                        disabled={disabled}
                        onCheckedChange={(enabled) =>
                          updateModel(index, { enabled })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <ModelLogoInput
                        value={model.logoUrl}
                        name={model.provider || model.name || model.id}
                        disabled={disabled}
                        onChange={(logoUrl) => updateModel(index, { logoUrl })}
                      />
                    </td>
                    {field("id", "claude-opus-5-5", "w-40")}
                    {field("name", "Claude Opus 5.5", "w-36")}
                    {field("provider", "Anthropic", "w-28")}
                    <td className="px-3 py-2 align-top">
                      <div className="flex gap-1.5">
                        <Input
                          className="w-44"
                          value={model.upstreamModel}
                          placeholder="claude-opus-5-5"
                          disabled={disabled}
                          onChange={(e) =>
                            updateModel(index, {
                              upstreamModel: e.target.value,
                            })
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => setPickingRow(index)}
                          className="h-9 cursor-pointer px-2 text-xs"
                          title="Pick the gateway model and prices from AntSeed"
                        >
                          AntSeed
                        </Button>
                      </div>
                      {showRates &&
                      catalog.data &&
                      model.upstreamModel.trim() &&
                      !offer ? (
                        <span className="mt-1 block text-[11px] text-amber-700">
                          Not listed on AntSeed right now
                        </span>
                      ) : null}
                    </td>
                    {field(
                      "input",
                      "0.40",
                      "w-20",
                      rateHint(model.input, offer?.inputUsdPerMTok),
                    )}
                    {field(
                      "output",
                      "2.40",
                      "w-20",
                      rateHint(model.output, offer?.outputUsdPerMTok),
                    )}
                    {field(
                      "cachedInput",
                      "",
                      "w-20",
                      rateHint(model.cachedInput, offer?.cachedInputUsdPerMTok),
                    )}
                    {field("cacheWrite", "", "w-20")}
                    {field("officialInput", "15", "w-20")}
                    {field("officialOutput", "75", "w-20")}
                    {field("aliases", "claude-opus-5", "w-36")}
                    <td className="px-3 py-2 align-top pt-4">
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AntseedModelPicker
        open={pickingRow !== null}
        onOpenChange={(open) => {
          if (!open) setPickingRow(null);
        }}
        onPick={(pick) => {
          if (pickingRow !== null) applyPick(pickingRow, pick);
        }}
      />

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
            : `${
                modelsOff.length
                  ? `Requests for ${modelsOff.join(", ")} are refused within 5 minutes. `
                  : ""
              }New prices apply to requests made after the change. What has already been used keeps the price it was metered at.`
        }
        confirmText={turningOff ? "Turn off" : "Save"}
        isDestructive={turningOff || modelsOff.length > 0}
        onConfirm={handleSave}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
