"use client";

import { useState } from "react";
import { Edit2, Eye, Loader2, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import ReferralBoostModal from "@/components/referral-boost-modal";
import { NotAvailableYet } from "@/components/referral-v4/not-available";
import { Badge } from "@/components/ui/badge";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import {
  useDeleteReferralBoost,
  useReferralBoosts,
  useReferralV4Access,
} from "@/hooks/use-referral-v4";
import {
  BOOST_SIDES_LABELS,
  BOOST_STATUS_VARIANT,
  boostStatus,
  formatUtc,
  isNotAvailable,
  referralV4StepLabel,
} from "@/lib/referral-v4";
import { formatUsd } from "@/lib/utils";
import type { ReferralBoostAdmin } from "@/types/referral-v4";

/**
 * Referral boosts: limited-time multipliers on referral v4 card credit
 * bonuses ("double credit for two weeks").
 *
 * Laid out like Campaigns. Status is worked out from the window and the
 * enabled switch — Scheduled, Live, Ended or Disabled — so it can't drift
 * from what the backend applies. Create, edit and delete are for the admins
 * who can edit the referral v4 config; everyone else sees the list.
 */
export default function ReferralBoostsPage() {
  const access = useReferralV4Access();
  const canEdit = access.data?.canEditConfig === true;
  const { data, isLoading, error } = useReferralBoosts();
  const remove = useDeleteReferralBoost();

  const [editing, setEditing] = useState<ReferralBoostAdmin | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<ReferralBoostAdmin | null>(null);

  const boosts = [...(data ?? [])].sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );
  const notAvailable = !!error && isNotAvailable(error);

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const name = deleting.name;
    remove.mutate(deleting.id, {
      onSuccess: () => toast.success(`Boost “${name}” deleted`),
      onSettled: () => setDeleting(null),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Zap className="h-5 w-5 text-gray-400" />
            Referral boosts
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Limited-time multipliers on referral v4 card credit bonuses —
            welcome, big spender and upgrade — earned inside the window (UTC).
            Boosted credit doesn&apos;t count toward the per-friend cap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!canEdit && !access.isLoading && (
            <Badge variant="warning">
              <Eye className="h-3 w-3" />
              View only
            </Badge>
          )}
          {canEdit && !notAvailable && (
            <button
              onClick={openCreate}
              className="inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Boost
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : notAvailable ? (
        <NotAvailableYet what="Referral boosts" />
      ) : error ? (
        <p className="text-sm text-red-600">Failed to load referral boosts.</p>
      ) : boosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-lg bg-white py-16 shadow">
          <Zap className="h-12 w-12 text-gray-300" />
          <p className="text-lg text-gray-500">No boosts yet.</p>
          <p className="text-sm text-gray-400">
            A boost multiplies the card credit friends and referrers earn for
            a limited time.
          </p>
          {canEdit && (
            <button
              onClick={openCreate}
              className="inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create First Boost
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white shadow sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Boost",
                  "Multiplier",
                  "Window (UTC)",
                  "Bonuses",
                  "Sides",
                  "Status",
                  "Credit granted",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                  >
                    {heading}
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {boosts.map((boost) => {
                const status = boostStatus(boost);
                return (
                  <tr key={boost.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">
                        {boost.name}
                      </p>
                      {boost.createdBy && (
                        <p className="text-xs text-gray-400">
                          by {boost.createdBy}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ×{boost.multiplier}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-600">
                      <div>{formatUtc(boost.startsAt)}</div>
                      <div className="text-xs text-gray-400">
                        to {formatUtc(boost.endsAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {boost.steps.map((step) => (
                          <Badge key={step} variant="muted">
                            {referralV4StepLabel(step)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {BOOST_SIDES_LABELS[boost.sides] ?? boost.sides}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={BOOST_STATUS_VARIANT[status]}>
                        {status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-green-700">
                      {formatUsd(boost.creditGrantedUsd ?? 0)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canEdit ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setEditing(boost);
                              setIsModalOpen(true);
                            }}
                            className="cursor-pointer p-2 text-gray-400 transition-colors hover:text-indigo-600"
                            title="Edit"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setDeleting(boost)}
                            className="cursor-pointer p-2 text-gray-400 transition-colors hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <ReferralBoostModal
          boost={editing}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <ConfirmationModal
        isOpen={!!deleting}
        title="Delete boost"
        message={
          deleting ? (
            <>
              Delete <strong>{deleting.name}</strong>?{" "}
              {boostStatus(deleting) === "Live"
                ? "It is live: bonuses earned from now on won't be boosted. "
                : ""}
              Credit it already granted stays with the users. This can&apos;t
              be undone.
            </>
          ) : null
        }
        confirmText={remove.isPending ? "Deleting…" : "Delete"}
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
