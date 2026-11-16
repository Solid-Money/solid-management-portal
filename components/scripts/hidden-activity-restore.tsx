"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { AlertCircle, CheckCircle, Eye, RotateCcw } from "lucide-react";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { CHAIN_NAMES } from "@/types/deposit-fees";
import {
  HIDDEN_RESTORE_BLOCK_LABELS,
  hiddenReasonSummary,
  hiddenTotal,
  isHiddenActivityRestorePreview,
} from "@/lib/hidden-activity-restore";
import type {
  HiddenActivityRestorePreview,
  HiddenActivityRestoreResult,
} from "@/types/hidden-activity-restore";

const USER_ID = /^[a-f0-9]{24}$/i;

function errorMessage(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 404) {
      return "The restore is not available on the server yet. Deploy the backend update, then preview again.";
    }
    return (
      error.response?.data?.message ||
      "The request did not finish. Preview again to check the current state before retrying."
    );
  }
  return "The request did not finish. Preview again to check the current state before retrying.";
}

/**
 * Puts back activity rows the token whitelist hid by mistake.
 *
 * The whitelist matched the token list on lowercased addresses, and some
 * tokens are listed checksummed (soFUSE, soETH, USDT on Fuse) or not at all
 * (soUSD on Base). Sends and Earn withdrawals of them went through on chain
 * and then vanished from the customer's Activity. The backend decides which
 * rows qualify — spam, card settlement sweeps and deposit legs stay hidden —
 * and this only previews and confirms its batch.
 *
 * With `userId` it works on that one account (the user page); without, on
 * every account, 500 rows per batch, with an optional account filter.
 */
