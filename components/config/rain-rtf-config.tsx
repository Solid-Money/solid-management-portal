"use client";

import { useState } from "react";
import { Loader2, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import ConfirmationModal from "@/components/ui/confirmation-modal";
import { InfoTooltip } from "@/components/config/config-fields";
import { useUpdateRainRtfConfig } from "@/hooks/use-general-config";
import type {
  RainRtfConfig,
  RainRtfSetting,
  RainRtfSettingSource,
  UpdateRainRtfConfig,
} from "@/types";

const SETTING = {
  ENABLED: "RAIN_RTF_ENABLED",
  APPROVE_OPERATOR: "RAIN_RTF_APPROVE_OPERATOR",
  CHAIN_IDS: "RAIN_RTF_CHAIN_IDS",
  OPERATOR_SANDBOX: "RAIN_RTF_OPERATOR_SANDBOX",
  OPERATOR_PRODUCTION: "RAIN_RTF_OPERATOR_PRODUCTION",
  TERMS_URL: "RAIN_RTF_TERMS_URL",
} as const;

/** The switches, and the text fields, in the order they are shown. */
type SwitchField = "enabled" | "approveOperator";
type TextField =
  | "chainIds"
  | "operatorSandbox"
  | "operatorProduction"
  | "termsUrl";

type RowSpec =
  | { name: string; kind: "switch"; field: SwitchField }
  | { name: string; kind: "text"; field: TextField; placeholder: string };

const ROWS: RowSpec[] = [
  { name: SETTING.ENABLED, kind: "switch", field: "enabled" },
  { name: SETTING.APPROVE_OPERATOR, kind: "switch", field: "approveOperator" },
  {
    name: SETTING.CHAIN_IDS,
    kind: "text",
    field: "chainIds",
    placeholder: "Every chain Rain supports",
  },
  {
    name: SETTING.OPERATOR_SANDBOX,
    kind: "text",
    field: "operatorSandbox",
    placeholder: "0x…",
  },
  {
    name: SETTING.OPERATOR_PRODUCTION,
    kind: "text",
    field: "operatorProduction",
    placeholder: "0x…",
  },
  {
    name: SETTING.TERMS_URL,
    kind: "text",
    field: "termsUrl",
    placeholder: "https://…",
  },
];

const SOURCE_LABEL: Record<RainRtfSettingSource, string> = {
  database: "Dashboard",
  environment: "Environment",
  default: "Default",
};

const SOURCE_STYLE: Record<RainRtfSettingSource, string> = {
  database: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  environment: "bg-amber-50 text-amber-800 ring-amber-200",
  default: "bg-gray-100 text-gray-600 ring-gray-200",
};

/**
 * Which layer this value came from.
 *
 * Worth the pixels because the commonest mistake with layered config is
 * editing the layer that is being overridden — the change saves, the badge
 * still says Environment, and nothing happens.
 */
function SourceBadge({ setting }: { setting: RainRtfSetting }) {
  const hint =
    setting.source === "database"
      ? "Set here. Clear it to fall back to the deployment's environment."
      : setting.source === "environment"
        ? "Supplied by this deployment's environment. Setting it here overrides that."
        : "Nothing has set this; the published default applies.";

  return (
    <span
      title={hint}
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${SOURCE_STYLE[setting.source]}`}
    >
      {SOURCE_LABEL[setting.source]}
    </span>
  );
}

/** The layers this value is not currently taking, so the fallback is visible. */
function FallbackNote({ setting }: { setting: RainRtfSetting }) {
  if (setting.source !== "database") return null;
  const fallback = setting.environment ?? setting.publishedDefault;
  if (!fallback) return null;

  return (
    <p className="mt-1 text-xs text-gray-400">
      Clearing this falls back to{" "}
      <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-600">
        {fallback}
      </code>{" "}
      ({setting.environment ? "environment" : "default"}).
    </p>
  );
}

interface RainRtfConfigProps {
  config: RainRtfConfig;
}

/**
 * Rain Real-Time Funding's operational switches.
 *
 * RTF makes a card authorization pull its amount out of the cardholder's own
 * wallet at the moment of the swipe, on an ERC-20 allowance granted ahead of
 * time. These settings shipped as env vars read from Helm; they are editable
 * here so the kill-switch does not wait on a release, and each row says which
 * layer the value in force actually came from.
 */
export function RainRtfConfigSection({ config }: RainRtfConfigProps) {
  const update = useUpdateRainRtfConfig();
  const [edits, setEdits] = useState<UpdateRainRtfConfig>({});
  const [tokenEdits, setTokenEdits] = useState<Record<number, string>>({});
  const [confirmingEnable, setConfirmingEnable] = useState(false);

  const settingFor = (name: string): RainRtfSetting | undefined =>
    config.settings.find((setting) => setting.name === name);

  const savedBool = (name: string): boolean =>
    settingFor(name)?.effective === "true";

  const savedText = (name: string): string =>
    settingFor(name)?.stored ?? "";

  const boolValue = (
    name: string,
    field: "enabled" | "approveOperator",
  ): boolean => {
    const edited = edits[field];
    if (edited === null) {
      // Pending reset: show what the environment will give back.
      const setting = settingFor(name);
      return (setting?.environment ?? setting?.publishedDefault) === "true";
    }
    return edited ?? savedBool(name);
  };

  const textValue = (
    name: string,
    field: "chainIds" | "operatorSandbox" | "operatorProduction" | "termsUrl",
  ): string => edits[field] ?? savedText(name);

  const tokenValue = (chainId: number): string =>
    tokenEdits[chainId] ??
    config.tokenOverrides.find((entry) => entry.chainId === chainId)?.tokens ??
    "";

  const hasChanges =
    Object.keys(edits).length > 0 || Object.keys(tokenEdits).length > 0;

  const buildPayload = (): UpdateRainRtfConfig => {
    const payload: UpdateRainRtfConfig = { ...edits };

    if (Object.keys(tokenEdits).length > 0) {
      // The whole set, not just the edited chains: the backend stores one JSON
      // object, so sending a subset would drop every override not mentioned.
      payload.tokenOverrides = config.chains.map((chain) => ({
        chainId: chain.chainId,
        tokens: tokenValue(chain.chainId).trim(),
      }));
    }

    return payload;
  };

  const commit = () => {
    update.mutate(buildPayload(), {
      onSuccess: () => {
        // Dropped so every input reads back from the server's own answer.
        // What was typed and what is now in force routinely differ: a cleared
        // field falls back to the environment rather than to blank.
        setEdits({});
        setTokenEdits({});
        toast.success("Real-Time Funding settings saved.");
      },
      onError: (error) => toast.error(describeError(error)),
    });
  };

  const save = () => {
    if (!hasChanges) {
      toast.info("Nothing to save.");
      return;
    }

    // Turning RTF on is the one change here that reaches cardholders directly,
    // and it is not reversible for anyone who approves in the meantime: they
    // will have granted an unlimited allowance. Worth a second look.
    const turningOn =
      edits.enabled === true && !savedBool(SETTING.ENABLED);
    if (turningOn) {
      setConfirmingEnable(true);
      return;
    }

    commit();
  };

  const reset = (field: keyof UpdateRainRtfConfig, isSwitch: boolean) => {
    setEdits((prev) => ({
      ...prev,
      // null for a switch, "" for a text field — both mean "clear the stored
      // value and fall back to the environment".
      [field]: isSwitch ? null : "",
    }));
  };

  // A row per setting the server actually returned. Skipping an unknown name
  // rather than asserting one exists means a backend that adds or drops a
  // setting degrades to a missing row instead of a blank page.
  const rows = ROWS.flatMap((spec) => {
    const setting = settingFor(spec.name);
    return setting ? [{ spec, setting }] : [];
  });

  return (
    <div className="space-y-6">
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
                        onClick={() =>
                          setEdits((prev) => ({ ...prev, [spec.field]: !on }))
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
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
                    type="text"
                    aria-label={setting.label}
                    value={textValue(setting.name, spec.field)}
                    onChange={(event) =>
                      setEdits((prev) => ({
                        ...prev,
                        [spec.field]: event.target.value,
                      }))
                    }
                    placeholder={
                      setting.environment ??
                      setting.publishedDefault ??
                      spec.placeholder
                    }
                    spellCheck={false}
                    className="w-72 rounded border border-gray-300 px-2 py-1.5 font-mono text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                )}

                {setting.source === "database" ? (
                  <button
                    type="button"
                    title="Clear this and fall back to the environment"
                    onClick={() => reset(spec.field, spec.kind === "switch")}
                    className="cursor-pointer rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : (
                  <span className="w-[30px]" />
                )}
              </div>
            </div>

            {spec.kind === "text" && setting.effective ? (
              <p className="mt-2 text-xs text-gray-400">
                In force:{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-600">
                  {setting.effective}
                </code>
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div>
        <h3 className="flex items-center text-sm font-semibold text-gray-900">
          Chains and assets
          <InfoTooltip text="An ERC-20 allowance is scoped to one token, one spender, one chain — so the number of approvals a cardholder owes is assets x spenders, per chain. This is the registry as it resolves right now, overrides applied." />
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Override a chain&apos;s assets as{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5">
            symbol:address:decimals
          </code>
          , comma-separated. Leave a row empty to use what Rain publishes.
          Decimals may be omitted and default to 6.
        </p>

        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Chain</th>
                <th className="px-4 py-2 font-medium">In force</th>
                <th className="px-4 py-2 font-medium">Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {config.chains.map((chain) => (
                <tr key={chain.chainId}>
                  <td className="px-4 py-2.5 align-top">
                    <div className="font-medium text-gray-900">
                      {chain.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {chain.chainId} · {chain.environment}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    {chain.assets.map((asset) => (
                      <div key={asset.address} className="text-xs">
                        <span className="font-medium text-gray-700">
                          {asset.symbol}
                        </span>{" "}
                        <code className="text-gray-400">{asset.address}</code>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <input
                      type="text"
                      value={tokenValue(chain.chainId)}
                      onChange={(event) =>
                        setTokenEdits((prev) => ({
                          ...prev,
                          [chain.chainId]: event.target.value,
                        }))
                      }
                      placeholder="Published assets"
                      spellCheck={false}
                      aria-label={`Asset override for ${chain.name}`}
                      className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {hasChanges ? (
          <button
            type="button"
            onClick={() => {
              setEdits({});
              setTokenEdits({});
            }}
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

      <ConfirmationModal
        isOpen={confirmingEnable}
        title="Turn on Real-Time Funding?"
        isDestructive
        confirmText="Turn it on"
        onCancel={() => setConfirmingEnable(false)}
        onConfirm={() => {
          setConfirmingEnable(false);
          commit();
        }}
        message={
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                aria-hidden
              />
              <p>
                Only turn this on once Rain has confirmed the tenant is enabled
                for Real-Time Funding.
              </p>
            </div>
            <p>
              Cardholders will be offered the approval immediately. Each one who
              accepts grants an <strong>unlimited</strong> ERC-20 allowance to
              Rain from their own wallet, and is told their card now draws from
              it.
            </p>
            <p>
              Turning this back off stops the offer, but it does not revoke an
              allowance anyone has already granted.
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
  return "Could not save the Real-Time Funding settings.";
}
