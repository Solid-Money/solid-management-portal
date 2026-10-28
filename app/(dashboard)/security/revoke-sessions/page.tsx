import BulkRevokePanel from "@/components/security/bulk-revoke-panel";

/**
 * Security → Session Revoke.
 *
 * Incident response for account takeover: paste a list of account ids, preview
 * who they are and how many live sessions each holds, then revoke them all at
 * once. Revoke invalidates refresh tokens, so each session ends when its access
 * token expires and the account must sign in again with its passkey — it is not
 * selective, so the real owner is signed out too. Every account's revoke is
 * written to its audit trail with the reason and the admin who ran it.
 */
export default function RevokeSessionsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Session revoke
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign accounts out in bulk during an incident. Preview first to see what
          each revoke would cut off, then revoke. This ends every session on the
          listed accounts — the attacker&apos;s and the real owner&apos;s alike —
          so the owner has to sign in again. It does not close the account or
          move its funds.
        </p>
      </div>

      <BulkRevokePanel />
    </div>
  );
}
