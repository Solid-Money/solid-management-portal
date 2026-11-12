"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useSaveFeePromotion } from "@/hooks/use-fee-promotions";
import {
  FEE_PROMOTION_DEFAULT_LIMITS,
  FEE_PROMOTION_NAME_MAX,
  feePromotionChanges,
  feePromotionDraftError,
  freeDepositsLabel,
} from "@/lib/fee-promotions";
import { formatUtc, isoToUtcInput, utcInputToIso } from "@/lib/referral-v4";
import type {
  FeePromotion,
  FeePromotionList,
  FeePromotionScope,
} from "@/types/fee-promotions";
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
import { Switch } from "@/components/ui/switch";

/** What the brief asked for: the first 3 deposits free. */
const SUGGESTED_FREE_COUNT = 3;

interface FeePromotionModalProps {
  /** The promotion to edit, or null to create one. */
  promotion: FeePromotion | null;
  scopes: FeePromotionList["scopes"];
  limits: FeePromotionList["limits"] | undefined;
  onClose: () => void;
}

/**
 * Create or edit a fee promotion: each user's first N fees on one scope are
 * free, whatever their tier, between the start and the end (UTC).
 *
 * Checked here with the backend's bounds so a typo is caught before saving;
 * the backend also refuses a window that overlaps another promotion that is
 * on. Saving one that is on takes a second step that spells out what it does,
 * because it switches a fee off for every user in its scope.
 */
