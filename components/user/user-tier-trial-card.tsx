"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";

import {
  getUserTierTrials,
  issueUserTierTrial,
  revokeUserTierTrial,
} from "@/lib/api";
import {
  formatTrialDate,
  tierTrialRemaining,
  tierTrialStatusLabel,
  tierTrialStatusVariant,
} from "@/lib/tier-trial";
import { IssueTierTrialRequest, TierTrial, TierTrialView } from "@/types";
import TierTrialDialog from "@/components/user/tier-trial-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmationModal from "@/components/ui/confirmation-modal";

const TIER_VARIANT: Record<string, "info" | "success"> = {
  prime: "info",
  ultra: "success",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

/** Who did what, in one line — the part the audit trail answers later. */
function issuedByLine(trial: TierTrial): string {
  const who =
    trial.source === "admin_gift"
      ? (trial.issuedBy ?? "an admin")
      : "the welcome offer";

  return `${trial.source === "admin_gift" ? "Gifted by" : "Earned through"} ${who} · ${formatTrialDate(trial.issuedAt)}`;
}

/** One row of the history list. */
function TrialRow({ trial }: { trial: TierTrial }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-gray-100 py-2 text-xs">
      <Badge variant={TIER_VARIANT[trial.tier] ?? "muted"}>{trial.tier}</Badge>
      <Badge variant={tierTrialStatusVariant(trial.status)}>
        {tierTrialStatusLabel(trial.status)}
      </Badge>
      <span className="text-gray-900">{trial.durationDays} days</span>
      <span className="text-gray-500">{issuedByLine(trial)}</span>
      {trial.status === "active" && (
        <span className="text-gray-500">
          Ends {formatTrialDate(trial.expiresAt)}
        </span>
      )}
      {trial.revokedAt && (
        <span className="text-gray-500">
          Revoked by {trial.revokedBy ?? "an admin"}{" "}
          {formatTrialDate(trial.revokedAt)}
          {trial.revokeReason ? ` — ${trial.revokeReason}` : ""}
        </span>
      )}
      {trial.reason && (
        <span className="w-full text-gray-500">Reason: {trial.reason}</span>
      )}
      {trial.giftMessage && (
        <span className="w-full text-gray-500">
          Message: &ldquo;{trial.giftMessage}&rdquo;
        </span>
      )}
      {!!trial.extensions?.length && (
        <span className="w-full text-gray-500">
          Extended{" "}
          {trial.extensions
            .map(
              (extension) =>
                `+${extension.days}d by ${extension.extendedBy ?? "an admin"} on ${formatTrialDate(extension.extendedAt)}`
            )
            .join("; ")}
        </span>
      )}
    </li>
  );
}

/**
 * The user's tier trial: what they have, and the controls for giving or taking
 * one back.
 *
 * A trial is a temporary tier upgrade that leaves the account alone — points
 * and FUSE balances are untouched, and the tier is granted on top while the
 * trial runs. Two consequences are worth having on the screen, because both
 * come up in support conversations:
 *
 * - A gift sits at "waiting for the user" until they accept it in the app. Its
 *   duration has not started, so "I sent it yesterday and they still have 30
 *   days" is correct, not a bug.
 * - When it ends, they return to the tier their points and FUSE already earn.
 *   Nothing is taken away, so revoking is safe in the same way.
 *
 * The open trial is read before the gift form opens, which is what lets the
 * replace/extend decision be put to the operator up front: the backend refuses
 * a second gift that has not made it.
 */
