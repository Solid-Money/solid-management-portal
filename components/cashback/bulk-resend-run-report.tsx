"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";

import { getFailedCashbackResendRun } from "@/lib/api";
import { cashbackStatusVariant } from "@/lib/card-transactions";
import {
  bulkResendOutcomeLabel,
  bulkResendOutcomeVariant,
  bulkResendRunStatusLabel,
  bulkResendRunStatusVariant,
  failedCashbackCauseLabel,
  formatSoUsd,
} from "@/lib/failed-cashback";
import { formatDateTime } from "@/lib/utils";
import { BulkResendRunReport } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** How often an open report re-reads where its rows stand. */
const REFRESH_MS = 60_000;

/**
 * One bulk re-send: who ran it and why, and where every row it queued stands
 * now — paid, still retrying, failed again, or Canceled by the monthly cap —
 * with the error for each one that has not paid.
 *
 * The send itself only re-arms the rows; the retry job pays them over the next
 * hours. So "did it work?" is answered here, not by the send's own result, and
 * the report keeps refreshing while it is open.
 */
export default function BulkResendRunReportDialog({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<BulkResendRunReport>({
    queryKey: ["failed-cashback-run", runId],
    queryFn: async () => (await getFailedCashbackResendRun(runId)).data,
    refetchInterval: REFRESH_MS,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : isError || !data ? (
          <>
            <DialogHeader>
              <DialogTitle>Bulk re-send</DialogTitle>
              <DialogDescription>
                This run could not be loaded.
              </DialogDescription>
            </DialogHeader>
          </>
        ) : (
          <ReportBody report={data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReportBody({ report }: { report: BulkResendRunReport }) {
  const { run, progress } = report;
  const queued = run.queuedRows;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          Bulk re-send by {run.adminUsername}
          <Badge variant={bulkResendRunStatusVariant(run.status)}>
            {bulkResendRunStatusLabel(run.status)}
          </Badge>
        </DialogTitle>
        <DialogDescription>
          {formatDateTime(run.createdAt)} · {run.queuedRows} of{" "}
          {run.requestedRows} row{run.requestedRows === 1 ? "" : "s"} queued for{" "}
          {run.queuedUsers} cardholder{run.queuedUsers === 1 ? "" : "s"} · about{" "}
          {formatSoUsd(run.estimatedSoUsd)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1 text-xs text-gray-600">
        {run.reason && (
          <p className="whitespace-pre-line">&ldquo;{run.reason}&rdquo;</p>
        )}
        {run.blockedReason && (
          <p className="text-red-600">{run.blockedReason}</p>
        )}
        {run.status === "running" && (
          <p className="text-red-600">
            This run stopped before its outcome was saved. The rows below may be
            incomplete — check the users&apos; cashback before sending again.
          </p>
        )}
        <p>
          Payout wallet at the time: {formatSoUsd(run.walletSoUsdBalance)}
          {run.walletNativeBalance !== undefined &&
            ` and ${run.walletNativeBalance.toFixed(2)} FUSE`}
          , with {formatSoUsd(run.alreadyQueuedSoUsd)} already queued.
        </p>
        {run.selection && (
          <p>
            Filter:{" "}
            {[
              run.selection.causes?.length
                ? run.selection.causes.map(failedCashbackCauseLabel).join(", ")
                : "every cause",
              run.selection.from &&
                `from ${formatDateTime(run.selection.from, { month: "short", day: "numeric", year: "numeric" })}`,
              run.selection.to &&
                `to ${formatDateTime(run.selection.to, { month: "short", day: "numeric", year: "numeric" })}`,
              run.selection.users?.length &&
                `${run.selection.users.length} named user${run.selection.users.length === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {queued > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant={progress.paid > 0 ? "success" : "muted"}>
            {progress.paid} paid
          </Badge>
          <Badge variant={progress.retrying > 0 ? "info" : "muted"}>
            {progress.retrying} still retrying
          </Badge>
          <Badge variant={progress.failedAgain > 0 ? "danger" : "muted"}>
            {progress.failedAgain} failed again
          </Badge>
          <Badge variant={progress.canceled > 0 ? "warning" : "muted"}>
            {progress.canceled} canceled
          </Badge>
          {progress.other > 0 && (
            <Badge variant="muted">{progress.other} other</Badge>
          )}
        </div>
      )}

      <div className="max-h-[50vh] overflow-auto rounded-md border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-xs font-semibold uppercase text-gray-500">
              <th className="py-2 pl-3 pr-4">Cardholder</th>
              <th className="py-2 pr-4">Purchase</th>
              <th className="py-2 pr-4">At send</th>
              <th className="py-2 pr-4">Now</th>
              <th className="py-2 pr-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.rows.map((row) => (
              <tr key={row.cashbackId}>
                <td className="py-2 pl-3 pr-4">
                  {row.userId ? (
                    <Link
                      href={`/users/${row.userId}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {row.username ?? `${row.userId.slice(0, 8)}…`}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{row.cashbackId}</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-gray-700">
                  {row.merchantName ?? "—"}
                  {row.fiatAmount && (
                    <span className="block text-xs text-gray-500">
                      {Number(row.fiatAmount).toFixed(2)}{" "}
                      {row.fiatCurrency?.toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <Badge variant={bulkResendOutcomeVariant(row.outcome)}>
                    {bulkResendOutcomeLabel(row.outcome)}
                  </Badge>
                </td>
                <td className="py-2 pr-4">
                  {row.currentStatus ? (
                    <Badge variant={cashbackStatusVariant(row.currentStatus)}>
                      {row.currentStatus}
                    </Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs text-gray-500">
                  {row.payoutTxHash && row.payoutTxHash.startsWith("0x") ? (
                    <a
                      href={`https://explorer.fuse.io/tx/${row.payoutTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      {row.soUsdAmount
                        ? `${Number(row.soUsdAmount).toFixed(4)} soUSD`
                        : "Payout"}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : row.currentStatus === "DeductedFromDebt" ? (
                    "Covered an open cashback debt"
                  ) : (
                    <span className="break-words">
                      {row.lastError ?? row.detail ?? "—"}
                      {row.currentStatus === "Failed" &&
                        row.nextRetryAt &&
                        ` · next try ${formatDateTime(row.nextRetryAt)}`}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
