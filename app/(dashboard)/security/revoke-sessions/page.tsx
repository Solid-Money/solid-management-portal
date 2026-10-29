import { KeyRound, ShieldAlert, ShieldX } from "lucide-react";

import BulkRevokePanel from "@/components/security/bulk-revoke-panel";
import SecurityClosePanel from "@/components/security/security-close-panel";
import FakePasskeyPanel from "@/components/security/fake-passkey-panel";
import CollapsibleSection from "@/components/ui/collapsible-section";

/**
 * Security → Revoke.
 *
 * Incident-response tooling for account takeover, grouped into one place and
 * each kept behind a collapsed section so an operator opens only the one they
 * need:
 *
 * - Revoke sessions — sign a list of accounts out (refresh tokens invalidated).
 * - Security-close accounts — unlink each Safe and close the row for good.
 * - Remove fake passkey — strip an injected credential that breaks owners'
 *   passkey prompts.
 *
 * Every action previews first and writes to the audit trail.
 */
export default function RevokePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Revoke</h1>
        <p className="mt-1 text-sm text-gray-500">
          Incident-response tools for account takeover. Each section is collapsed
          — open the one you need. Every action previews first and is written to
          the audit trail.
        </p>
      </div>

      <CollapsibleSection
        title="Revoke sessions"
        description="Sign a list of accounts out — the attacker's and the real owner's alike. Does not close the account or move funds."
        icon={ShieldAlert}
      >
        <BulkRevokePanel />
      </CollapsibleSection>

      <CollapsibleSection
        title="Security-close accounts"
        description="Unlink each Safe and close the row for good: sessions, two-factor and card spending removed. Final — cannot be recovered."
        icon={ShieldX}
      >
        <SecurityClosePanel />
      </CollapsibleSection>

      <CollapsibleSection
        title="Remove fake passkey"
        description="Strip an injected credential left across accounts, so the real owners' passkey prompts work again. Keeps each owner's real passkey."
        icon={KeyRound}
      >
        <FakePasskeyPanel />
      </CollapsibleSection>
    </div>
  );
}
