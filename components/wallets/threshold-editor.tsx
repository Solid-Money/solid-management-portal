"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { setWalletThreshold } from "@/lib/wallets";
import { WalletAssetPlan } from "@/types";

/**
 * Edit one asset's threshold in place.
 *
 * The figure used to be reachable only by changing `wallet-config.constants.ts`
 * — a code change, a review and a deploy — which is why the numbers on this
 * page drifted so far from what they were meant to mean: nobody was going to
 * open a pull request to move a floor by 200.
 *
 * Only the number is editable, and only for the asset it sits on. Everything
 * else about a wallet is a property of what the wallet is for, and belongs in
 * the registry where it can be reviewed.
 */
export default function ThresholdEditor({
  plan,
  onDone,
}: {
  plan: WalletAssetPlan;
  onDone?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(plan.threshold);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (next: { threshold?: string; reset?: boolean }) =>
      setWalletThreshold(plan.walletName, {
        chainId: plan.chainId,
        asset: plan.asset,
        ...next,
      }),
    onSuccess: (result) => {
      setEditing(false);
      setValue(result.threshold);
      // Both reads descend from the threshold, so both are stale now. The
      // verdict on screen was computed against the old figure.
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-plans"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-audit"] });
      toast.success(
        result.source === "registry"
          ? `${plan.symbol} threshold reset to ${result.threshold}`
          : `${plan.symbol} threshold set to ${result.threshold}`
      );
      onDone?.();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not save that threshold"),
  });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setValue(plan.threshold);
          setEditing(true);
        }}
        className="ml-1 inline-flex items-center text-gray-400 hover:text-indigo-600"
        aria-label={`Edit the ${plan.symbol} threshold on ${plan.chainName}`}
        title={
          plan.thresholdSource === "override"
            ? `Set to ${plan.threshold} by ${plan.thresholdUpdatedBy ?? "an admin"}${
                plan.thresholdUpdatedAt
                  ? ` on ${new Date(plan.thresholdUpdatedAt).toLocaleDateString()}`
                  : ""
              }. Click to change.`
            : "The configured default. Click to change."
        }
      >
        <Pencil className="h-3 w-3" />
      </button>
    );
  }

  return (
    <span
      className="ml-1 inline-flex items-center gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <input
        value={value}
        autoFocus
        inputMode="decimal"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") save.mutate({ threshold: value.trim() });
          if (event.key === "Escape") setEditing(false);
        }}
        className="w-24 rounded border border-gray-300 px-1 py-0.5 text-xs"
        aria-label={`${plan.symbol} threshold`}
      />
      <button
        type="button"
        onClick={() => save.mutate({ threshold: value.trim() })}
        disabled={save.isPending || value.trim() === ""}
        className="text-green-600 hover:text-green-800 disabled:opacity-40"
        aria-label="Save threshold"
      >
        {save.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </button>
      {/* Only offered where there is an override to undo, so the control does
          not imply the configured figure is something you can revert to from
          itself. */}
      {plan.thresholdSource === "override" && (
        <button
          type="button"
          onClick={() => save.mutate({ reset: true })}
          disabled={save.isPending}
          className="text-gray-400 hover:text-gray-700 disabled:opacity-40"
          aria-label="Reset to the configured default"
          title="Reset to the configured default"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-gray-400 hover:text-gray-700"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
