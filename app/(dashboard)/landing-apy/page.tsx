"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Save, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type ApyMode = "simple" | "advanced";
type ApyAsset = "usdc" | "fuse" | "eth";
type ApyWindow = "allTime" | "sevenDay" | "fifteenDay" | "thirtyDay";

type ApyWindows = Record<ApyWindow, number>;
type ApysByAsset = Record<ApyAsset, ApyWindows>;

interface LandingApyConfig {
  overrideEnabled: boolean;
  mode: ApyMode;
  apy: number;
  apys: ApysByAsset;
}

const ASSETS: { key: ApyAsset; label: string }[] = [
  { key: "usdc", label: "USDC (soUSD)" },
  { key: "fuse", label: "FUSE (soFUSE)" },
  { key: "eth", label: "ETH (soETH)" },
];

const WINDOWS: { key: ApyWindow; label: string }[] = [
  { key: "allTime", label: "All-time" },
  { key: "sevenDay", label: "7-day" },
  { key: "fifteenDay", label: "15-day" },
  { key: "thirtyDay", label: "30-day" },
];

const emptyWindows = (): ApyWindows => ({
  allTime: 0,
  sevenDay: 0,
  fifteenDay: 0,
  thirtyDay: 0,
});

const emptyMatrix = (): ApysByAsset => ({
  usdc: emptyWindows(),
  fuse: emptyWindows(),
  eth: emptyWindows(),
});

const isMatrixEmpty = (m: ApysByAsset): boolean =>
  ASSETS.every((a) => WINDOWS.every((w) => !m[a.key][w.key]));

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
        value ? "bg-indigo-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ApyInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center">
      <input
        type="number"
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={0}
        step="0.01"
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      <span className="ml-2 text-sm text-gray-500">%</span>
    </div>
  );
}

export default function LandingApyPage() {
  const [config, setConfig] = useState<LandingApyConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<LandingApyConfig | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data } = await api.get<LandingApyConfig>(
        "/admin/v1/landing-config",
      );
      const normalized: LandingApyConfig = {
        overrideEnabled: !!data.overrideEnabled,
        mode: data.mode === "advanced" ? "advanced" : "simple",
        apy: data.apy ?? 0,
        apys: { ...emptyMatrix(), ...(data.apys || {}) },
      };
      setConfig(normalized);
      setOriginalConfig(normalized);
    } catch (error) {
      console.error("Failed to load landing APY config:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const hasChanges =
    config !== null &&
    originalConfig !== null &&
    JSON.stringify(config) !== JSON.stringify(originalConfig);

  const setMode = (mode: ApyMode) => {
    if (!config) return;
    // When entering advanced mode for the first time, seed the matrix from the
    // simple value so usdc · all-time matches what simple mode displays.
    if (mode === "advanced" && isMatrixEmpty(config.apys) && config.apy) {
      const seeded = emptyMatrix();
      seeded.usdc.allTime = config.apy;
      setConfig({ ...config, mode, apys: seeded });
    } else {
      setConfig({ ...config, mode });
    }
  };

  const setMatrixValue = (
    asset: ApyAsset,
    window: ApyWindow,
    value: number,
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      apys: {
        ...config.apys,
        [asset]: { ...config.apys[asset], [window]: value },
      },
    });
  };

  const handleSave = async () => {
    if (!config) return;

    if (config.overrideEnabled && config.mode === "simple") {
      if (Number.isNaN(config.apy) || config.apy < 0) {
        toast.error("Enter a valid APY (0 or greater) before saving.");
        return;
      }
    }

    try {
      setSaving(true);
      const { data } = await api.patch<LandingApyConfig>(
        "/admin/v1/landing-config",
        {
          overrideEnabled: config.overrideEnabled,
          mode: config.mode,
          apy: config.apy,
          apys: config.apys,
        },
      );
      const normalized: LandingApyConfig = {
        overrideEnabled: !!data.overrideEnabled,
        mode: data.mode === "advanced" ? "advanced" : "simple",
        apy: data.apy ?? 0,
        apys: { ...emptyMatrix(), ...(data.apys || {}) },
      };
      setConfig(normalized);
      setOriginalConfig(normalized);
      toast.success("Landing page APY updated.");
    } catch (error) {
      console.error("Failed to update landing APY config:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-gray-600">
          Could not load the landing page APY configuration.{" "}
          <button
            onClick={fetchConfig}
            className="text-indigo-600 hover:underline cursor-pointer"
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <TrendingUp className="h-6 w-6 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Landing Page APY</h1>
          <p className="text-sm text-gray-500">
            Control the APY value displayed on the solid.xyz landing page.
          </p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        {/* Master override toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Override the auto-computed APY
            </label>
            <p className="text-sm text-gray-500">
              {config.overrideEnabled
                ? "The landing page displays the managed value below."
                : "The landing page displays the auto-computed APY. Turn this on to manage it."}
            </p>
          </div>
          <Toggle
            value={config.overrideEnabled}
            onChange={(v) => setConfig({ ...config, overrideEnabled: v })}
          />
        </div>

        {/* Mode selector and values are only shown once the override is on. */}
        {config.overrideEnabled && (
          <>
            <div className="flex items-center gap-2">
              {(["simple", "advanced"] as ApyMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    config.mode === m
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {m === "simple" ? "Simple" : "Advanced"}
                </button>
              ))}
            </div>

            {config.mode === "simple" ? (
              <div className="flex flex-col max-w-xs">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  APY value
                </label>
                <ApyInput
                  value={config.apy}
                  onChange={(v) => setConfig({ ...config, apy: v })}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Shown as the headline APY (maps to USDC · all-time).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">
                  Only USDC · all-time is currently displayed on the landing
                  page. Other windows and assets are stored for future use.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left font-medium text-gray-500 py-2 pr-4">
                          Asset
                        </th>
                        {WINDOWS.map((w) => (
                          <th
                            key={w.key}
                            className="text-left font-medium text-gray-500 py-2 px-2"
                          >
                            {w.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ASSETS.map((a) => (
                        <tr key={a.key} className="border-t border-gray-100">
                          <td className="py-2 pr-4 font-medium text-gray-700 whitespace-nowrap">
                            {a.label}
                          </td>
                          {WINDOWS.map((w) => (
                            <td key={w.key} className="py-2 px-2 w-32">
                              <ApyInput
                                value={config.apys[a.key][w.key]}
                                onChange={(v) =>
                                  setMatrixValue(a.key, w.key, v)
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
