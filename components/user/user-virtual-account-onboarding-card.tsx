"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  getVirtualAccountOnboarding,
  retryVirtualAccountOnboarding,
} from "@/lib/api";
import { formatDateTime, formatUsd } from "@/lib/utils";
import {
  VirtualAccountOnboardingActor,
  VirtualAccountOnboardingState,
  VirtualAccountOnboardingStep,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface UserVirtualAccountOnboardingCardProps {
  userId: string;
  username: string;
}

type BadgeVariant = "success" | "danger" | "warning" | "info" | "muted";

/** How each step reads, and how loud it should be. */
const STEP_LABELS: Record<
  VirtualAccountOnboardingStep,
  { label: string; variant: BadgeVariant }
> = {
  account_open: { label: "Account open", variant: "success" },
  not_started: { label: "Not started", variant: "muted" },
  rain_denied: { label: "Denied by Rain", variant: "danger" },
  fee_unpaid: { label: "Setup fee unpaid", variant: "warning" },
  accept_terms: { label: "Approved — terms not accepted", variant: "info" },
  rain_action_required: { label: "Rain needs more from user", variant: "warning" },
  rain_review: { label: "Rain reviewing", variant: "warning" },
  submit_to_rain: { label: "Stuck before Rain", variant: "danger" },
  verification_declined: { label: "Didit declined", variant: "danger" },
  verification_in_review: { label: "Didit reviewing", variant: "warning" },
  verification_incomplete: { label: "Verification unfinished", variant: "warning" },
};

const ACTOR_LABELS: Record<VirtualAccountOnboardingActor, string> = {
  admin: "Us — retry below",
  user: "The user, in the app",
  rain: "Rain",
  didit: "Didit",
  none: "Nobody",
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/**
 * Where a user's Rain virtual-account (USD ACH/wire) onboarding is stuck, who
 * has to move next, and the one thing support can do about it.
 *
 * Most stuck applicants are waiting on themselves — a verification never
 * finished, terms never accepted — and the card says so rather than offering a
 * button that cannot help. The retry is only enabled when Didit approved the
 * user but the application never reached Rain, which is the one hand-off that
 * is ours to finish.
 */
export default function UserVirtualAccountOnboardingCard({
  userId,
  username,
}: UserVirtualAccountOnboardingCardProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<VirtualAccountOnboardingState>({
    queryKey: ["user-virtual-account-onboarding", userId],
    queryFn: async () => (await getVirtualAccountOnboarding(userId)).data.data,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      (await retryVirtualAccountOnboarding(userId, reason.trim() || undefined))
        .data.data,
    onSuccess: (result) => {
      if (result.forwardStatus === "success") {
        toast.success(`Application submitted to Rain for ${username}`);
      } else {
        // Reached the forward but Rain did not take it — a validation failure,
        // or a held deposit for a fee that was never actually paid.
        toast.warning(
          `Not submitted (${result.forwardStatus ?? "unknown"}): ${
            result.forwardError ?? "no reason given"
          }`,
        );
      }
      setReason("");
      setOpen(false);
      queryClient.setQueryData(
        ["user-virtual-account-onboarding", userId],
        result.state,
      );
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-kyc-reset-eligibility", userId],
      });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can read it and retry.
    },
  });

  const step = data ? STEP_LABELS[data.step] : null;
  const rain = data?.rainApplication;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-gray-500" />
          USD virtual account
        </CardTitle>
        {data && (
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            disabled={!data.canRetry}
            title={data.canRetry ? undefined : data.message}
            className="cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Retry onboarding
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading virtual account onboarding…
          </div>
        )}

        {!isLoading && !data && (
          <p className="text-sm text-gray-500">
            Could not load virtual account onboarding.
          </p>
        )}

        {data && step && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Step"
                value={<Badge variant={step.variant}>{step.label}</Badge>}
              />
              <Stat label="Next to act" value={ACTOR_LABELS[data.nextActor]} />
              <Stat
                label="Setup fee"
                value={
                  data.fee.paid
                    ? `Paid ${formatUsd(data.fee.feeUsd)}`
                    : data.fee.satisfied
                      ? "Not owed"
                      : `Unpaid (${formatUsd(data.fee.feeUsd)})`
                }
                hint={
                  data.fee.paidAt ? formatDateTime(data.fee.paidAt) : undefined
                }
              />
              <Stat
                label="Account"
                value={
                  data.account
                    ? `${data.account.status}${data.account.rail ? ` · ${data.account.rail.toUpperCase()}` : ""}`
                    : "None"
                }
                hint={
                  data.account?.createdAt
                    ? formatDateTime(data.account.createdAt)
                    : undefined
                }
              />
            </dl>

            <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {data.message}
            </p>

            {rain && (
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat
                  label="Didit (ours)"
                  value={rain.diditVerificationStatus ?? "—"}
                  hint={
                    rain.liveDiditStatus &&
                    rain.liveDiditStatus !== rain.diditVerificationStatus
                      ? `Didit now says: ${rain.liveDiditStatus}`
                      : undefined
                  }
                />
                <Stat label="KYC status" value={rain.kycStatus ?? "—"} />
                <Stat
                  label="Rain"
                  value={rain.rainApplicationStatus ?? "Not submitted"}
                  hint={
                    rain.forwardPendingDeposit
                      ? "Held on the card deposit gate"
                      : undefined
                  }
                />
                <Stat
                  label="Rain consumer"
                  value={rain.consumerCreated ? "Created" : "None"}
                />
              </dl>
            )}

            {rain &&
              (rain.rainApplicationReasons.length > 0 ||
                rain.diditRiskCodes.length > 0) && (
                <div className="rounded-md border border-gray-200 p-3 text-xs">
                  <p className="font-medium text-gray-500">Reason codes</p>
                  <p className="mt-1 break-words font-mono text-gray-900">
                    {[...rain.rainApplicationReasons, ...rain.diditRiskCodes].join(
                      ", ",
                    )}
                  </p>
                </div>
              )}
          </div>
        )}
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (mutation.isPending) return;
          setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retry virtual account onboarding</DialogTitle>
            <DialogDescription>
              Submits{" "}
              <span className="font-medium text-gray-900">{username}</span>
              &apos;s Didit-approved verification to Rain. It never creates a
              second Rain consumer and never submits an unapproved
              verification. Once Rain approves them, the user opens the
              account by accepting the terms in the app.
            </DialogDescription>
          </DialogHeader>

          {data && (
            <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
              {data.message}
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="va-retry-reason">Reason</Label>
            <Textarea
              id="va-retry-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ticket link (optional)"
              maxLength={500}
              rows={3}
              disabled={mutation.isPending}
            />
            <p className="text-xs text-gray-500">
              Saved to the audit trail with your name.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !data?.canRetry}
              className="cursor-pointer"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit to Rain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
