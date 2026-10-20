"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getCardRelinkContext, relinkUserCard } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { CardRelinkCandidate, CardRelinkContext } from "@/types";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DATE_ONLY: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

/** How loudly each Wirex card status reads. */
function statusVariant(
  issuerStatus?: string,
): "success" | "warning" | "info" | "muted" {
  switch (issuerStatus) {
    case "Active":
      return "success";
    case "Blocked":
      return "warning";
    case "Closed":
      return "muted";
    default:
      return "info";
  }
}

/** What re-linking this card leaves the cardholder with, when it is not plain "active". */
function statusNote(candidate: CardRelinkCandidate): string | null {
  switch (candidate.issuerStatus) {
    case "Blocked":
      return "Blocked at Wirex, so it comes back frozen.";
    case "Requested":
    case "NotActivated":
      return "Wirex has not opened this card yet; it shows as pending until it does.";
    default:
      return null;
  }
}

/** One card at the issuer, as a choice — or, when it cannot be re-linked, why not. */
function CandidateOption({
  candidate,
  selected,
  disabled,
  onSelect,
}: {
  candidate: CardRelinkCandidate;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const blocked = !!candidate.blockedReason;
  const note = statusNote(candidate);

  return (
    <label
      className={cn(
        "flex gap-3 rounded-md border p-3",
        blocked
          ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-75"
          : selected
            ? "cursor-pointer border-indigo-500 bg-indigo-50"
            : "cursor-pointer border-gray-200 bg-white hover:bg-gray-50",
      )}
    >
      <input
        type="radio"
        name="relink-card"
        checked={selected}
        onChange={onSelect}
        disabled={blocked || disabled}
        className="mt-1 h-4 w-4 cursor-pointer accent-indigo-600 disabled:cursor-not-allowed"
      />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-sm text-gray-900">
            •••• {candidate.last4 ?? "????"}
            {candidate.expiration ? ` · exp ${candidate.expiration}` : ""}
            {candidate.type ? ` · ${candidate.type}` : ""}
          </span>
          <Badge variant={statusVariant(candidate.issuerStatus)}>
            {candidate.issuerStatus ?? candidate.status}
          </Badge>
        </span>
        <span className="block text-xs text-gray-600">
          {candidate.issuedAt
            ? `Issued ${formatDateTime(candidate.issuedAt, DATE_ONLY)}`
            : "Issue date unknown"}
          {" · "}
          {candidate.lastUsedAt
            ? `last used ${formatDateTime(candidate.lastUsedAt)}`
            : "no use on record"}
          {candidate.hasPayments ? "" : " · never spent with"}
        </span>
        <span className="block text-[11px] break-all text-gray-500">
          {candidate.cardId}
        </span>
        {blocked ? (
          <span className="block text-xs text-amber-800">
            {candidate.blockedReason}
          </span>
        ) : (
          note && <span className="block text-xs text-gray-600">{note}</span>
        )}
      </span>
    </label>
  );
}

/**
 * The form, mounted only once the issuer has answered, so the selection can
 * seed itself from `context.suggestedCardId` at mount rather than through an
 * effect that runs a render late.
 */
function RelinkCardForm({
  userId,
  username,
  context,
  onSavingChange,
  onRelinked,
  onCancel,
}: {
  userId: string;
  username: string;
  context: CardRelinkContext;
  onSavingChange: (saving: boolean) => void;
  onRelinked: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [cardId, setCardId] = useState(context.suggestedCardId ?? "");
  const [reason, setReason] = useState("");

  const trimmedReason = reason.trim();
  const selected = context.candidates.find(
    (candidate) => candidate.cardId === cardId && !candidate.blockedReason,
  );
  const blockingProblem = !selected
    ? "Pick the card to re-link."
    : !trimmedReason
      ? "A reason is required."
      : undefined;

  const mutation = useMutation({
    mutationFn: async () =>
      (await relinkUserCard(userId, { cardId, reason: trimmedReason })).data
        .data,
    onMutate: () => onSavingChange(true),
    onSettled: () => onSavingChange(false),
    onSuccess: (result) => {
      toast.success(
        `Card re-linked for ${username}` +
          (result.last4 ? ` (•••• ${result.last4})` : "") +
          (result.status === "frozen" ? " — it is frozen" : ""),
      );
      onRelinked();
      // The card panel, its history, the balances and the trail all move
      // together, and the issue dialog now has a card to describe.
      for (const key of [
        "user-card",
        "user-card-audit-history",
        "user-balances",
        "user-card-issuance-context",
        "user-card-relink-context",
        "user-audit-log",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key, userId] });
      }
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the operator can correct and retry.
    },
  });

  const busy = mutation.isPending;

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
          <p>
            Closing an account removes the link between it and its card; the
            card itself is never cancelled at Wirex, and reopening the account
            does not bring the link back. Re-linking restores it — nothing is
            issued, cancelled or moved.
          </p>
          <p className="text-indigo-700">
            The card keeps its number and spends from the same balance as
            before. Confirm the account&apos;s owner wants it back before you
            do this: it can spend as soon as it is linked.
          </p>
        </div>

        {context.providerCustomerId && (
          <p className="text-xs text-gray-500">
            Cards Wirex holds for wallet{" "}
            <span className="font-mono break-all text-gray-700">
              {context.providerCustomerId}
            </span>
          </p>
        )}

        <div className="space-y-2">
          {context.candidates.map((candidate) => (
            <CandidateOption
              key={candidate.cardId}
              candidate={candidate}
              selected={candidate.cardId === cardId}
              disabled={busy}
              onSelect={() => setCardId(candidate.cardId)}
            />
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="relink-reason">Reason</Label>
          <Textarea
            id="relink-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="e.g. Account closed by mistake and reopened; owner confirmed in Intercom"
            disabled={busy}
          />
          <p className="text-muted-foreground text-xs">
            Required. Recorded in the audit trail and posted to Slack with your
            name and the user&apos;s.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={busy}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={busy || !!blockingProblem}
          title={blockingProblem}
          className="cursor-pointer"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Re-link card
        </Button>
      </DialogFooter>
    </>
  );
}

interface RelinkCardDialogProps {
  userId: string;
  username: string;
}

/**
 * Attach a card the issuer still holds back to this user's account.
 *
 * ## Why this exists
 *
 * Closing an account deletes the row that ties it to its card, and Wirex is
 * never told: the card stays open and keeps sending us its payments. Reopening
 * the account brings back everything except that row, so the app offers
 * "Activate card" (a brand-new card, which Wirex refuses in countries it has
 * stopped issuing in) while every purchase on the card they still hold is
 * declined. Rain cards re-link themselves when the cardholder opens Card; a
 * Wirex card needed an engineer in the database until this.
 *
 * ## Why the list comes from the issuer
 *
 * Support picks from the cards Wirex itself lists for the cardholder's wallet,
 * never from a typed id, so a card that is not theirs cannot be attached. The
 * backend refuses a card closed at Wirex, one another account holds, and one
 * our ledger ties to another user, and says why next to it.
 */
export default function RelinkCardDialog({
  userId,
  username,
}: RelinkCardDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery<{ data: CardRelinkContext }>({
    queryKey: ["user-card-relink-context", userId],
    queryFn: async () => (await getCardRelinkContext(userId)).data,
    // Only asked for while the dialog is open: it calls the issuer for the
    // live card list, which is worth doing when support is about to act.
    enabled: open,
    staleTime: 0,
  });

  const context = data?.data;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <Link2 className="h-4 w-4" />
        Re-link card
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (saving) return;
          setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-gray-400" />
              Re-link a card for {username}
            </DialogTitle>
            <DialogDescription>
              For an account that was closed and reopened, which lost the link
              to the card it still holds. Pick the card to attach back —
              everything you do here is recorded against your name.
            </DialogDescription>
          </DialogHeader>

          {isLoading || !context ? (
            <div className="flex justify-center py-8">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              ) : (
                <p className="text-sm text-gray-500">
                  Could not read this user&apos;s cards from the issuer. Close
                  this and try again.
                </p>
              )}
            </div>
          ) : !context.canRelink ? (
            <>
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{context.blockedReason}</span>
              </div>
              {context.candidates.length > 0 && (
                <div className="space-y-2">
                  {context.candidates.map((candidate) => (
                    <CandidateOption
                      key={candidate.cardId}
                      candidate={candidate}
                      selected={false}
                      disabled
                      onSelect={() => undefined}
                    />
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="cursor-pointer"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <RelinkCardForm
              userId={userId}
              username={username}
              context={context}
              onSavingChange={setSaving}
              onRelinked={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
