"use client";

import { Lock, RotateCcw, Undo2 } from "lucide-react";
import { formatRate, percentToPpm, ppmToPercent } from "@/lib/fee-rate";
import {
  CHAIN_NAMES,
  DepositFeeCell,
  DepositFeeMatrix,
  DepositFeeRoute,
} from "@/types/deposit-fees";

export const cellKey = (route: DepositFeeRoute, chainId: number) =>
  `${route}:${chainId}`;

/** What a cell's input says: an edited value, or its saved custom rate. */
export function cellText(
  cell: DepositFeeCell,
  edit: string | undefined,
): string {
  if (edit !== undefined) return edit;
  return cell.source === "custom" ? ppmToPercent(cell.ratePpm) : "";
}

/**
 * The stored value an input's text means: a ppm, null for "on the default",
 * or "invalid". An empty input is the default.
 */
export function parseCell(
  text: string,
  maxRatePpm: number,
): number | null | "invalid" {
  if (text.trim() === "") return null;
  const ppm = percentToPpm(text);
  if (ppm === null || ppm > maxRatePpm) return "invalid";
  return ppm;
}

const LOCKED_COPY = {
  home_chain: "Free: home chain",
  same_chain: "Same chain",
} as const;

interface FeeGridProps {
  matrix: DepositFeeMatrix;
  edits: Record<string, string>;
  onEdit: (key: string, text: string) => void;
  onUndo: (key: string) => void;
  disabled: boolean;
}

export default function FeeGrid({
  matrix,
  edits,
  onEdit,
  onUndo,
  disabled,
}: FeeGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left font-medium text-gray-500 py-3 pr-4 w-64">
              Route
            </th>
            {matrix.chains.map((chainId) => (
              <th
                key={chainId}
                className="text-left font-medium text-gray-500 py-3 px-2 min-w-32"
              >
                {CHAIN_NAMES[chainId] ?? chainId}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.routes.map((row) => (
            <tr key={row.route} className="border-b border-gray-100 align-top">
              <td className="py-3 pr-4">
                <div className="font-medium text-gray-900">{row.label}</div>
                <div className="text-xs text-gray-500">{row.description}</div>
              </td>
              {row.cells.map((cell) => {
                const key = cellKey(row.route, cell.chainId);

                if (cell.locked) {
                  return (
                    <td key={key} className="py-3 px-2">
                      <div className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-2 text-xs text-gray-500">
                        <Lock className="h-3 w-3" />
                        {LOCKED_COPY[cell.lockedReason ?? "home_chain"]}
                      </div>
                    </td>
                  );
                }

                const edit = edits[key];
                const text = cellText(cell, edit);
                const parsed = parseCell(text, matrix.maxRatePpm);
                const saved = cell.source === "custom" ? cell.ratePpm : null;
                const dirty = edit !== undefined && parsed !== saved;
                const invalid = parsed === "invalid";

                return (
                  <td key={key} className="py-3 px-2">
                    <div className="flex items-center gap-1">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={text}
                          disabled={disabled}
                          placeholder={ppmToPercent(matrix.defaultRatePpm)}
                          onChange={(e) => onEdit(key, e.target.value)}
                          className={`w-24 rounded-md border px-2 py-1.5 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 ${
                            invalid
                              ? "border-red-400 bg-red-50"
                              : dirty
                                ? "border-amber-400 bg-amber-50"
                                : "border-gray-300"
                          }`}
                          title={
                            cell.source === "custom" && cell.updatedByEmail
                              ? `Set by ${cell.updatedByEmail}${
                                  cell.updatedAt
                                    ? ` on ${new Date(cell.updatedAt).toLocaleDateString()}`
                                    : ""
                                }`
                              : "On the default"
                          }
                        />
                        <span className="pointer-events-none absolute right-2 top-1.5 text-gray-400">
                          %
                        </span>
                      </div>
                      {dirty ? (
                        <button
                          type="button"
                          onClick={() => onUndo(key)}
                          className="text-gray-400 hover:text-gray-700 cursor-pointer"
                          title="Undo"
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      ) : cell.source === "custom" && !disabled ? (
                        <button
                          type="button"
                          onClick={() => onEdit(key, "")}
                          className="text-gray-400 hover:text-gray-700 cursor-pointer"
                          title="Reset to default"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs">
                      {invalid ? (
                        <span className="text-red-600">
                          0 to {ppmToPercent(matrix.maxRatePpm)}, up to 4
                          decimals
                        </span>
                      ) : dirty ? (
                        <span className="text-amber-700">
                          was {formatRate(saved, matrix.defaultRatePpm)}
                        </span>
                      ) : cell.source === "custom" ? (
                        <span className="text-indigo-600">custom</span>
                      ) : (
                        <span className="text-gray-400">default</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
