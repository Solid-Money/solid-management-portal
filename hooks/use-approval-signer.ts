import { useCallback } from "react";

import { getSigningMessage } from "@/lib/api";
import { signApprovalMessage } from "@/lib/turnkey-signing";
import { useSigningOverview } from "@/hooks/use-admin-access";
import type { ApprovalSignature } from "@/types/admin-access";

/**
 * Signs approvals with the admin's passkey, when approval signing is on.
 *
 * - `signs`: approving will ask for the passkey.
 * - `blocked`: signing is required and this admin can't sign yet; say why.
 * - `sign(ids)`: one signature over every request in `ids` — one prompt for a
 *   bulk approval — or undefined when signing is off or optional and this
 *   admin isn't set up, so the approval goes through unsigned as before.
 */
export function useApprovalSigner() {
  const { data: overview } = useSigningOverview();

  const active = !!overview?.active;
  const ready =
    active &&
    !!overview?.me.turnkey?.rank &&
    !!overview.pinned.subOrganizationId &&
    !!overview.pinned.walletAddress;
  const blocked =
    active && overview?.mode === "required" && !ready
      ? "Approvals are signed with your admin passkey, and yours isn't set up yet. Set it up under Config → Internal Team → Approval signing."
      : null;

  const sign = useCallback(
    async (ids: string[]): Promise<ApprovalSignature | undefined> => {
      if (!ready || !overview) {
        if (blocked) throw new Error(blocked);
        return undefined;
      }
      const { data } = await getSigningMessage(ids);
      const activityId = await signApprovalMessage({
        subOrganizationId: overview.pinned.subOrganizationId!,
        walletAddress: overview.pinned.walletAddress!,
        message: data.data.message,
      });
      return { activityId, ids: data.data.ids };
    },
    [ready, overview, blocked]
  );

  return { signs: ready, blocked, sign };
}