export function HiddenActivityRestore({
  userId: fixedUserId,
  onApplySettled,
}: {
  userId?: string;
  /**
   * Called after every restore attempt, whatever its outcome: a lost response
   * can follow a restore that committed, so whatever shows the account's
   * activity should read it again either way.
   */
  onApplySettled?: () => void;
}) {
  const [userFilter, setUserFilter] = useState("");
  const [preview, setPreview] = useState<HiddenActivityRestorePreview | null>(
    null,
  );
  const [result, setResult] = useState<HiddenActivityRestoreResult | null>(
    null,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const scope = fixedUserId ?? (userFilter.trim() || undefined);
  const filterInvalid = !fixedUserId && !!scope && !USER_ID.test(scope);

  async function loadPreview() {
    if (inFlight.current || filterInvalid) return;
    inFlight.current = true;
    setPending("preview");
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError(null);
    try {
      const response = await api.get<HiddenActivityRestorePreview>(
        "/admin/v1/activities/hidden-restore/preview",
        { params: scope ? { userId: scope } : {}, quietErrors: true },
      );
      if (!isHiddenActivityRestorePreview(response.data)) {
        throw new Error("Invalid preview response");
      }
      setPreview(response.data);
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function restore() {
    if (inFlight.current || !preview?.canApply || !confirmed) return;
    inFlight.current = true;
    setPending("apply");
    setConfirmed(false);
    setResult(null);
    setError(null);
    try {
      const response = await api.post<HiddenActivityRestoreResult>(
        "/admin/v1/activities/hidden-restore/apply",
        {
          // The scope the preview was read with: the server refuses a token
          // previewed for another one.
          ...(preview.userId ? { userId: preview.userId } : {}),
          previewToken: preview.previewToken,
          confirm: true,
        },
        { quietErrors: true },
      );
      const data = response.data;
      if (typeof data?.restored !== "number") {
        setPreview(null);
        setError(
          "The server did not return the restore state. Preview again to check whether the rows were restored.",
        );
        return;
      }
      // The restore committed. Without a readable follow-up preview, say so
      // and leave the next preview to the operator rather than show an error.
      const after = isHiddenActivityRestorePreview(data.preview)
        ? data.preview
        : null;
      setResult({ ...data, preview: after });
      setPreview(after);
    } catch (error: unknown) {
      // An interrupted response can follow a successful commit. Force a new
      // read so the operator sees the actual state before any retry.
      setPreview(null);
      setError(errorMessage(error));
    } finally {
      inFlight.current = false;
      setPending(null);
      onApplySettled?.();
    }
  }

  const leftHidden = preview ? hiddenTotal(preview.blocked) : 0;
  const blockedReasons = preview ? hiddenReasonSummary(preview.blocked) : [];

  return (
    <div className="space-y-5">
      {!fixedUserId && (
        <div className="max-w-md space-y-1">
          <label
            htmlFor="hidden-restore-user"
            className="text-sm font-medium text-gray-800"
          >
            Limit to one account (optional)
          </label>
          <input
            id="hidden-restore-user"
            value={userFilter}
            onChange={(event) => {
              setUserFilter(event.target.value);
              setPreview(null);
              setResult(null);
              setConfirmed(false);
            }}
            placeholder="User id, e.g. 687e21b78b578d8b299c5485"
            disabled={pending !== null}
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
          />
          {filterInvalid && (
            <p className="text-xs text-red-700">
              Enter a 24-character user id, or leave it empty for every
              account.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={loadPreview}
        disabled={pending !== null || filterInvalid}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
        {pending === "preview" ? "Checking hidden rows…" : "Preview hidden rows"}
      </button>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {result && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md bg-green-50 p-4 text-sm text-green-800"
        >
          <CheckCircle className="h-5 w-5" aria-hidden="true" />
          {result.restored} row{result.restored === 1 ? "" : "s"} restored for{" "}
          {result.accounts} account{result.accounts === 1 ? "" : "s"}.
          {!result.preview
            ? " Preview again to see what is left."
            : result.preview.hasMore
              ? " More remain — the next batch is previewed below."
              : ""}
        </p>
      )}

      {preview && (
        <div className="space-y-4" aria-live="polite">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Ready to restore", preview.eligible],
              ["Accounts", preview.accounts],
              ["Left hidden", leftHidden],
              ["Hidden rows checked", preview.scanned],
            ].map(([label, count]) => (
              <div key={label} className="rounded-md bg-gray-50 p-4">
                <dt className="text-sm text-gray-600">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {count}
                </dd>
              </div>
            ))}
          </dl>

          {blockedReasons.length > 0 && (
            <div className="rounded-md border border-gray-200 p-4 text-sm">
              <p className="font-medium text-gray-900">Staying hidden</p>
              <ul className="mt-2 grid gap-1 text-gray-700 sm:grid-cols-2">
                {blockedReasons.map(({ reason, label, count }) => (
                  <li key={reason}>
                    {label}: <span className="font-semibold">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.hasMore && (
            <p className="rounded-md bg-blue-50 p-4 text-sm text-blue-900">
              More rows qualify than one batch restores ({preview.batchLimit}).
              Restore this batch, then the next one is previewed for you.
            </p>
          )}

          {!preview.canApply ? (
            <p
              role="status"
              className="flex items-center gap-2 rounded-md bg-green-50 p-4 text-sm text-green-800"
            >
              <CheckCircle className="h-5 w-5" aria-hidden="true" />
              Nothing to restore
              {preview.userId ? " for this account" : ""}.
            </p>
          ) : (
            <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
              <label className="flex items-start gap-3 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={pending !== null}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  I reviewed the preview and want to put these{" "}
                  {preview.eligible} row{preview.eligible === 1 ? "" : "s"} back
                  in {preview.accounts === 1 ? "the customer’s" : "customers’"}{" "}
                  Activity.
                </span>
              </label>
              <button
                type="button"
                onClick={restore}
                disabled={!confirmed || pending !== null}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {pending === "apply"
                  ? "Restoring…"
                  : `Restore ${preview.eligible} row${preview.eligible === 1 ? "" : "s"}`}
              </button>
              <p className="text-xs text-gray-600">
                Balances are not touched: these transactions already happened
                on chain. The server checks the preview again before applying,
                and saves the rows as they were on each account’s audit trail.
                Rows still marked pending are re-checked on chain afterwards.
              </p>
            </div>
          )}

          {preview.entries.length > 0 && (
            <details className="rounded-md border border-gray-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">
                Review rows ({preview.eligible} to restore
                {leftHidden > 0
                  ? `, a sample of ${preview.entries.length - preview.eligible} left hidden`
                  : ""}
                )
              </summary>
              <div className="max-h-96 overflow-auto border-t border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-700">
                    <tr>
                      {[
                        "Activity ID",
                        ...(fixedUserId ? [] : ["Account"]),
                        "Created",
                        "Amount",
                        "Type / status",
                        "Chain",
                        "Restore",
                      ].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="px-4 py-3 font-medium"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 font-mono">{entry.id}</td>
                        {!fixedUserId && (
                          <td className="px-4 py-3">
                            {entry.userId ? (
                              <Link
                                href={`/users/${entry.userId}`}
                                className="text-indigo-700 underline"
                              >
                                {entry.userId}
                              </Link>
                            ) : (
                              "Missing account"
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {entry.createdAt
                            ? formatDateTime(entry.createdAt)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {entry.amount} {entry.symbol}
                        </td>
                        <td className="px-4 py-3">
                          {entry.type} / {entry.status}
                        </td>
                        <td className="px-4 py-3">
                          {entry.chainId === null
                            ? "—"
                            : (CHAIN_NAMES[entry.chainId] ??
                              `Chain ${entry.chainId}`)}
                        </td>
                        <td className="px-4 py-3">
                          {entry.state === "eligible"
                            ? "Will be restored"
                            : entry.blockedReason
                              ? (HIDDEN_RESTORE_BLOCK_LABELS[
                                  entry.blockedReason
                                ] ?? entry.blockedReason)
                              : "Stays hidden"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
