"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  getTierLockReevaluationPreview,
  reevaluateTierLock,
} from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import {
  TierLockReevaluationPreview,
  TierLockReevaluationResult,
  TierLockThresholds,
  TierLockThresholdsSource,
  TierLockTrancheValueSource,
} from "@/types";
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

const formatFuse = (amount: number) =>
  `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} FUSE`;

const formatPrices = ({ tier2Amount, tier3Amount }: TierLockThresholds) =>
  `Prime ${formatFuse(tier2Amount)} · Ultra ${formatFuse(tier3Amount)}`;

/** Where a tranche's lock-time value came from, in support's words. */
const SOURCE_LABEL: Record<TierLockTrancheValueSource, string> = {
  recorded: "already recorded",
  activity: "from the lock activity",
  live: "today's value (no record found)",
};

/** Where the lock's pinned prices came from, in support's words. */
const PRICES_SOURCE_LABEL: Record<TierLockThresholdsSource, string> = {
  existing: "already pinned on the lock's record",
  "lock-time": "the price on the day it was locked",
  admin: "entered here",
  live: "today's price — the price when it was locked was not on record",
};

/**
 * The two prices support typed, or why they cannot be pinned.
 *
 * Mirrors the backend's checks so the button can say what is wrong before
 * anything is sent: pinned prices cannot be edited afterwards.
 */
function parsePrices(
  prime: string,
  ultra: string,
): { prices: TierLockThresholds } | { error: string } {
  if (prime.trim() === "" || ultra.trim() === "") {
    return { error: "Enter both prices. Use 0 for a tier that was not on sale." };
  }
  const tier2Amount = Number(prime);
  const tier3Amount = Number(ultra);
  if (
    !Number.isFinite(tier2Amount) ||
    !Number.isFinite(tier3Amount) ||
    tier2Amount < 0 ||
    tier3Amount < 0
  ) {
    return { error: "Prices must be zero or more FUSE." };
  }
  if (tier2Amount === 0 && tier3Amount === 0) {
    return { error: "At least one tier must have a price." };
  }
  if (tier2Amount > 0 && tier3Amount > 0 && tier3Amount <= tier2Amount) {
    return { error: "Ultra must cost more than Prime — are they swapped?" };
  }
  return { prices: { tier2Amount, tier3Amount } };
}

/**
 * Support's answer to "I locked 50,000 FUSE and I'm still Core".
 *
 * A lock is graded on what each tranche was worth when it was locked, but only
 * once that value is recorded — and locks from before it was recorded are
 * still graded on the live soFUSE rate, which can dip below what the user
 * paid. This re-reads the lock from the chain, records the missing values and
 * shows the tier before and after. It can only hold a tier up, never take one
 * away, and pressing it twice changes nothing the second time.
 *
 * It also writes the lock's record when it has none — the app never confirmed
 * the lock — and that record pins the lock's prices for the rest of its term.
 * They are the prices on the day it was locked, never today's; when that day's
 * price is not on record, this dialog asks for it rather than guess.
 */