export default function UserTierTrialCard({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const [isGiftOpen, setIsGiftOpen] = useState(false);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ data: TierTrialView }>({
    queryKey: ["user-tier-trial", userId],
    queryFn: async () => (await getUserTierTrials(userId)).data,
  });

  const current = data?.data.current ?? null;
  const history = data?.data.history ?? [];

  // The trial the tier resolver is reading, and the rewards panel next to this
  // one, both move when a trial is issued or revoked.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["user-tier-trial", userId] });
    void queryClient.invalidateQueries({ queryKey: ["user-rewards", userId] });
  };

  const gift = useMutation({
    mutationFn: (request: IssueTierTrialRequest) =>
      issueUserTierTrial(userId, request),
    onSuccess: (response, request) => {
      const result = response.data.data;
      toast.success(
        result.extendedTrialId
          ? `Added ${request.durationDays} days to ${username}'s ${result.trial.tier} trial`
          : `${username} has been gifted ${request.durationDays} days of ${result.trial.tier} — it starts when they activate it`
      );
      setIsGiftOpen(false);
      refresh();
    },
    onError: () => {
      // The API layer already shows the server's message as a toast — which is
      // where the "choose replace or extend" refusal lands. Keep the dialog
      // open so the operator can make that choice and retry.
    },
  });

  const revoke = useMutation({
    mutationFn: () => revokeUserTierTrial(userId),
    onSuccess: () => {
      toast.success(
        `Revoked ${username}'s trial — they are back on the tier they have earned`
      );
      setIsRevokeOpen(false);
      refresh();
    },
    onError: () => setIsRevokeOpen(false),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gray-400" />
          Tier trial
        </CardTitle>
        <div className="flex items-center gap-2">
          {current && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRevokeOpen(true)}
              disabled={revoke.isPending}
              className="cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Revoke
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGiftOpen(true)}
            disabled={isLoading}
            className="cursor-pointer"
          >
            <Gift className="h-3.5 w-3.5" />
            {current ? "Gift another" : "Gift a trial"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load tier trials.</p>
        ) : (
          <div className="space-y-3">
            {current ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={TIER_VARIANT[current.tier] ?? "muted"}>
                    {current.tier}
                  </Badge>
                  <Badge variant={tierTrialStatusVariant(current.status)}>
                    {tierTrialStatusLabel(current.status)}
                  </Badge>
                  {current.source === "promotion" && (
                    <Badge variant="muted">welcome offer</Badge>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Stat label="Duration" value={`${current.durationDays} days`} />
                  <Stat
                    label={current.status === "active" ? "Ends" : "Starts"}
                    value={
                      current.status === "active"
                        ? formatTrialDate(current.expiresAt)
                        : "When they activate it"
                    }
                  />
                  <Stat label="Remaining" value={tierTrialRemaining(current)} />
                </dl>
                <p className="text-xs text-gray-500">{issuedByLine(current)}</p>
                {current.giftMessage && (
                  <p className="text-xs text-gray-500">
                    Message to the user: &ldquo;{current.giftMessage}&rdquo;
                  </p>
                )}
                {current.reason && (
                  <p className="text-xs text-gray-500">
                    Internal reason: {current.reason}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-600">
                No trial. A gift hands them Prime or Ultra for a set number of
                days without changing their points or FUSE balance, and starts
                counting down only once they accept it in the app.
              </p>
            )}

            {history.length > 0 && (
              <div className="pt-1">
                <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                  History
                </h3>
                <ul>
                  {history.map((trial) => (
                    <TrialRow key={trial.id} trial={trial} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Mounted only while open so the form always seeds from the open trial. */}
      {isGiftOpen && (
        <TierTrialDialog
          open
          onOpenChange={setIsGiftOpen}
          username={username}
          existing={current}
          isSaving={gift.isPending}
          onSubmit={(request) => gift.mutate(request)}
        />
      )}

      <ConfirmationModal
        isOpen={isRevokeOpen}
        title="Revoke this tier trial?"
        message={
          current ? (
            <>
              {username} loses the {current.tier} trial
              {current.status === "active"
                ? ` that is running until ${formatTrialDate(current.expiresAt)}`
                : " they have not activated yet"}
              . They return to the tier their points and FUSE balance earn them
              — nothing else about the account changes, and their points are
              untouched.
            </>
          ) : (
            ""
          )
        }
        confirmText={revoke.isPending ? "Revoking…" : "Revoke trial"}
        isDestructive
        onConfirm={() => revoke.mutate()}
        onCancel={() => setIsRevokeOpen(false)}
      />
    </Card>
  );
}
