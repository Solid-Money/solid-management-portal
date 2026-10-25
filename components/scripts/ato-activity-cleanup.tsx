"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type {
  AtoActivityCleanupPreview,
  AtoActivityCleanupResult,
} from "@/types/ato-activity-cleanup";

function errorMessage(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 404) {
      return "The cleanup is not available on the server yet. Deploy the backend update, then preview again.";
    }
    return (
      error.response?.data?.message ||
      "The request did not finish. Preview again to check the current state before retrying."
    );
  }
  return "The request did not finish. Preview again to check the current state before retrying.";
}

export function AtoActivityCleanup() {
  const [preview, setPreview] = useState<AtoActivityCleanupPreview | null>(
    null,
  );
  const [result, setResult] = useState<AtoActivityCleanupResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function loadPreview() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending("preview");
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError(null);
    try {
      const response = await api.get<AtoActivityCleanupPreview>(
        "/admin/v1/activities/ato-cleanup/preview",
        { quietErrors: true },
      );
      setPreview(response.data);
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function hideEntries() {
    if (inFlight.current || !preview?.canApply || !confirmed) return;
    inFlight.current = true;
    setPending("apply");
    setConfirmed(false);
    setResult(null);
    setError(null);
    try {
      const response = await api.post<AtoActivityCleanupResult>(
        "/admin/v1/activities/ato-cleanup/apply",
        { previewToken: preview.previewToken, confirm: true },
        { quietErrors: true },
      );
      setResult(response.data);
      setPreview(response.data.preview);
    } catch (error: unknown) {
      // An interrupted response can follow a successful commit. Force a new
      // read so the operator sees the actual state before any retry.
      setPreview(null);
      setError(errorMessage(error));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  const complete =
    preview?.alreadyHidden === preview?.expected &&
    preview !== null &&
    preview.blocked === 0;

  return (
    <section
      id="ato-activity-cleanup"
      aria-labelledby="ato-cleanup-heading"
      className="rounded-lg bg-white p-6 shadow space-y-5"
    >
      <div>
        <h2
          id="ato-cleanup-heading"
          className="text-lg font-medium text-gray-900"
        >
          Hide failed withdrawals from the October 25 incident
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Preview the 215 listed failed card withdrawals before hiding them from
          customers’ Activity. The records stay in the database. Balances and
          transactions are unaffected.
        </p>
      </div>

      <button
        type="button"
        onClick={loadPreview}
        disabled={pending !== null}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
        {pending === "preview" ? "Checking entries…" : "Preview entries"}
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

      {preview && (
        <div className="space-y-4" aria-live="polite">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Ready to hide", preview.matching],
              ["Already hidden", preview.alreadyHidden],
              ["Missing or changed", preview.blocked],
              ["Accounts", preview.accounts],
            ].map(([label, count]) => (
              <div key={label} className="rounded-md bg-gray-50 p-4">
                <dt className="text-sm text-gray-600">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {count}
                </dd>
              </div>
            ))}
          </dl>

          {complete ? (
            <p
              role="status"
              className="flex items-center gap-2 rounded-md bg-green-50 p-4 text-sm text-green-800"
            >
              <CheckCircle className="h-5 w-5" aria-hidden="true" />
              {result && !result.alreadyApplied
                ? `${result.hidden} entries hidden and verified.`
                : "All 215 entries are already hidden. No further action is needed."}
            </p>
          ) : !preview.canApply ? (
            <p
              role="alert"
              className="rounded-md bg-amber-50 p-4 text-sm text-amber-900"
            >
              The entries do not match all 215 expected failed withdrawals.
              Hiding is disabled. Review the entries before continuing.
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
                  I reviewed the preview and want to hide these 215 entries from
                  customers’ Activity.
                </span>
              </label>
              <button
                type="button"
                onClick={hideEntries}
                disabled={!confirmed || pending !== null}
                className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                <EyeOff className="h-4 w-4" aria-hidden="true" />
                {pending === "apply"
                  ? "Hiding and verifying…"
                  : "Hide 215 entries"}
              </button>
              <p className="text-xs text-gray-600">
                The server checks the preview again before applying. The action
                and original records are saved in each account’s admin audit
                trail.
              </p>
            </div>
          )}

          <details className="rounded-md border border-gray-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">
              Review all {preview.found} matched entries
            </summary>
            <div className="max-h-96 overflow-auto border-t border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-50 text-gray-700">
                  <tr>
                    {[
                      "Activity ID",
                      "Account",
                      "Created",
                      "Amount",
                      "Type / status",
                      "Cleanup",
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
                        {entry.state === "eligible"
                          ? "Ready to hide"
                          : entry.state === "hidden"
                            ? "Already hidden"
                            : "Changed — blocked"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {preview.missingIds.length > 0 && (
            <details className="text-sm text-red-800">
              <summary className="cursor-pointer">
                {preview.missingIds.length} missing entries
              </summary>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {preview.missingIds.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