export default function ReevaluateTierLockDialog({
  userId,
}: {
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [prime, setPrime] = useState("");
  const [ultra, setUltra] = useState("");
  const [result, setResult] = useState<TierLockReevaluationResult | null>(null);
  const queryClient = useQueryClient();

  const preview = useQuery({
    queryKey: ["tier-lock-reevaluation-preview", userId],
    queryFn: async () =>
      (await getTierLockReevaluationPreview(userId)).data.data,
    enabled: open && !result,
    // Read fresh each time the dialog opens: it is answering "what is on chain
    // and on record right now".
    staleTime: 0,
    retry: false,
  });

  const needsPrices = preview.data?.needsThresholds === true;
  const parsed = needsPrices ? parsePrices(prime, ultra) : null;
  const pricesError = parsed && "error" in parsed ? parsed.error : null;

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await reevaluateTierLock(
          userId,
          reason.trim(),
          parsed && "prices" in parsed ? parsed.prices : undefined,
        )
      ).data.data,
    onSuccess: (data) => {
      if (data.lockTierAfter !== data.lockTierBefore) {
        toast.success(`Lock now grants ${data.lockTierAfter}`);
      } else {
        toast.info(`Lock still grants ${data.lockTierAfter}`);
      }
      setResult(data);
      setReason("");
      setPrime("");
      setUltra("");
      void queryClient.invalidateQueries({
        queryKey: ["user-tier-membership", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the admin can retry.
    },
  });

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
    setResult(null);
  };

  // Held until the preview has answered, so the button cannot be pressed on a
  // lock that turns out to need prices. A preview that fails — a backend from
  // before it existed — falls back to pressing without one, as before.
  const canPress =
    !mutation.isPending && !preview.isLoading && !(needsPrices && pricesError);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Re-evaluate lock
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent>
          {result ? (
            <ReevaluationOutcome result={result} onDone={close} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Re-evaluate locked FUSE</DialogTitle>
                <DialogDescription>
                  Re-reads this user&apos;s lock from the chain and records what
                  each locked tranche was worth when it was locked, so their
                  tier is graded on what they paid rather than on today&apos;s
                  soFUSE rate.
                </DialogDescription>
              </DialogHeader>

              <ul className="space-y-1.5 text-xs text-gray-600">
                <li>
                  Use it when someone locked the price of a tier but is shown a
                  tier lower — usually a lock of exactly 50,000 FUSE on a day
                  the soFUSE rate dipped, or a lock the app never confirmed.
                </li>
                <li>
                  It can only hold a tier up to what was paid for. Nothing is
                  sent on chain and no FUSE moves.
                </li>
                <li>Safe to repeat: a second run changes nothing.</li>
              </ul>

              <PricesSection
                preview={preview.data}
                isLoading={preview.isLoading}
                prime={prime}
                ultra={ultra}
                onPrimeChange={setPrime}
                onUltraChange={setUltra}
                error={pricesError}
                disabled={mutation.isPending}
              />

              <div className="space-y-2">
                <Label htmlFor="reevaluate-lock-reason">Reason</Label>
                <Textarea
                  id="reevaluate-lock-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="e.g. Locked 50,000 FUSE, shown Core — Monday ticket 13162452422"
                  disabled={mutation.isPending}
                />
                <p className="text-muted-foreground text-xs">
                  Optional. Recorded on the user&apos;s audit trail with your
                  name.
                </p>
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
                  onClick={() => mutation.mutate()}
                  disabled={!canPress}
                  className="cursor-pointer"
                >
                  {mutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {needsPrices ? "Re-evaluate and pin prices" : "Re-evaluate"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * The prices the lock is or will be graded against.
 *
 * Only asks for input in the one case that needs it: the lock has no record,
 * and the price on the day it was opened predates the price history.
 */
function PricesSection({
  preview,
  isLoading,
  prime,
  ultra,
  onPrimeChange,
  onUltraChange,
  error,
  disabled,
}: {
  preview: TierLockReevaluationPreview | undefined;
  isLoading: boolean;
  prime: string;
  ultra: string;
  onPrimeChange: (value: string) => void;
  onUltraChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
}) {
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking the lock&apos;s record and prices…
      </p>
    );
  }

  // No preview — an older backend, or a failed read. The press still works.
  if (!preview || !preview.locked) return null;

  const lockedOn = preview.lockedSince
    ? formatDateTime(preview.lockedSince)
    : "the day it was locked";

  if (preview.recorded) {
    return (
      <p className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
        {preview.pinnedThresholds
          ? `Prices pinned on the lock's record: ${formatPrices(preview.pinnedThresholds)}. They stay as they are.`
          : "The lock's record has no pinned prices, so it is graded at today's price."}
      </p>
    );
  }

  if (preview.lockTimeThresholds) {
    return (
      <p className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
        This lock has no record yet. It will be recorded and pinned at the
        price on {lockedOn}: {formatPrices(preview.lockTimeThresholds)}.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="flex gap-2 text-xs text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This lock has no record, and it was locked on {lockedOn} — before
          the lock price history begins, so the price it was bought at is not
          on record. Enter the lock prices that were in force that day. They
          are pinned for the rest of the lock&apos;s term and cannot be changed
          afterwards. Today&apos;s prices are{" "}
          {formatPrices(preview.liveThresholds)}; use them only if they were
          already in force then.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="reevaluate-lock-prime">Prime (FUSE)</Label>
          <Input
            id="reevaluate-lock-prime"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={prime}
            onChange={(event) => onPrimeChange(event.target.value)}
            placeholder="e.g. 50000"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reevaluate-lock-ultra">Ultra (FUSE)</Label>
          <Input
            id="reevaluate-lock-ultra"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={ultra}
            onChange={(event) => onUltraChange(event.target.value)}
            placeholder="e.g. 400000"
            disabled={disabled}
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** The tier before and after, and every tranche with where its value came from. */
function ReevaluationOutcome({
  result,
  onDone,
}: {
  result: TierLockReevaluationResult;
  onDone: () => void;
}) {
  const changed = result.lockTierAfter !== result.lockTierBefore;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          {changed
            ? `Lock now grants ${result.lockTierAfter}`
            : `Lock still grants ${result.lockTierAfter}`}
        </DialogTitle>
        <DialogDescription>
          {changed ? `It granted ${result.lockTierBefore} before. ` : ""}
          The user is on {result.currentTier} by every route. The app shows the
          new tier the next time it loads.
        </DialogDescription>
      </DialogHeader>

      {result.pinnedThresholds && (
        <p className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
          Graded against {formatPrices(result.pinnedThresholds)}
          {result.thresholdsSource
            ? ` — ${PRICES_SOURCE_LABEL[result.thresholdsSource]}`
            : ""}
          .
        </p>
      )}

      {result.tranches.length > 0 ? (
        <ul className="space-y-2">
          {result.tranches.map((tranche) => (
            <li key={tranche.shares}>
              <dl className="grid grid-cols-2 gap-3 rounded-md border border-gray-100 bg-gray-50 p-3 text-xs">
                <div>
                  <dt className="text-gray-500">Worth when locked</dt>
                  <dd className="font-medium text-gray-900">
                    {formatFuse(tranche.fuseAtLock)}
                  </dd>
                  <dd className="text-gray-500">
                    {SOURCE_LABEL[tranche.source]}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Worth today</dt>
                  <dd className="font-medium text-gray-900">
                    {formatFuse(tranche.liveFuse)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Locked</dt>
                  <dd className="font-medium text-gray-900">
                    {tranche.lockedAt ? formatDateTime(tranche.lockedAt) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Unlocks</dt>
                  <dd className="font-medium text-gray-900">
                    {tranche.unlocksAt
                      ? formatDateTime(tranche.unlocksAt)
                      : "—"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">
          Nothing is locked on chain for this user.
        </p>
      )}

      <p className="text-xs text-gray-500">
        Recorded on the user&apos;s audit trail.
      </p>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} className="cursor-pointer">
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
