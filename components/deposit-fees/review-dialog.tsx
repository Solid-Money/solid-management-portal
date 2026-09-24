"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { feeOn, formatRate } from "@/lib/fee-rate";
import { CHAIN_NAMES, DepositFeeRoute } from "@/types/deposit-fees";

export interface ReviewRow {
  route: DepositFeeRoute;
  routeLabel: string;
  chainId: number;
  from: number | null;
  to: number | null;
}

interface ReviewDialogProps {
  rows: ReviewRow[];
  defaultRatePpm: number;
  warnRatePpm: number;
  saving: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

export default function ReviewDialog({
  rows,
  defaultRatePpm,
  warnRatePpm,
  saving,
  onConfirm,
  onCancel,
}: ReviewDialogProps) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">
            Review deposit fee changes
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 font-medium">Route</th>
                <th className="py-2 font-medium">Chain</th>
                <th className="py-2 font-medium">Change</th>
                <th className="py-2 font-medium">On $1,000</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const effective = row.to ?? defaultRatePpm;
                const high = effective > warnRatePpm;
                const free = row.to === 0;
                return (
                  <tr
                    key={`${row.route}:${row.chainId}`}
                    className="border-t border-gray-100"
                  >
                    <td className="py-2">{row.routeLabel}</td>
                    <td className="py-2">
                      {CHAIN_NAMES[row.chainId] ?? row.chainId}
                    </td>
                    <td className="py-2">
                      {formatRate(row.from, defaultRatePpm)} →{" "}
                      <span className="font-medium">
                        {formatRate(row.to, defaultRatePpm)}
                      </span>
                      {high ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          above {formatRate(warnRatePpm)}
                        </span>
                      ) : null}
                      {free ? (
                        <span className="ml-2 text-amber-700">
                          free from this chain
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2">{feeOn(effective, 1000)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Why this changed, for the history and the Slack notice"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <p className="text-xs text-gray-500">
            Changes apply to new deposits within 30 seconds. Deposits already
            detected keep the fee they were assessed.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note)}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : `Save ${rows.length} change${rows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
