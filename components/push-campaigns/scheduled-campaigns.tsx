"use client";

import { useState } from "react";
import { CalendarClock, Loader2, Pencil, XCircle } from "lucide-react";
import { toast } from "sonner";

import { CampaignRow } from "@/components/push-campaigns/campaign-history";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import {
  useCancelScheduledPushCampaign,
  usePushCampaigns,
} from "@/hooks/use-push-campaigns";
import { formatLocalSendAt, localTimeZoneLabel } from "@/lib/push-campaigns";
import type {
  PushCampaignSummary,
  PushDestination,
} from "@/types/push-campaigns";

interface ScheduledCampaignsProps {
  destinations: readonly PushDestination[];
  /** Whether this admin may change or cancel (the same rule as sending). */
  canSend: boolean;
  /** Open a scheduled campaign in the composer. */
  onEdit: (campaign: PushCampaignSummary) => void;
  /** The campaign being opened for editing, while it loads. */
  loadingId?: string | null;
  /** Why Edit is unavailable right now, if it is. */
  editBlocker?: string | null;
}

/**
 * Campaigns still to go out, soonest first, each editable or cancellable until
 * the scheduler picks it up. The list refreshes every minute, so one that has
 * just gone out moves to History on its own.
 */
export function ScheduledCampaigns({
  destinations,
  canSend,
  onEdit,
  loadingId,
  editBlocker,
}: ScheduledCampaignsProps) {
  const { data, isLoading, error } = usePushCampaigns();
  const cancel = useCancelScheduledPushCampaign();
  const [cancelling, setCancelling] = useState<PushCampaignSummary | null>(
    null,
  );
  const scheduled = data?.filter((c) => c.status === "scheduled") ?? [];
  const label = (id: string) =>
    destinations.find((d) => d.id === id)?.label ?? id;
  const campaignName = (id: string) =>
    data?.find((c) => c.id === id)?.name ?? id;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-red-600">Failed to load campaigns.</p>;
  }
  if (scheduled.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border bg-white py-16 text-center">
        <CalendarClock className="h-10 w-10 text-gray-300" />
        <p className="text-gray-500">Nothing scheduled.</p>
        <p className="text-xs text-gray-400">
          Turn on &ldquo;Schedule for later&rdquo; when composing a campaign.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Times in your time zone, {localTimeZoneLabel()}. Each goes out within a
        minute of its time, and posts to Slack whether it went out or not.
      </p>
      {scheduled.map((campaign) => (
        <CampaignRow
          key={campaign.id}
          campaign={campaign}
          label={label}
          campaignName={campaignName}
          actions={
            canSend ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(campaign)}
                  disabled={!!loadingId || !!editBlocker || cancel.isPending}
                  title={editBlocker ?? undefined}
                >
                  {loadingId === campaign.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Pencil />
                  )}
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelling(campaign)}
                  disabled={cancel.isPending}
                >
                  {cancel.isPending && cancel.variables === campaign.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <XCircle />
                  )}
                  Cancel
                </Button>
              </div>
            ) : null
          }
        />
      ))}

      <ConfirmationModal
        isOpen={!!cancelling}
        title="Cancel this scheduled campaign?"
        message={
          cancelling ? (
            <>
              &ldquo;{cancelling.name}&rdquo; will not go out
              {cancelling.sendAt
                ? ` on ${formatLocalSendAt(cancelling.sendAt)}`
                : ""}
              . Nothing has been sent yet, and its name becomes free to use
              again.
            </>
          ) : null
        }
        confirmText="Cancel campaign"
        cancelText="Keep it"
        isDestructive
        onCancel={() => setCancelling(null)}
        onConfirm={() => {
          const target = cancelling;
          setCancelling(null);
          if (!target) return;
          cancel.mutate(target.id, {
            onSuccess: () => toast.success(`“${target.name}” cancelled`),
          });
        }}
      />
    </div>
  );
}
