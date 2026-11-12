"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgePercent, Edit2, Eye, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import FeePromotionModal from "@/components/fee-promotions/fee-promotion-modal";
import { Badge } from "@/components/ui/badge";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Switch } from "@/components/ui/switch";
import {
  useFeePromotions,
  useSaveFeePromotion,
} from "@/hooks/use-fee-promotions";
import {
  FEE_PROMOTION_STATUS_LABEL,
  FEE_PROMOTION_STATUS_VARIANT,
  feePromotionStatus,
  freeDepositsLabel,
  nextStatusChange,
} from "@/lib/fee-promotions";
import { formatUtc } from "@/lib/referral-v4";
import { formatNumber, formatUsd } from "@/lib/utils";
import type { FeePromotion } from "@/types/fee-promotions";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Fee promotions: time-boxed campaigns that make each user's first N fees on
 * one scope free, whatever their tier — first, free SEPA deposits to the euro
 * account.
 *
 * Status is worked out from the switch and the window — Scheduled, Live,
 * Ended or Off — the same way the backend applies it. Switching on and off,
 * the window and the count are for the admins in DEPOSIT_FEE_ADMIN_EMAILS;
 * everyone else sees the list. Promotions are never deleted, only switched
 * off: the fees they waived name them.
 */
export default function FeePromotionsPage() {
  const { data, isLoading, error } = useFeePromotions();
  const save = useSaveFeePromotion();
  const canEdit = data?.canEdit === true;

  const [editing, setEditing] = useState<FeePromotion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toggling, setToggling] = useState<FeePromotion | null>(null);

  const promotions = data?.promotions ?? [];
  const scopes = data?.scopes ?? [];

  // Status is worked out from the clock, so a page left open must move a
  // badge on when a window opens or closes — the backend already has.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const next = nextStatusChange(data?.promotions ?? [], now);
    if (next === null) return;
    // Capped so a far-off boundary never overflows setTimeout; re-armed then.
    const wait = Math.min(Math.max(next - Date.now(), 0) + 1_000, HOUR_MS);
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [data?.promotions, now]);

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  // The confirm button stays clickable while the save is out, and a second
  // click would resend the same version and come back as a false 409.
  const toggleInFlight = useRef(false);
  const confirmToggle = () => {
    if (!toggling || toggleInFlight.current) return;
    toggleInFlight.current = true;
    const { id, name, version, enabled } = toggling;
    save.mutate(
      { id, body: { version, enabled: !enabled } },
      {
        onSuccess: () =>
          toast.success(`“${name}” switched ${enabled ? "off" : "on"}`),
        onSettled: () => {
          toggleInFlight.current = false;
          setToggling(null);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BadgePercent className="h-5 w-5 text-gray-400" />
            Fee promotions
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Make each user&apos;s first fees free for a limited time, whatever
            their tier — e.g. the first 3 SEPA deposits to the euro account.
            Judged by when the deposit arrived (UTC); fees go back to the{" "}
            <Link
              href="/fees-config#fee-bank-deposit"
              className="text-indigo-600 hover:underline"
            >
              normal rates
            </Link>{" "}
            on their own at the end.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && !canEdit && (
            <Badge variant="warning">
              <Eye className="h-3 w-3" />
              View only
            </Badge>
          )}
          {canEdit && (
            <button
              onClick={openCreate}
              className="inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Promotion
            </button>
          )}
        </div>
      </div>

      {data && !canEdit && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You can see promotions but not change them. Changes are limited to
          the admins in <code>DEPOSIT_FEE_ADMIN_EMAILS</code>.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">Failed to load fee promotions.</p>
      ) : promotions.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-lg bg-white py-16 shadow">
          <BadgePercent className="h-12 w-12 text-gray-300" />
          <p className="text-lg text-gray-500">No promotions yet.</p>
          <p className="text-sm text-gray-400">
            A promotion makes each user&apos;s first fees free between a start
            and an end date.
          </p>
          {canEdit && (
            <button
              onClick={openCreate}
              className="inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create First Promotion
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white shadow sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Promotion",
                  "Free per user",
                  "Window (UTC)",
                  "Status",
                  "Given away",
                  "On",
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
              {promotions.map((promotion) => {
                const status = feePromotionStatus(promotion, now);
                return (
                  <tr key={promotion.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">
                        {promotion.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {promotion.scopeLabel}
                      </p>
                      {promotion.updatedByEmail && (
                        <p className="text-xs text-gray-400">
                          last changed by {promotion.updatedByEmail}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold whitespace-nowrap text-gray-900">
                      {freeDepositsLabel(promotion.freeCountPerUser)}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-600">
                      <div>{formatUtc(promotion.startsAt)}</div>
                      <div className="text-xs text-gray-400">
                        to {formatUtc(promotion.endsAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={FEE_PROMOTION_STATUS_VARIANT[status]}>
                        {FEE_PROMOTION_STATUS_LABEL[status]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-600">
                      <div className="font-medium text-gray-900">
                        {formatNumber(promotion.stats.redemptions, 0, 0)} free ·{" "}
                        {formatNumber(promotion.stats.users, 0, 0)} users
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatUsd(promotion.stats.waivedFeeUsd)} in fees on{" "}
                        {formatUsd(promotion.stats.baseAmountUsd, 0)} deposited
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Switch
                        checked={promotion.enabled}
                        onCheckedChange={() => setToggling(promotion)}
                        disabled={!canEdit || save.isPending}
                        aria-label={`${promotion.name} on`}
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canEdit ? (
                        <button
                          onClick={() => {
                            setEditing(promotion);
                            setIsModalOpen(true);
                          }}
                          className="cursor-pointer p-2 text-gray-400 transition-colors hover:text-indigo-600"
                          title="Edit"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
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
        <FeePromotionModal
          promotion={editing}
          scopes={scopes}
          limits={data?.limits}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <ConfirmationModal
        isOpen={!!toggling}
        title={toggling?.enabled ? "Switch promotion off" : "Switch promotion on"}
        message={
          toggling ? (
            toggling.enabled ? (
              <>
                Switch <strong>{toggling.name}</strong> off? Deposits that
                arrive from now on pay the normal fee. Free deposits already
                given stay free.
              </>
            ) : (
              <>
                Switch <strong>{toggling.name}</strong> on? Between{" "}
                {formatUtc(toggling.startsAt)} and {formatUtc(toggling.endsAt)}
                , each user&apos;s first{" "}
                {freeDepositsLabel(toggling.freeCountPerUser)} cost nothing,
                whatever their tier. Applies to: {toggling.scopeLabel}.
              </>
            )
          ) : null
        }
        confirmText={
          save.isPending
            ? "Saving…"
            : toggling?.enabled
              ? "Switch off"
              : "Switch on"
        }
        isDestructive={!!toggling && !toggling.enabled}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />
    </div>
  );
}
