"use client";

import { isAxiosError } from "axios";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import FeeGrid, {
  cellKey,
  cellText,
  parseCell,
} from "@/components/deposit-fees/fee-grid";
import HistoryTable from "@/components/deposit-fees/history-table";
import ReviewDialog, {
  ReviewRow,
} from "@/components/deposit-fees/review-dialog";
import {
  useDepositFeeMatrix,
  useSaveDepositFees,
  useSetDepositFeeLine,
} from "@/hooks/use-deposit-fees";
import { formatRate } from "@/lib/fee-rate";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Switch({
  label,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
          on ? "bg-indigo-600" : "bg-gray-300"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function DepositFeesPage() {
  const { data: matrix, isLoading, refetch } = useDepositFeeMatrix();
  const save = useSaveDepositFees();
  const setLine = useSetDepositFeeLine();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [pendingLine, setPendingLine] = useState<{
    line: "card" | "savings";
    enabled: boolean;
  } | null>(null);

  // Every edited cell whose text now means something other than what is saved.
  const { changes, invalid } = useMemo(() => {
    const rows: ReviewRow[] = [];
    let anyInvalid = false;
    if (!matrix) return { changes: rows, invalid: false };
    for (const row of matrix.routes) {
      for (const cell of row.cells) {
        const key = cellKey(row.route, cell.chainId);
        if (cell.locked || edits[key] === undefined) continue;
        const parsed = parseCell(cellText(cell, edits[key]), matrix.maxRatePpm);
        if (parsed === "invalid") {
          anyInvalid = true;
          continue;
        }
        const saved = cell.source === "custom" ? cell.ratePpm : null;
        if (parsed !== saved) {
          rows.push({
            route: row.route,
            routeLabel: row.label,
            chainId: cell.chainId,
            from: saved,
            to: parsed,
          });
        }
      }
    }
    return { changes: rows, invalid: anyInvalid };
  }, [matrix, edits]);

  useEffect(() => {
    if (changes.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changes.length]);

  if (isLoading || !matrix) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const handleSave = async (note: string) => {
    try {
      await save.mutateAsync({
        version: matrix.version,
        changes: changes.map((c) => ({
          route: c.route,
          chainId: c.chainId,
          ratePpm: c.to,
        })),
        note: note.trim() || undefined,
      });
      setEdits({});
      setReviewing(false);
      toast.success(
        `Saved ${changes.length} deposit fee change${changes.length === 1 ? "" : "s"}`,
        { description: "New deposits pick them up within 30 seconds." },
      );
    } catch (error) {
      setReviewing(false);
      if (isAxiosError(error) && error.response?.status === 409) {
        // Someone saved first. Reload the saved values under the edits, which
        // are kept: any cell whose saved value moved now shows what it was.
        await refetch();
      }
    }
  };

  const confirmLine = async () => {
    if (!pendingLine) return;
    try {
      await setLine.mutateAsync(pendingLine);
      toast.success(
        `${pendingLine.line === "card" ? "Card" : "Savings"} deposit fee ${
          pendingLine.enabled ? "switched on" : "switched off"
        }`,
      );
    } finally {
      setPendingLine(null);
    }
  };

  const disabled = !matrix.canEdit;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <ArrowRightLeft className="h-6 w-6 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deposit fees</h1>
          <p className="text-sm text-gray-500">
            The fee on deposits that have to be bridged, per route and source
            chain. Empty cells use the {formatRate(matrix.defaultRatePpm)}{" "}
            default. Per-tier product fees are on the Fees page.
          </p>
        </div>
      </div>

      {disabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You can view these rates but not change them. Editing is limited to
          the admins in DEPOSIT_FEE_ADMIN_EMAILS.
        </div>
      ) : null}

      <Section
        title="Status"
        description="The fee is charged only while the program and the line are on, and only on deposits detected after the launch time."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Switch
            label="Fee program (kept on by the Fees page)"
            on={matrix.switches.program}
            disabled
          />
          <Switch
            label="Card deposit fee"
            on={matrix.switches.cardLine}
            disabled={disabled || setLine.isPending}
            onToggle={() =>
              setPendingLine({
                line: "card",
                enabled: !matrix.switches.cardLine,
              })
            }
          />
          <Switch
            label="Savings deposit fee"
            on={matrix.switches.savingsLine}
            disabled={disabled || setLine.isPending}
            onToggle={() =>
              setPendingLine({
                line: "savings",
                enabled: !matrix.switches.savingsLine,
              })
            }
          />
          <div className="rounded-md border border-gray-200 px-4 py-3 text-sm">
            <div className="text-gray-500">Launch time</div>
            <div className="font-medium text-gray-900">
              {matrix.effectiveAt
                ? new Date(matrix.effectiveAt).toLocaleString()
                : "Live (no launch time set)"}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Rates"
        description="A rate is a percent of the deposit, taken on the source chain before bridging. Locked cells are never bridged, so they are always free."
      >
        <FeeGrid
          matrix={matrix}
          edits={edits}
          disabled={disabled}
          onEdit={(key, text) => setEdits((e) => ({ ...e, [key]: text }))}
          onUndo={(key) =>
            setEdits((e) => {
              const next = { ...e };
              delete next[key];
              return next;
            })
          }
        />
      </Section>

      <Section title="History" description="Every saved change, newest first.">
        <HistoryTable matrix={matrix} />
      </Section>

      {changes.length > 0 || invalid ? (
        <div className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white px-6 py-3 shadow-lg">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <span className="text-sm text-gray-700">
              {invalid
                ? "Fix the highlighted cells to save"
                : `${changes.length} change${changes.length === 1 ? "" : "s"}`}
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => setEdits({})}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={() => setReviewing(true)}
                disabled={invalid || changes.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                Review and save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewing ? (
        <ReviewDialog
          rows={changes}
          defaultRatePpm={matrix.defaultRatePpm}
          warnRatePpm={matrix.warnRatePpm}
          saving={save.isPending}
          onConfirm={handleSave}
          onCancel={() => setReviewing(false)}
        />
      ) : null}

      <ConfirmationModal
        isOpen={!!pendingLine}
        title={
          pendingLine?.enabled
            ? "Switch this deposit fee on?"
            : "Switch this deposit fee off?"
        }
        message={
          pendingLine?.enabled
            ? "Deposits on this line will be charged at the rates above, once the program is on and the launch time has passed."
            : "Deposits on this line stop being charged immediately. Deposits already assessed keep their fee."
        }
        confirmText={pendingLine?.enabled ? "Switch on" : "Switch off"}
        isDestructive={!pendingLine?.enabled}
        onConfirm={confirmLine}
        onCancel={() => setPendingLine(null)}
      />
    </div>
  );
}
