"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { resetKycVerification } from "@/lib/api";
import { KycResetEligibility } from "@/types";
import { Button } from "@/components/ui/button";
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

interface ResetKycDialogProps {
  userId: string;
  username: string;
  eligibility: KycResetEligibility;
}

/** What the reset does, so nobody has to infer it from the button label. */
const DOES = [
  "Puts their verification back to not started, so the app lets them in again",
  "Clears the stored decision and its reason codes",
  "Lets them start a fresh session, with a fresh set of document attempts",
];

/** What it deliberately leaves alone — the half that causes wrong expectations. */
const DOES_NOT = [
  "Overturn what Didit or Sumsub decided — they judge the new attempt on its own",
  "Delete the issuer consumer or touch any card the user holds",
  "Change anything at Rain or Wirex",
];

/**
 * Clear a declined identity verification so the user can try again.
 *
 * The reason is required: this lets someone a provider already declined back
 * into the flow, so "who reopened this, and on whose word?" has to be
 * answerable from the audit trail afterwards. Refused attempts are recorded
 * too, which is why the dialog can be opened on an ineligible user at all —
 * it just will not submit.
 */
export default function ResetKycDialog({
  userId,
  username,
  eligibility,
}: ResetKycDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const trimmedReason = reason.trim();

  const mutation = useMutation({
    mutationFn: async () =>
      (await resetKycVerification(userId, trimmedReason)).data.data,
    onSuccess: () => {
      toast.success(`Verification reset for ${username}`);
      setReason("");
      setOpen(false);
      // The KYC card, the card panel and the audit trail all change with it.
      void queryClient.invalidateQueries({
        queryKey: ["user-kyc-reset-eligibility", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["user-card", userId] });
      void queryClient.invalidateQueries({ queryKey: ["user", userId] });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry or copy the reason.
    },
  });

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!eligibility.eligible}
        className="cursor-pointer"
      >
        <RotateCcw className="h-4 w-4" />
        Reset verification
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (mutation.isPending) return;
          setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset identity verification</DialogTitle>
            <DialogDescription>
              This lets{" "}
              <span className="font-medium text-gray-900">{username}</span> start
              identity verification again from scratch.
            </DialogDescription>
          </DialogHeader>

          {eligibility.reasonCodes.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
              <p className="font-medium text-gray-500">
                Declined by {eligibility.kycProvider ?? "the provider"} for
              </p>
              <p className="mt-1 break-words font-mono text-gray-900">
                {eligibility.reasonCodes.join(", ")}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-gray-200 p-3 text-xs">
              <p className="font-medium text-gray-900">What this does</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-gray-600">
                {DOES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-gray-200 p-3 text-xs">
              <p className="font-medium text-gray-900">What it does not do</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-gray-600">
                {DOES_NOT.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>

          {eligibility.providerDecisionIsFinal && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {eligibility.kycProvider === "sumsub" ? "Sumsub" : "The provider"}{" "}
                marked this decision <strong>FINAL</strong>. Resetting reopens
                our side only — the same applicant will be judged the same way
                unless it is also reset with the provider. Clear that first, or
                the user will simply be declined again.
              </span>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="reset-kyc-reason">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reset-kyc-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ticket link, and why this verification should be reopened"
              maxLength={500}
              rows={3}
              disabled={mutation.isPending}
            />
            <p className="text-xs text-gray-500">
              Saved to the audit trail with your name. Required.
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
              disabled={
                mutation.isPending ||
                !trimmedReason ||
                !eligibility.eligible
              }
              className="cursor-pointer"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Reset verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
