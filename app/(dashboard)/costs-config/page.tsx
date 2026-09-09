"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useCostsConfig, useUpdateCostsConfig } from "@/hooks/use-analytics";
import { COST_INPUT_FIELDS, type CostsConfig } from "@/types/analytics";
import { formatDateTime } from "@/lib/utils";

/**
 * The cost inputs behind every unit-economics number.
 *
 * These are invoiced and contracted amounts no system of ours emits, so they
 * have to be entered by hand. Each is optional and each starts unset: an unset
 * cost makes its line report "not instrumented" rather than contributing a zero
 * that would quietly flatter the margin. Entering the points conversion rate is
 * what turns on the points liability valuation under Rewards → Owed.
 */
export default function CostsConfigPage() {
  const { data, isLoading, error } = useCostsConfig();
  const update = useUpdateCostsConfig();

  /**
   * Only the fields the operator has actually edited.
   *
   * The saved value is read through on render rather than copied into state on
   * load: seeding from an effect would overwrite whatever is half-typed the
   * next time the query refetches, which on a form that moves real cost
   * assumptions is worse than the extra indirection here.
   */
  const [edits, setEdits] = useState<Partial<Record<string, string>>>({});

  const displayed = (key: keyof CostsConfig): string => {
    const edited = edits[key];
    if (edited !== undefined) return edited;
    const saved = data?.config[key];
    return saved === undefined ? "" : String(saved);
  };

  const save = () => {
    const changes: Partial<CostsConfig> = {};

    for (const field of COST_INPUT_FIELDS) {
      const raw = displayed(field.key).trim();
      if (!raw) continue;

      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error(`${field.label} must be a number of 0 or more.`);
        return;
      }
      // Only send what actually changed, so an untouched field stays unset
      // rather than being written as its own blank.
      if (parsed !== data?.config[field.key]) {
        changes[field.key] = parsed;
      }
    }

    if (Object.keys(changes).length === 0) {
      toast.info("Nothing to save.");
      return;
    }

    update.mutate(changes, {
      onSuccess: () => {
        // Cleared so the inputs read back from the server's own response,
        // rather than from a local copy that could now differ from it.
        setEdits({});
        toast.success("Cost inputs saved.");
      },
      onError: () => toast.error("Could not save the cost inputs."),
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Cost inputs</h1>
        <p className="mt-1 text-sm text-gray-500">
          What each user costs us, from invoices and contracts. These feed CAC,
          payback and the country profitability table.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Could not load the cost inputs.
        </div>
      ) : null}

      {data && data.missing.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2.5 text-sm text-amber-900">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
              aria-hidden
            />
            <p>
              {data.missing.length} of {COST_INPUT_FIELDS.length} inputs are
              unset. Every cost line reading from one of them reports itself as
              not instrumented, and any margin that would include it is
              incomplete — deliberately, rather than being computed as if the
              cost were zero.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {COST_INPUT_FIELDS.map((field) => {
              const isMissing = data?.missing.includes(field.key) ?? false;

              return (
                <div
                  key={field.key}
                  className="flex flex-wrap items-center gap-4 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={field.key}
                      className="text-sm font-medium text-gray-900"
                    >
                      {field.label}
                    </label>
                    <p className="text-xs text-gray-500">{field.hint}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isMissing ? (
                      <span className="text-xs text-amber-700">Unset</span>
                    ) : null}
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        $
                      </span>
                      <input
                        id={field.key}
                        type="number"
                        min="0"
                        step="any"
                        value={displayed(field.key)}
                        onChange={(event) =>
                          setEdits((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        placeholder="—"
                        className="w-32 rounded border border-gray-300 py-1.5 pl-6 pr-2 text-right text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {data?.updatedAt
            ? `Last changed ${formatDateTime(data.updatedAt)}`
            : "Never set"}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={update.isPending || isLoading}
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
  );
}