export default function FeePromotionModal({
  promotion,
  scopes,
  limits = FEE_PROMOTION_DEFAULT_LIMITS,
  onClose,
}: FeePromotionModalProps) {
  const save = useSaveFeePromotion();
  const [name, setName] = useState(promotion?.name ?? "");
  const [scope, setScope] = useState<FeePromotionScope | "">(
    promotion?.scope ?? scopes[0]?.scope ?? "",
  );
  const [startsAt, setStartsAt] = useState(isoToUtcInput(promotion?.startsAt));
  const [endsAt, setEndsAt] = useState(isoToUtcInput(promotion?.endsAt));
  const [freeCount, setFreeCount] = useState(
    String(promotion?.freeCountPerUser ?? SUGGESTED_FREE_COUNT),
  );
  const [enabled, setEnabled] = useState(promotion?.enabled ?? false);
  const [attempted, setAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const startIso = utcInputToIso(startsAt);
  const endIso = utcInputToIso(endsAt);
  const draft = {
    name,
    enabled,
    startsAt: startIso,
    endsAt: endIso,
    freeCountPerUser: freeCount,
  };
  const scopeOption = scopes.find((option) => option.scope === scope);
  const error =
    !promotion && !scopeOption
      ? "Pick what the promotion makes free."
      : feePromotionDraftError(draft, limits);
  const changes = promotion ? feePromotionChanges(promotion, draft) : null;
  const nothingChanged = !!changes && Object.keys(changes).length === 0;

  const submit = () => {
    setAttempted(true);
    if (error || !startIso || !endIso) return;
    if (nothingChanged) {
      onClose();
      return;
    }
    if (enabled && !confirming) {
      setConfirming(true);
      return;
    }
    const onSuccess = () => {
      toast.success(promotion ? "Promotion updated" : "Promotion created");
      onClose();
    };
    // The API layer toasts the server's reason. A 409 means someone saved
    // this promotion meanwhile: close, so it reopens from the fresh copy.
    const onError = (err: unknown) => {
      if (isAxiosError(err) && err.response?.status === 409) onClose();
    };
    if (promotion && changes) {
      save.mutate(
        { id: promotion.id, body: { version: promotion.version, ...changes } },
        { onSuccess, onError },
      );
    } else if (scopeOption) {
      save.mutate(
        {
          body: {
            name: name.trim(),
            scope: scopeOption.scope,
            enabled,
            startsAt: startIso,
            endsAt: endIso,
            freeCountPerUser: Number(freeCount),
          },
        },
        { onSuccess, onError },
      );
    }
  };

  const scopeLabel = scopeOption?.label ?? promotion?.scopeLabel ?? "";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !save.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {confirming
              ? "Confirm promotion"
              : promotion
                ? "Edit promotion"
                : "Create promotion"}
          </DialogTitle>
          <DialogDescription>
            {confirming
              ? "It is on, so every user's next fees in its scope cost nothing until their free ones run out. Check it before saving."
              : "Makes each user's first fees free, whatever their tier, for deposits that arrive between the start and the end (UTC). Fees that were already free (Ultra, below the minimum charge) don't use one up."}
          </DialogDescription>
        </DialogHeader>

        {confirming && startIso && endIso && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
            <dt className="text-gray-500">Name</dt>
            <dd className="text-gray-900">{name.trim()}</dd>
            <dt className="text-gray-500">Makes free</dt>
            <dd className="text-gray-900">{scopeLabel}</dd>
            <dt className="text-gray-500">Per user</dt>
            <dd className="font-medium text-gray-900">
              First {freeDepositsLabel(Number(freeCount))}
            </dd>
            <dt className="text-gray-500">Window (UTC)</dt>
            <dd className="text-gray-900">
              {formatUtc(startIso)} → {formatUtc(endIso)}
            </dd>
          </dl>
        )}

        {/* Kept mounted while confirming, so Back returns to the same form. */}
        <div className={confirming ? "hidden" : "grid gap-4 sm:grid-cols-2"}>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="promotion-name">Name</Label>
            <Input
              id="promotion-name"
              value={name}
              maxLength={FEE_PROMOTION_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Free SEPA deposits — December"
              disabled={save.isPending}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="promotion-scope">Makes free</Label>
            {promotion ? (
              <p className="text-sm text-gray-900">
                {promotion.scopeLabel}
                <span className="block text-xs text-gray-500">
                  Fixed once created — the fees it waived name it.
                </span>
              </p>
            ) : (
              <>
                <select
                  id="promotion-scope"
                  value={scope}
                  onChange={(event) =>
                    setScope(event.target.value as FeePromotionScope)
                  }
                  disabled={save.isPending}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  {scopes.map((option) => (
                    <option key={option.scope} value={option.scope}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {scopeOption && (
                  <p className="text-muted-foreground text-xs">
                    {scopeOption.description}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="promotion-start">Starts (UTC)</Label>
            <Input
              id="promotion-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              disabled={save.isPending}
            />
            {startIso && (
              <p className="text-muted-foreground text-xs">
                {formatUtc(startIso)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="promotion-end">Ends (UTC)</Label>
            <Input
              id="promotion-end"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              disabled={save.isPending}
            />
            <p className="text-muted-foreground text-xs">
              {endIso
                ? `${formatUtc(endIso)} — fees are charged as normal from this moment`
                : "Fees are charged as normal again from this moment."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="promotion-count">Free deposits per user</Label>
            <Input
              id="promotion-count"
              type="number"
              min={1}
              max={limits.maxFreeCountPerUser}
              step={1}
              value={freeCount}
              onChange={(event) => setFreeCount(event.target.value)}
              disabled={save.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Each user&apos;s first fees inside the window, 1 to{" "}
              {limits.maxFreeCountPerUser}.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end pb-2">
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={save.isPending}
              aria-label="On"
            />
            <span className="text-sm text-gray-700">
              {enabled ? "On — applies during its window" : "Off — never applies"}
            </span>
          </div>
        </div>

        {attempted && error && <p className="text-xs text-red-600">{error}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={confirming ? () => setConfirming(false) : onClose}
            disabled={save.isPending}
            className="cursor-pointer"
          >
            {confirming ? "Back" : "Cancel"}
          </Button>
          <Button
            onClick={submit}
            disabled={save.isPending || (attempted && !!error)}
            className="cursor-pointer"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirming
              ? promotion?.enabled
                ? "Save"
                : "Save and switch on"
              : promotion
                ? "Save changes"
                : "Create promotion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
