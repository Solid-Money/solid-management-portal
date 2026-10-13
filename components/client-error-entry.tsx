"use client";

import Link from "next/link";
import { ExternalLink, ScrollText, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CopyableValue } from "@/components/ui/copy-button";
import {
  formatErrorRef,
  glitchTipSearchUrl,
  grafanaLogsUrl,
} from "@/lib/error-ref";
import { formatDateTime } from "@/lib/utils";
import { ClientErrorMatch } from "@/types";

type BadgeVariant = "danger" | "warning" | "info" | "muted";

/** How loud each cause family reads. Ours to fix in red; the user's or the network's muted. */
const KIND_VARIANT: Record<string, BadgeVariant> = {
  blockchain: "danger",
  server: "danger",
  unknown: "danger",
  rejected: "warning",
  insufficient_funds: "info",
  rate_limited: "warning",
  timeout: "warning",
  offline: "muted",
  session: "muted",
};

const SURFACE_LABEL: Record<string, string> = {
  sheet: "Failure sheet",
  toast: "Toast",
  inline: "Inline",
  screen: "Error screen",
};

const humanize = (value: string) =>
  value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-xs text-gray-900">{children}</dd>
    </div>
  );
}

function OutLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/**
 * One failure a user was shown: what they read, why it happened, and the IDs
 * that open the same failure in GlitchTip (event) and Loki (request).
 *
 * The technical message is sanitized before it is stored, so it is safe to
 * read and paste, but it is still for us: the user saw the title and body.
 */
export default function ClientErrorEntry({
  error,
  showUser = false,
}: {
  error: ClientErrorMatch;
  showUser?: boolean;
}) {
  const ref = formatErrorRef(error.ref);
  const amount = [error.details?.amount, error.details?.token].filter(Boolean).join(" ");
  // The failing request's own lines when there was one, else the report line.
  const logsUrl = grafanaLogsUrl(
    error.requestId ? `rid=${error.requestId}` : `ref=${ref}`,
    error.occurredAt,
  );

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-gray-900">Ref {ref}</span>
        <Badge variant={KIND_VARIANT[error.kind] ?? "muted"}>{humanize(error.kind)}</Badge>
        <Badge variant="outline">{SURFACE_LABEL[error.surface] ?? error.surface}</Badge>
        {error.nothingSent && <Badge variant="success">Nothing sent</Badge>}
        <span className="ml-auto text-xs text-gray-500">{formatDateTime(error.occurredAt)}</span>
      </div>

      <div className="rounded-md bg-gray-50 px-3 py-2">
        <p className="text-sm font-medium text-gray-900">{error.title}</p>
        {error.body && <p className="mt-0.5 text-xs text-gray-600">{error.body}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {showUser && (
          <Field label="User">
            {error.user ? (
              <Link
                href={`/users/${error.user.id}`}
                className="text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                {error.user.username || error.user.email || error.user.id}
              </Link>
            ) : error.userId ? (
              <Link
                href={`/users/${error.userId}`}
                className="font-mono text-indigo-600 hover:underline"
              >
                {error.userId}
              </Link>
            ) : (
              <span className="text-gray-400">Signed out</span>
            )}
          </Field>
        )}
        <Field label="Action">{humanize(error.action)}</Field>
        <Field label="Cause">
          <span className="font-mono">{error.code}</span>
          {error.httpStatus ? <span className="text-gray-500"> · HTTP {error.httpStatus}</span> : null}
        </Field>
        {amount && (
          <Field label="Amount">
            {amount}
            {error.details?.network ? (
              <span className="text-gray-500"> on {error.details.network}</span>
            ) : null}
          </Field>
        )}
        <Field label="App">
          {[error.platform, error.appVersion].filter(Boolean).join(" ") || "—"}
        </Field>
        {error.route && (
          <Field label="Screen">
            <span className="font-mono">{error.route}</span>
          </Field>
        )}
      </dl>

      {error.message && (
        <Field label="Technical cause">
          <p className="break-words font-mono text-[11px] text-gray-700">{error.message}</p>
        </Field>
      )}

      <dl className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2">
        <Field label="GlitchTip event">
          <div className="flex flex-wrap items-center gap-3">
            <CopyableValue value={error.eventId} label="Event ID" truncate />
            <OutLink href={glitchTipSearchUrl(error.eventId)}>
              <Search className="h-3 w-3" />
              Open in GlitchTip
            </OutLink>
          </div>
        </Field>
        <Field label="Request">
          <div className="flex flex-wrap items-center gap-3">
            <CopyableValue value={error.requestId} label="Request ID" truncate />
            <OutLink href={logsUrl}>
              <ScrollText className="h-3 w-3" />
              Backend logs
            </OutLink>
          </div>
        </Field>
      </dl>
    </div>
  );
}
