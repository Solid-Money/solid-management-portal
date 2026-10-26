"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { fakePasskeyCleanup, fakePasskeyPreview } from "@/lib/api";
import type {
  PasskeyCleanupPreview,
  PasskeyCleanupResult,
} from "@/types/bulk-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConfirmationModal from "@/components/ui/confirmation-modal";

const CREDENTIAL_ID = /^[A-Za-z0-9_-]{1,512}$/;

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={
          "text-lg font-semibold tabular-nums " +
          (tone === "warn" && value > 0 ? "text-amber-700" : "text-gray-900")
        }
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

/**
 * Remove an injected passkey credential (the fake one the Oct 2026 pollution
 * left on thousands of accounts). Preview counts how far it has spread; execute
 * strips it from every account that keeps a real credential and deletes its
 * passkeydetails rows. Accounts whose only credential is the fake are left
 * untouched (reported as "left with none") — they need a Turnkey-side restore,
 * not a blind purge, so no owner is locked out.
 */
export default function FakePasskeyPanel() {
  const [credentialId, setCredentialId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The exact credential the latest preview ran against, so execute can only run
  // on a value that was reviewed.
  const [previewedId, setPreviewedId] = useState<string | null>(null);
  const [result, setResult] = useState<PasskeyCleanupResult | null>(null);

  const trimmedId = credentialId.trim();
  const validId = CREDENTIAL_ID.test(trimmedId);

  const previewMutation = useMutation({
    mutationFn: async (id: string) =>
      (await fakePasskeyPreview(id)).data.data as PasskeyCleanupPreview,
    onSuccess: (_data, id) => {
      setPreviewedId(id);
      setResult(null);
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (vars: { credentialId: string; reason: string }) =>
      (await fakePasskeyCleanup(vars.credentialId, vars.reason)).data
        .data as PasskeyCleanupResult,
    onMutate: () => setResult(null),
    onSuccess: (data) => {
      setResult(data);
      toast.success(
        `Removed from ${data.accountsModified.toLocaleString()} account(s); ` +
          `${data.passkeyDetailsDeleted.toLocaleString()} passkey detail(s) deleted.`,
      );
    },
  });

  const preview = previewMutation.data ?? null;
  const previewMatchesInput = !!previewedId && previewedId === trimmedId;
  const previewStale = !!preview && !previewMatchesInput;

  const canPreview =
    validId && !previewMutation.isPending && !executeMutation.isPending;
  const canExecute = useMemo(
    () =>
      previewMatchesInput &&
      reason.trim().length > 0 &&
      !previewMutation.isPending &&
      !executeMutation.isPending,
    [
      previewMatchesInput,
      reason,
      previewMutation.isPending,
      executeMutation.isPending,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div>
          <label
            htmlFor="fp-credential"
            className="text-sm font-medium text-gray-900"
          >
            Credential ID
          </label>
          <p className="mt-0.5 text-xs text-gray-500">
            The injected WebAuthn credential id to remove (e.g.{" "}
            <span className="font-mono">GJnCPuZ4ZpjfcWNYhDWcTw</span>).
          </p>
          <Input
            id="fp-credential"
            value={credentialId}
            onChange={(e) => setCredentialId(e.target.value)}
            placeholder="GJnCPuZ4ZpjfcWNYhDWcTw"
            className="mt-2 font-mono text-xs"
          />
          {trimmedId.length > 0 && !validId ? (
            <div className="mt-2">
              <Badge variant="destructive" className="font-normal">
                not a WebAuthn credential id
              </Badge>
            </div>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="fp-reason"
            className="text-sm font-medium text-gray-900"
          >
            Reason
          </label>
          <p className="mt-0.5 text-xs text-gray-500">
            Written to the audit trail. Usually the incident or ticket.
          </p>
          <Input
            id="fp-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Oct 2026 heal-pollution — remove attacker credential"
            className="mt-2"
            maxLength={500}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={!canPreview}
            onClick={() => previewMutation.mutate(trimmedId)}
          >
            {previewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Preview
          </Button>
          <Button
            variant="destructive"
            disabled={!canExecute}
            onClick={() => setConfirmOpen(true)}
            title={
              !previewMatchesInput
                ? "Preview this credential before removing"
                : reason.trim().length === 0
                  ? "A reason is required"
                  : undefined
            }
          >
            {executeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Remove credential
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          {previewStale ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              The credential id changed since this preview. Preview again before
              removing.
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Accounts carrying it" value={preview.accounts} />
            <Stat label="Passkey-detail rows" value={preview.passkeyDetails} />
            <Stat label="Will be removed from" value={preview.removable} />
            <Stat label="Left with none (skipped)" value={preview.orphaned} tone="warn" />
          </div>
          {preview.orphaned > 0 ? (
            <p className="text-xs text-amber-700">
              {preview.orphaned.toLocaleString()} account(s) have this as their
              only credential and are left untouched — removing it would leave
              them with no passkey. They need a Turnkey-side restore, not this
              tool.
            </p>
          ) : null}
          {result ? (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              Removed from {result.accountsModified.toLocaleString()} account(s);{" "}
              {result.passkeyDetailsDeleted.toLocaleString()} passkey detail(s)
              deleted. Run by {result.adminUsername}.
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={confirmOpen}
        isDestructive
        title="Remove passkey credential"
        confirmText="Remove credential"
        message={
          <span>
            This strips <span className="font-mono">{trimmedId}</span> from{" "}
            <strong>{preview?.removable.toLocaleString() ?? 0}</strong>{" "}
            account(s) that keep a real credential, and deletes{" "}
            <strong>{preview?.passkeyDetails.toLocaleString() ?? 0}</strong>{" "}
            passkey-detail row(s). Each owner keeps their real passkey. It does
            not touch Turnkey — if the attacker registered this as a real Turnkey
            authenticator, revoke it there separately.
          </span>
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          if (!previewMatchesInput) return;
          executeMutation.mutate({
            credentialId: trimmedId,
            reason: reason.trim(),
          });
        }}
      />
    </div>
  );
}
