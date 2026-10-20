"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { getVirtualAccountRemoval, removeVirtualAccountData } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  VirtualAccountProvider,
  VirtualAccountRemovalState,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RemoveVirtualAccountDialogProps {
  userId: string;
  username: string;
}

const PROVIDER_LABELS: Record<VirtualAccountProvider, string> = {
  rain: "Rain — USD account",
  wirex: "Wirex — EUR IBAN",
};

/** What gets removed, per provider, so nobody has to infer it from the button. */
const REMOVES: Record<VirtualAccountProvider, string[]> = {
  rain: [
    "Deletes the payment route, so the account details stop working",
    "Deletes the consumer at Rain — this cannot be undone",
    "Clears the Didit verification held for the account",
  ],
  wirex: [
    "Hides the IBAN in the app",
    "Wirex cannot close an IBAN: money still sent to it is paid out as usual",
  ],
};

/** What it deliberately leaves alone. */
const KEEPS = [
  "Deposits, setup-fee payments and Rain's terms agreements",
  "Any card, and the verification it was issued on",
  "The user's country",
];

/** The facts on file for one provider, in a line. */
function factsFor(
  state: VirtualAccountRemovalState,
  provider: VirtualAccountProvider,
): string {
  if (provider === "rain") {
    const rain = state.rain;
    return [
      rain.automationActive ? "account open" : "no account",
      rain.rainApplicationStatus
        ? `application ${rain.rainApplicationStatus}`
        : null,
      rain.verification ? "verification on file" : "no verification",
      rain.hasRainCard ? "Rain card" : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const wirex = state.wirex;
  return [
    wirex.bankAccounts > 0
      ? `IBAN${wirex.ibanLast4 ? ` ··${wirex.ibanLast4}` : ""}`
      : "no IBAN",
    wirex.verification ? "verified with Sumsub" : "not verified",
    wirex.hasWirexCard ? "Wirex card" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Remove one provider's virtual-account data for a user.
 *
 * Two jobs: moving a user who wants the other provider's account (removing the
 * current provider switches them, and the switch sticks over every routing
 * rule), and clearing a leftover — say a Wirex cardholder's old, denied Rain
 * application. The server decides what is removable and says why not; this
 * only shows its answer.
 *
 * As heavy as a 2FA reset: it deletes data at Rain that cannot be restored, so
 * the username has to be typed back and the reason is required. Refused
 * attempts are audited too.
 */
export default function RemoveVirtualAccountDialog({
  userId,
  username,
}: RemoveVirtualAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<VirtualAccountProvider | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const queryClient = useQueryClient();

  const { data: state, isLoading } = useQuery<VirtualAccountRemovalState>({
    queryKey: ["user-virtual-account-removal", userId],
    queryFn: async () => (await getVirtualAccountRemoval(userId)).data.data,
    enabled: open,
  });

  const trimmedReason = reason.trim();
  const selected = provider && state ? state[provider] : null;
  const ready =
    !!selected?.canRemove && !!trimmedReason && confirmation.trim() === username;

  const reset = () => {
    setProvider(null);
    setReason("");
    setConfirmation("");
  };

  const mutation = useMutation({
    mutationFn: async (target: VirtualAccountProvider) =>
      (await removeVirtualAccountData(userId, target, trimmedReason)).data.data,
    onSuccess: (result) => {
      const removed = result.removedProvider === "wirex" ? "Wirex" : "Rain";
      toast.success(
        result.switchedTo
          ? `${removed} data removed for ${username}; their account now comes from ${
              result.switchedTo === "wirex" ? "Wirex" : "Rain"
            }`
          : `${removed} data removed for ${username}`,
      );
      reset();
      setOpen(false);
      queryClient.setQueryData(
        ["user-virtual-account-removal", userId],
        result.state,
      );
      // The onboarding card, the card panel, the audit trail and the user's
      // provider all change with it.
      void queryClient.invalidateQueries({
        queryKey: ["user-virtual-account-onboarding", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-kyc-reset-eligibility", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["user-card", userId] });
      void queryClient.invalidateQueries({ queryKey: ["user", userId] });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can read it and retry.
      void queryClient.invalidateQueries({
        queryKey: ["user-virtual-account-removal", userId],
      });
    },
  });

  const close = () => {
    if (mutation.isPending) return;
    reset();
    setOpen(false);
  };

  const otherProvider: VirtualAccountProvider | null = provider
    ? provider === "rain"
      ? "wirex"
      : "rain"
    : null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <Trash2 className="h-4 w-4" />
        Remove VA data
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove virtual account data</DialogTitle>
            <DialogDescription>
              For{" "}
              <span className="font-medium text-gray-900">{username}</span>,
              to move them to the other provider&apos;s account or to clear a
              leftover application. Their account comes from{" "}
              <span className="font-medium text-gray-900">
                {state
                  ? state.currentProvider === "wirex"
                    ? "Wirex"
                    : "Rain"
                  : "…"}
              </span>{" "}
              now{state?.override ? " (set by an admin)" : ""}.
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading virtual account data…
            </div>
          )}

          {state && (
            <div className="grid gap-2">
              {(["rain", "wirex"] as const).map((key) => {
                const data = state[key];
                const isSelected = provider === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProvider(key)}
                    disabled={!data.canRemove || mutation.isPending}
                    className={cn(
                      "rounded-md border p-3 text-left text-xs transition-colors",
                      isSelected
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200",
                      data.canRemove
                        ? "cursor-pointer hover:bg-gray-50"
                        : "cursor-not-allowed opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">
                        {PROVIDER_LABELS[key]}
                      </span>
                      {data.isCurrent && <Badge variant="info">Current</Badge>}
                    </div>
                    <p className="mt-1 text-gray-500">{factsFor(state, key)}</p>
                    <p className="mt-1 text-gray-700">{data.message}</p>
                  </button>
                );
              })}
            </div>
          )}

          {provider && selected?.canRemove && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-gray-200 p-3 text-xs">
                <p className="font-medium text-gray-900">What this does</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-gray-600">
                  {REMOVES[provider].map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                  {selected.isCurrent && otherProvider && (
                    <li>
                      Moves their virtual account to{" "}
                      {otherProvider === "wirex" ? "Wirex" : "Rain"}; they
                      open it from the app
                    </li>
                  )}
                </ul>
              </div>
              <div className="rounded-md border border-gray-200 p-3 text-xs">
                <p className="font-medium text-gray-900">What it keeps</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-gray-600">
                  {KEEPS.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {provider === "rain" && selected?.canRemove && (
            <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The Rain consumer is deleted at Rain and cannot be restored. If
                the user comes back to Rain they verify and pay the setup fee
                again. Check they have no transfer on its way to these account
                details first.
              </span>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="remove-va-reason">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="remove-va-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ticket link, and why this data should be removed"
              maxLength={500}
              rows={3}
              disabled={mutation.isPending}
            />
            <p className="text-xs text-gray-500">
              Saved to the audit trail with your name. Required.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="remove-va-confirm">
              Type <span className="font-mono">{username}</span> to confirm
            </Label>
            <Input
              id="remove-va-confirm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={username}
              disabled={mutation.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={close}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => provider && mutation.mutate(provider)}
              disabled={mutation.isPending || !ready}
              className="cursor-pointer"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Remove {provider === "wirex" ? "Wirex" : provider === "rain" ? "Rain" : ""}{" "}
              data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
