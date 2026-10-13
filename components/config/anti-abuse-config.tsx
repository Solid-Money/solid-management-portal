"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Store,
  Tags,
  Trash2,
  UserCheck,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import {
  ConfigSection,
  InfoTooltip,
  InputField,
  ToggleField,
} from "@/components/config/config-fields";
import { Badge } from "@/components/ui/badge";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import {
  useCheckMerchantExclusion,
  usePreviewMerchantExclusion,
  useUpdateAntiAbuseConfig,
} from "@/hooks/use-anti-abuse";
import { formatDateTime, formatUsd } from "@/lib/utils";
import type {
  AntiAbuseConfig,
  MerchantCategoryExclusion,
  MerchantExclusionCheck,
  MerchantExclusionPreview,
  MerchantNameExclusion,
  ReferralSpendRuleSettings,
  UpdateAntiAbuseConfig,
} from "@/types";

/**
 * Config → Anti-abuse.
 *
 * Everything on the page is one draft, saved together: an operator adding
 * Tinaba to the merchant list and raising the per-shop minimum is making one
 * decision, and saving half of it would leave the rules in a state nobody
 * chose. The draft is an overlay — null until the first edit — so a refetch
 * while nobody is editing still shows the live values, and one mid-edit does
 * not throw the edit away.
 *
 * The backend re-validates every field; the checks here only spare the
 * operator a round trip for the obvious ones.
 */

interface Draft {
  cashbackEnabled: boolean;
  referralEnabled: boolean;
  categories: MerchantCategoryExclusion[];
  merchants: MerchantNameExclusion[];
  referralRules: ReferralSpendRuleSettings;
}

const toDraft = (config: AntiAbuseConfig): Draft => ({
  cashbackEnabled: config.merchantExclusions.cashbackEnabled,
  referralEnabled: config.merchantExclusions.referralEnabled,
  categories: config.merchantExclusions.categories.map((entry) => ({
    ...entry,
  })),
  merchants: config.merchantExclusions.merchants.map((entry) => ({
    ...entry,
  })),
  referralRules: { ...config.referralRules },
});

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** As the backend stores a pattern: lowercased, whitespace collapsed. */
const normalizePattern = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

/** Mirrors `merchantPatternProblem` in the backend, for an early, friendly answer. */
function patternProblem(pattern: string): string | null {
  const normalized = normalizePattern(pattern);
  const literal = normalized.replace(/\*/g, "").trim();
  if (!normalized) return "Enter part of the merchant name.";
  if (normalized.length > 100) return "Keep it under 100 characters.";
  if (literal.length < 3) {
    return 'Use at least 3 characters besides "*" — shorter would catch unrelated merchants.';
  }
  if (normalized.split("*").length - 1 > 4)
    return 'Use at most 4 "*" wildcards.';
  return null;
}

/** The backend's own reason for a refused request, when it gave one. */
function describeError(error: Error, fallback: string): string {
  const message = (
    error as Error & { response?: { data?: { message?: string | string[] } } }
  ).response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}

export function AntiAbuseConfigEditor({ config }: { config: AntiAbuseConfig }) {
  const update = useUpdateAntiAbuseConfig();
  const saved = useMemo(() => toDraft(config), [config]);
  const [edits, setEdits] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);

  const draft = edits ?? saved;
  const edit = (change: (current: Draft) => Draft) =>
    setEdits((current) => change(current ?? saved));

  const changes = useMemo(() => diff(saved, draft), [saved, draft]);
  const hasChanges = changes.payload !== null;

  const commit = () => {
    if (!changes.payload) return;
    update.mutate(changes.payload, {
      onSuccess: () => {
        setEdits(null);
        toast.success(
          "Anti-abuse settings saved. They apply within 5 minutes.",
        );
      },
    });
  };

  const save = () => {
    if (!hasChanges) {
      toast.info("Nothing to save.");
      return;
    }
    if (changes.risky.length > 0) {
      setConfirming(true);
      return;
    }
    commit();
  };

  return (
    <div className="space-y-6 pb-24">
      <ConfigSection
        title="Programme switches"
        description="Turn the merchant exclusions on or off for each programme"
        icon={<ShieldAlert className="h-5 w-5 text-red-600" />}
        defaultOpen
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SwitchCard
            title="Cashback exclusions"
            on={draft.cashbackEnabled}
            onChange={(value) =>
              edit((d) => ({ ...d, cashbackEnabled: value }))
            }
            description="Purchases at the merchants and categories below earn no card cashback — not regular, campaign or subscription cashback."
            offWarning="Off: every purchase earns cashback, including ATM withdrawals, money transfers and wallet top-ups."
          />
          <SwitchCard
            title="Referral exclusions"
            on={draft.referralEnabled}
            onChange={(value) =>
              edit((d) => ({ ...d, referralEnabled: value }))
            }
            description="Purchases at the merchants and categories below don't count toward a referred friend's spend target or merchant count."
            offWarning="Off: every purchase counts toward the referral target, including wallet top-ups and QR-code transfers."
          />
        </div>
      </ConfigSection>

      <ConfigSection
        title="Excluded merchants"
        description="Blocked by name, whatever category they arrive under"
        icon={<Store className="h-5 w-5 text-orange-600" />}
        defaultOpen
      >
        <MerchantList
          entries={draft.merchants}
          defaults={config.defaults.merchantExclusions.merchants}
          onChange={(merchants) => edit((d) => ({ ...d, merchants }))}
        />
      </ConfigSection>

      <ConfigSection
        title="Excluded merchant categories (MCC)"
        description="Cash, transfers, top-ups, gambling, government payments and other non-purchases"
        icon={<Tags className="h-5 w-5 text-amber-600" />}
        defaultOpen
      >
        <CategoryList
          entries={draft.categories}
          defaults={config.defaults.merchantExclusions.categories}
          onChange={(categories) => edit((d) => ({ ...d, categories }))}
        />
      </ConfigSection>

      <ConfigSection
        title="Referral qualification rules"
        description="What a referred friend's purchase must be to count toward the target"
        icon={<UserCheck className="h-5 w-5 text-pink-600" />}
        defaultOpen
      >
        <ReferralRulesEditor
          rules={draft.referralRules}
          defaults={config.defaults.referralRules}
          onChange={(referralRules) => edit((d) => ({ ...d, referralRules }))}
        />
      </ConfigSection>

      <ConfigSection
        title="Test a merchant"
        description="See whether a merchant earns cashback and counts for referrals — against your unsaved edits"
        icon={<Wand2 className="h-5 w-5 text-indigo-600" />}
      >
        <MerchantTester draft={draft} />
      </ConfigSection>

      {/* Save bar: sticky, so a long list never hides the button. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-gray-600">
            {hasChanges
              ? `${changes.summary.length} unsaved change${
                  changes.summary.length === 1 ? "" : "s"
                }: ${changes.summary.join(" · ")}`
              : config.lastUpdate
                ? `Last changed ${formatDateTime(config.lastUpdate.at)}${
                    config.lastUpdate.by ? ` by ${config.lastUpdate.by}` : ""
                  }`
                : "Using the shipped defaults"}
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {hasChanges ? (
              <button
                type="button"
                onClick={() => setEdits(null)}
                className="cursor-pointer text-sm text-gray-500 transition-colors hover:text-gray-700"
              >
                Discard changes
              </button>
            ) : null}
            <button
              type="button"
              onClick={save}
              disabled={update.isPending || !hasChanges}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {update.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              Save
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirming}
        title="Save these anti-abuse changes?"
        isDestructive
        confirmText="Save changes"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          commit();
        }}
        message={
          <div className="space-y-3 text-sm">
            <p>These changes let more purchases earn rewards:</p>
            <ul className="list-disc space-y-1 pl-5">
              {changes.risky.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-gray-500">
              They apply to every purchase from the next few minutes on, and to
              referral rewards not yet paid.
            </p>
          </div>
        }
      />
    </div>
  );
}

/**
 * What changed between the saved settings and the draft: the request to send
 * (only the parts that changed), a one-line summary per change, and the
 * changes that loosen the rules — those are confirmed before saving.
 */
function diff(
  saved: Draft,
  draft: Draft,
): {
  payload: UpdateAntiAbuseConfig | null;
  summary: string[];
  risky: string[];
} {
  const payload: UpdateAntiAbuseConfig = {};
  const summary: string[] = [];
  const risky: string[] = [];

  if (draft.cashbackEnabled !== saved.cashbackEnabled) {
    payload.cashbackEnabled = draft.cashbackEnabled;
    summary.push(`cashback exclusions ${draft.cashbackEnabled ? "on" : "off"}`);
    if (!draft.cashbackEnabled) {
      risky.push(
        "Cashback exclusions are switched off — every category earns cashback.",
      );
    }
  }
  if (draft.referralEnabled !== saved.referralEnabled) {
    payload.referralEnabled = draft.referralEnabled;
    summary.push(`referral exclusions ${draft.referralEnabled ? "on" : "off"}`);
    if (!draft.referralEnabled) {
      risky.push(
        "Referral exclusions are switched off — every purchase counts toward the target.",
      );
    }
  }

  const listChange = <T,>(
    before: T[],
    after: T[],
    key: (entry: T) => string,
    noun: string,
  ) => {
    if (same(before, after)) return false;
    const beforeKeys = new Set(before.map(key));
    const afterKeys = new Set(after.map(key));
    const added = after.filter((entry) => !beforeKeys.has(key(entry))).length;
    const removed = before.filter((entry) => !afterKeys.has(key(entry)));
    const parts = [
      added && `${added} added`,
      removed.length && `${removed.length} removed`,
      !added && !removed.length && "edited",
    ].filter(Boolean);
    summary.push(`${noun} ${parts.join(", ")}`);
    if (removed.length > 0) {
      risky.push(
        `${removed.length} ${noun} removed: ${removed.map(key).slice(0, 8).join(", ")}${
          removed.length > 8 ? "…" : ""
        }`,
      );
    }
    return true;
  };

  if (
    listChange(saved.merchants, draft.merchants, (m) => m.pattern, "merchants")
  ) {
    payload.merchants = draft.merchants;
    const loosened = draft.merchants.filter((entry) => {
      const before = saved.merchants.find((m) => m.pattern === entry.pattern);
      return (
        before &&
        ((before.cashback && !entry.cashback) ||
          (before.referral && !entry.referral))
      );
    });
    if (loosened.length > 0) {
      risky.push(
        `Merchants no longer excluded from a programme: ${loosened
          .map((m) => m.pattern)
          .join(", ")}`,
      );
    }
  }
  if (
    listChange(saved.categories, draft.categories, (c) => c.code, "categories")
  ) {
    payload.categories = draft.categories;
    const loosened = draft.categories.filter((entry) => {
      const before = saved.categories.find((c) => c.code === entry.code);
      return (
        before &&
        ((before.cashback && !entry.cashback) ||
          (before.referral && !entry.referral))
      );
    });
    if (loosened.length > 0) {
      risky.push(
        `Categories no longer excluded from a programme: ${loosened
          .map((c) => c.code)
          .join(", ")}`,
      );
    }
  }

  if (!same(saved.referralRules, draft.referralRules)) {
    const rules: Partial<ReferralSpendRuleSettings> = {};
    for (const field of Object.keys(draft.referralRules) as Array<
      keyof ReferralSpendRuleSettings
    >) {
      if (draft.referralRules[field] !== saved.referralRules[field]) {
        (rules as Record<string, unknown>)[field] = draft.referralRules[field];
      }
    }
    payload.referralRules = rules;
    summary.push("referral rules");
    if (
      saved.referralRules.activityCheckEnabled &&
      !draft.referralRules.activityCheckEnabled
    ) {
      risky.push(
        "Qualified referrals are paid even if the friend stops using the card.",
      );
    }
    if (
      draft.referralRules.minPurchaseUsd < saved.referralRules.minPurchaseUsd
    ) {
      risky.push(
        `Smaller purchases count: minimum ${formatUsd(saved.referralRules.minPurchaseUsd)} → ${formatUsd(
          draft.referralRules.minPurchaseUsd,
        )}.`,
      );
    }
    if (
      draft.referralRules.minMerchantSpendUsd <
      saved.referralRules.minMerchantSpendUsd
    ) {
      risky.push(
        `A shop counts with less spent: ${formatUsd(saved.referralRules.minMerchantSpendUsd)} → ${formatUsd(
          draft.referralRules.minMerchantSpendUsd,
        )}.`,
      );
    }
  }

  return {
    payload: summary.length > 0 ? payload : null,
    summary,
    risky,
  };
}

function SwitchCard({
  title,
  on,
  onChange,
  description,
  offWarning,
}: {
  title: string;
  on: boolean;
  onChange: (value: boolean) => void;
  description: string;
  offWarning: string;
}) {
  return (
    <div
      className={`space-y-2 rounded-lg border p-4 ${
        on ? "border-gray-200" : "border-red-200 bg-red-50"
      }`}
    >
      <ToggleField label={title} value={on} onChange={onChange} />
      <p className="text-sm text-gray-600">{description}</p>
      {!on && <p className="text-sm font-medium text-red-700">{offWarning}</p>}
    </div>
  );
}

/** A checkbox pair saying which programmes an entry applies to. */
function ProgrammeChecks({
  cashback,
  referral,
  onChange,
  label,
}: {
  cashback: boolean;
  referral: boolean;
  onChange: (next: { cashback: boolean; referral: boolean }) => void;
  label: string;
}) {
  return (
    <>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={cashback}
          onChange={(event) =>
            onChange({ cashback: event.target.checked, referral })
          }
          aria-label={`Exclude ${label} from cashback`}
          className="h-4 w-4 cursor-pointer accent-indigo-600"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={referral}
          onChange={(event) =>
            onChange({ cashback, referral: event.target.checked })
          }
          aria-label={`Exclude ${label} from referrals`}
          className="h-4 w-4 cursor-pointer accent-indigo-600"
        />
      </td>
    </>
  );
}

function ListToolbar({
  search,
  onSearch,
  count,
  differsFromDefaults,
  onRestoreDefaults,
  placeholder,
}: {
  search: string;
  onSearch: (value: string) => void;
  count: number;
  differsFromDefaults: boolean;
  onRestoreDefaults: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-full max-w-xs">
        <Search
          className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-300 py-1.5 pr-3 pl-8 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>{count} entries</span>
        {differsFromDefaults ? (
          <button
            type="button"
            onClick={onRestoreDefaults}
            className="inline-flex cursor-pointer items-center gap-1 text-indigo-600 hover:text-indigo-800"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Restore defaults
          </button>
        ) : (
          <Badge variant="muted">Shipped defaults</Badge>
        )}
      </div>
    </div>
  );
}

function MerchantList({
  entries,
  defaults,
  onChange,
}: {
  entries: MerchantNameExclusion[];
  defaults: MerchantNameExclusion[];
  onChange: (entries: MerchantNameExclusion[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [pattern, setPattern] = useState("");
  const [note, setNote] = useState("");
  const preview = usePreviewMerchantExclusion();

  const defaultPatterns = useMemo(
    () => new Set(defaults.map((entry) => entry.pattern)),
    [defaults],
  );
  const needle = search.trim().toLowerCase();
  const visible = entries.filter(
    (entry) =>
      !needle ||
      entry.pattern.includes(needle) ||
      entry.label?.toLowerCase().includes(needle),
  );

  const normalized = normalizePattern(pattern);
  const problem = pattern ? patternProblem(pattern) : null;
  const duplicate = entries.some((entry) => entry.pattern === normalized);

  const add = () => {
    const issue = patternProblem(pattern);
    if (issue) return toast.error(issue);
    if (duplicate)
      return toast.error(`"${normalized}" is already on the list.`);
    onChange([
      {
        pattern: normalized,
        ...(note.trim() && { label: note.trim() }),
        cashback: true,
        referral: true,
      },
      ...entries,
    ]);
    setPattern("");
    setNote("");
    preview.reset();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Matched against the merchant name on the card transaction, ignoring
        case. A pattern matches anywhere in the name, and{" "}
        <code className="rounded bg-gray-100 px-1">*</code> stands for any run
        of characters —{" "}
        <code className="rounded bg-gray-100 px-1">weixin*scan</code> matches
        &ldquo;WEIXIN*SCAN QR CODE&rdquo; and &ldquo;Weixin Scan QR&rdquo;.
        Preview a pattern before adding it to see what it would catch.
      </p>

      <div className="space-y-3 rounded-lg border border-dashed border-gray-300 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.4fr_auto_auto]">
          <input
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
            placeholder="e.g. moogold or weixin*scan"
            spellCheck={false}
            aria-label="Merchant name pattern"
            className="rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
            placeholder="Why (optional), e.g. game credit resold for cash"
            aria-label="Note"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() =>
              preview.mutate(
                { pattern: normalized },
                {
                  onError: (error) =>
                    toast.error(
                      describeError(error, "Could not preview the pattern."),
                    ),
                },
              )
            }
            disabled={!!problem || !pattern || preview.isPending}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {preview.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
            Preview matches
          </button>
          <button
            type="button"
            onClick={add}
            disabled={!pattern || !!problem || duplicate}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </button>
        </div>
        {problem ? (
          <p className="text-xs text-red-600">{problem}</p>
        ) : duplicate ? (
          <p className="text-xs text-amber-700">
            &ldquo;{normalized}&rdquo; is already on the list.
          </p>
        ) : null}
        {preview.data && <PreviewResult preview={preview.data} />}
      </div>

      <ListToolbar
        search={search}
        onSearch={setSearch}
        count={entries.length}
        differsFromDefaults={!same(entries, defaults)}
        onRestoreDefaults={() =>
          onChange(defaults.map((entry) => ({ ...entry })))
        }
        placeholder="Filter merchants"
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2">Pattern</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2 text-center">Cashback</th>
              <th className="px-3 py-2 text-center">Referrals</th>
              <th className="px-3 py-2" aria-label="Remove" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  {entries.length === 0
                    ? "No merchants are excluded by name."
                    : "No merchant matches the filter."}
                </td>
              </tr>
            ) : (
              visible.map((entry) => (
                <tr
                  key={entry.pattern}
                  className={
                    !entry.cashback && !entry.referral ? "opacity-50" : ""
                  }
                >
                  <td className="px-3 py-2 font-mono text-xs text-gray-900">
                    {entry.pattern}
                    {!defaultPatterns.has(entry.pattern) && (
                      <Badge variant="info" className="ml-2 font-sans">
                        Added
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={entry.label ?? ""}
                      onChange={(event) =>
                        onChange(
                          entries.map((e) =>
                            e.pattern === entry.pattern
                              ? { ...e, label: event.target.value || undefined }
                              : e,
                          ),
                        )
                      }
                      placeholder="Add a note"
                      aria-label={`Note for ${entry.pattern}`}
                      className="w-full min-w-48 rounded border border-transparent px-2 py-1 text-sm text-gray-700 hover:border-gray-200 focus:border-indigo-500 focus:outline-none"
                    />
                  </td>
                  <ProgrammeChecks
                    cashback={entry.cashback}
                    referral={entry.referral}
                    label={entry.pattern}
                    onChange={(next) =>
                      onChange(
                        entries.map((e) =>
                          e.pattern === entry.pattern ? { ...e, ...next } : e,
                        ),
                      )
                    }
                  />
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          entries.filter((e) => e.pattern !== entry.pattern),
                        )
                      }
                      aria-label={`Remove ${entry.pattern}`}
                      className="cursor-pointer rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryList({
  entries,
  defaults,
  onChange,
}: {
  entries: MerchantCategoryExclusion[];
  defaults: MerchantCategoryExclusion[];
  onChange: (entries: MerchantCategoryExclusion[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const preview = usePreviewMerchantExclusion();

  const defaultCodes = useMemo(
    () => new Set(defaults.map((entry) => entry.code)),
    [defaults],
  );
  const needle = search.trim().toLowerCase();
  const visible = entries
    .filter(
      (entry) =>
        !needle ||
        entry.code.includes(needle) ||
        entry.label.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.code.localeCompare(b.code));

  const trimmed = code.trim();
  const invalid = trimmed !== "" && !/^\d{4}$/.test(trimmed);
  const duplicate = entries.some((entry) => entry.code === trimmed);

  const add = () => {
    if (!/^\d{4}$/.test(trimmed)) return toast.error("An MCC is four digits.");
    if (duplicate) return toast.error(`MCC ${trimmed} is already on the list.`);
    onChange([
      {
        code: trimmed,
        label: label.trim() || `MCC ${trimmed}`,
        cashback: true,
        referral: true,
      },
      ...entries,
    ]);
    setCode("");
    setLabel("");
    preview.reset();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        The ISO 18245 merchant category code the card issuer sends with each
        purchase. A purchase with no code is treated as eligible here — the
        merchant list above still applies to it.
      </p>

      <div className="space-y-3 rounded-lg border border-dashed border-gray-300 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[8rem_1fr_auto_auto]">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
            placeholder="e.g. 6300"
            inputMode="numeric"
            maxLength={4}
            aria-label="Merchant category code"
            className="rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
            placeholder="Category name, e.g. Insurance"
            aria-label="Category name"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() =>
              preview.mutate(
                { merchantCategoryCode: trimmed },
                {
                  onError: (error) =>
                    toast.error(
                      describeError(error, "Could not preview the category."),
                    ),
                },
              )
            }
            disabled={!/^\d{4}$/.test(trimmed) || preview.isPending}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {preview.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
            Preview matches
          </button>
          <button
            type="button"
            onClick={add}
            disabled={!/^\d{4}$/.test(trimmed) || duplicate}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </button>
        </div>
        {invalid ? (
          <p className="text-xs text-red-600">An MCC is four digits.</p>
        ) : duplicate ? (
          <p className="text-xs text-amber-700">
            MCC {trimmed} is already on the list.
          </p>
        ) : null}
        {preview.data && <PreviewResult preview={preview.data} />}
      </div>

      <ListToolbar
        search={search}
        onSearch={setSearch}
        count={entries.length}
        differsFromDefaults={!same(entries, defaults)}
        onRestoreDefaults={() =>
          onChange(defaults.map((entry) => ({ ...entry })))
        }
        placeholder="Filter by code or name"
      />

      <div className="max-h-[32rem] overflow-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2">MCC</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-center">Cashback</th>
              <th className="px-3 py-2 text-center">Referrals</th>
              <th className="px-3 py-2" aria-label="Remove" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  {entries.length === 0
                    ? "No categories are excluded."
                    : "No category matches the filter."}
                </td>
              </tr>
            ) : (
              visible.map((entry) => (
                <tr
                  key={entry.code}
                  className={
                    !entry.cashback && !entry.referral ? "opacity-50" : ""
                  }
                >
                  <td className="px-3 py-2 font-mono text-xs text-gray-900">
                    {entry.code}
                    {!defaultCodes.has(entry.code) && (
                      <Badge variant="info" className="ml-2 font-sans">
                        Added
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{entry.label}</td>
                  <ProgrammeChecks
                    cashback={entry.cashback}
                    referral={entry.referral}
                    label={`MCC ${entry.code}`}
                    onChange={(next) =>
                      onChange(
                        entries.map((e) =>
                          e.code === entry.code ? { ...e, ...next } : e,
                        ),
                      )
                    }
                  />
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        onChange(entries.filter((e) => e.code !== entry.code))
                      }
                      aria-label={`Remove MCC ${entry.code}`}
                      className="cursor-pointer rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PreviewResult({ preview }: { preview: MerchantExclusionPreview }) {
  if (preview.transactions === 0) {
    return (
      <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
        No card purchases matched in the last {preview.days} days.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-md bg-amber-50 p-3 text-sm">
      <p className="text-amber-900">
        Would have matched <strong>{preview.transactions}</strong> purchases
        worth <strong>{formatUsd(preview.usd)}</strong> by{" "}
        <strong>{preview.customers}</strong> cardholders in the last{" "}
        {preview.days} days. Check that every merchant below should be blocked:
      </p>
      <ul className="max-h-48 space-y-0.5 overflow-auto">
        {preview.merchants.map((merchant) => (
          <li
            key={`${merchant.merchantName}-${merchant.merchantCategoryCode}`}
            className="flex justify-between gap-4 font-mono text-xs text-gray-800"
          >
            <span className="truncate">
              {merchant.merchantName || "(no name)"}
              {merchant.merchantCategoryCode && (
                <span className="text-gray-500">
                  {" "}
                  · {merchant.merchantCategoryCode}
                </span>
              )}
            </span>
            <span className="shrink-0 text-gray-600">
              {merchant.transactions} · {formatUsd(merchant.usd)}
            </span>
          </li>
        ))}
      </ul>
      {preview.truncated && (
        <p className="text-xs text-amber-800">
          Showing the largest {preview.merchants.length} merchants.
        </p>
      )}
    </div>
  );
}

function ReferralRulesEditor({
  rules,
  defaults,
  onChange,
}: {
  rules: ReferralSpendRuleSettings;
  defaults: ReferralSpendRuleSettings;
  onChange: (rules: ReferralSpendRuleSettings) => void;
}) {
  const setNumber = (field: keyof ReferralSpendRuleSettings, raw: string) => {
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) return;
    onChange({ ...rules, [field]: value });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Applies to the referral spend target (set under{" "}
        <Link
          href="/rewards-config"
          className="text-indigo-600 hover:text-indigo-800"
        >
          Rewards
        </Link>
        ) and to every reward not yet paid. Purchases are counted in the US
        dollars charged, never the merchant&apos;s local currency.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputField
          label="Smallest purchase that counts"
          type="number"
          min={0}
          step="0.5"
          suffix="USD"
          value={rules.minPurchaseUsd}
          onChange={(raw) => setNumber("minPurchaseUsd", raw)}
          tooltip={`Purchases under this count for nothing — neither spend nor shops. Stops strings of $0.15 transfers to "shops". Default ${formatUsd(defaults.minPurchaseUsd)}.`}
        />
        <InputField
          label="Spend needed at a shop for it to count"
          type="number"
          min={0}
          step="1"
          suffix="USD"
          value={rules.minMerchantSpendUsd}
          onChange={(raw) => setNumber("minMerchantSpendUsd", raw)}
          tooltip={`A shop counts toward the "different merchants" target only once the friend has spent this much there. Spend below it still counts toward the dollar target. Default ${formatUsd(defaults.minMerchantSpendUsd)}.`}
        />
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 p-4">
        <ToggleField
          label="Require a purchase after qualifying"
          value={rules.activityCheckEnabled}
          onChange={(value) =>
            onChange({ ...rules, activityCheckEnabled: value })
          }
          tooltip="Checked at payout: the friend must make one more eligible purchase between qualifying and the payout, or the reward is cancelled. A purchase still pending at payout is waited for."
        />
        <div className="max-w-xs">
          <InputField
            label="That purchase must be at least"
            type="number"
            min={0}
            step="1"
            suffix="USD"
            value={rules.activityMinPurchaseUsd}
            onChange={(raw) => setNumber("activityMinPurchaseUsd", raw)}
            disabled={!rules.activityCheckEnabled}
            tooltip={`Default ${formatUsd(defaults.activityMinPurchaseUsd)}.`}
          />
        </div>
        <p className="text-xs text-gray-500">
          The referral screen tells the referrer when a friend still needs to
          make this purchase, so they can nudge them before the payout.
        </p>
      </div>

      {!same(rules, defaults) && (
        <button
          type="button"
          onClick={() => onChange({ ...defaults })}
          className="inline-flex cursor-pointer items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Restore defaults
        </button>
      )}
    </div>
  );
}

function MerchantTester({ draft }: { draft: Draft }) {
  const [merchantName, setMerchantName] = useState("");
  const [merchantCategoryCode, setMerchantCategoryCode] = useState("");
  const check = useCheckMerchantExclusion();
  const [checked, setChecked] = useState<MerchantExclusionCheck | null>(null);

  const run = () => {
    if (!merchantName.trim() && !merchantCategoryCode.trim()) {
      toast.error("Enter a merchant name, an MCC, or both.");
      return;
    }
    check.mutate(
      {
        merchantName: merchantName.trim() || undefined,
        merchantCategoryCode: merchantCategoryCode.trim() || undefined,
        draft: {
          cashbackEnabled: draft.cashbackEnabled,
          referralEnabled: draft.referralEnabled,
          categories: draft.categories,
          merchants: draft.merchants,
        },
      },
      {
        onSuccess: setChecked,
        onError: (error) =>
          toast.error(describeError(error, "Could not check the merchant.")),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_8rem_auto]">
        <input
          value={merchantName}
          onChange={(event) => setMerchantName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && run()}
          placeholder="Merchant name as on the transaction, e.g. ALP*QRCode8035"
          aria-label="Merchant name"
          className="rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <input
          value={merchantCategoryCode}
          onChange={(event) => setMerchantCategoryCode(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && run()}
          placeholder="MCC"
          inputMode="numeric"
          maxLength={4}
          aria-label="Merchant category code"
          className="rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={run}
          disabled={check.isPending}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {check.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Wand2 className="h-4 w-4" aria-hidden />
          )}
          Check
        </button>
      </div>

      {checked && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Verdict programme="Card cashback" match={checked.cashback} />
          <Verdict programme="Referral target" match={checked.referral} />
        </div>
      )}
    </div>
  );
}

function Verdict({
  programme,
  match,
}: {
  programme: string;
  match: MerchantExclusionCheck["cashback"];
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        match ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {match ? (
          <Ban className="h-4 w-4 text-red-600" aria-hidden />
        ) : (
          <UserCheck className="h-4 w-4 text-emerald-600" aria-hidden />
        )}
        {programme}: {match ? "excluded" : "counts"}
        <InfoTooltip
          text={
            match
              ? "Matched by the rule named below."
              : "No rule matches, so this purchase earns and counts as usual."
          }
        />
      </div>
      {match && <p className="mt-1 text-gray-700">{match.description}</p>}
    </div>
  );
}
