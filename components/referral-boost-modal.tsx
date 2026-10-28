"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useSaveReferralBoost } from "@/hooks/use-referral-v4";
import {
  BOOST_SIDES_LABELS,
  REFERRAL_V4_STEP_LABELS,
  formatUtc,
  isoToUtcInput,
  utcInputToIso,
} from "@/lib/referral-v4";
import type {
  ReferralBoostAdmin,
  ReferralV4BoostSides,
  ReferralV4Step,
} from "@/types/referral-v4";
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

const STEPS: ReferralV4Step[] = ["welcome", "big_spender", "upgrade"];
const SIDES: ReferralV4BoostSides[] = ["both", "referrer", "friend"];
const MAX_MULTIPLIER = 5;

interface ReferralBoostModalProps {
  /** The boost to edit, or null to create one. */
  boost: ReferralBoostAdmin | null;
  onClose: () => void;
}

/**
 * Create or edit a referral boost: a multiplier on the v4 card credit bonuses
 * earned inside a UTC window, for chosen steps and sides.
 *
 * Checked here with the backend's bounds (multiplier above 1 and at most 5,
 * end after start, at least one step) so a typo is caught before saving.
 * Boosted credit doesn't count toward the per-friend cap.
 */
export default function ReferralBoostModal({
  boost,
  onClose,
}: ReferralBoostModalProps) {
  const save = useSaveReferralBoost();
  const [name, setName] = useState(boost?.name ?? "");
  const [multiplier, setMultiplier] = useState(
    boost ? String(boost.multiplier) : "2",
  );
  const [startsAt, setStartsAt] = useState(isoToUtcInput(boost?.startsAt));
  const [endsAt, setEndsAt] = useState(isoToUtcInput(boost?.endsAt));
  const [steps, setSteps] = useState<ReferralV4Step[]>(
    boost?.steps ?? ["welcome"],
  );
  const [sides, setSides] = useState<ReferralV4BoostSides>(
    boost?.sides ?? "both",
  );
  const [enabled, setEnabled] = useState(boost?.enabled ?? true);
  const [attempted, setAttempted] = useState(false);

  const parsedMultiplier = Number(multiplier);
  const startIso = utcInputToIso(startsAt);
  const endIso = utcInputToIso(endsAt);

  const error = (() => {
    if (!name.trim()) return "Give the boost a name.";
    if (
      multiplier.trim() === "" ||
      !Number.isFinite(parsedMultiplier) ||
      parsedMultiplier <= 1 ||
      parsedMultiplier > MAX_MULTIPLIER
    ) {
      return `The multiplier must be above 1 and at most ${MAX_MULTIPLIER}.`;
    }
    if (!startIso || !endIso) return "Set both the start and the end.";
    if (new Date(endIso) <= new Date(startIso)) {
      return "The end has to be after the start.";
    }
    if (steps.length === 0) return "Pick at least one bonus to boost.";
    if (sides === "friend" && steps.every((step) => step === "upgrade")) {
      return "The upgrade bonus is referrer-only, so a friend-only boost on it does nothing.";
    }
    return null;
  })();

  const toggleStep = (step: ReferralV4Step, on: boolean) =>
    setSteps((prev) =>
      on
        ? STEPS.filter((s) => s === step || prev.includes(s))
        : prev.filter((s) => s !== step),
    );

  const submit = () => {
    setAttempted(true);
    if (error || !startIso || !endIso) return;
    save.mutate(
      {
        id: boost?.id,
        body: {
          name: name.trim(),
          multiplier: parsedMultiplier,
          startsAt: startIso,
          endsAt: endIso,
          steps,
          sides,
          enabled,
        },
      },
      {
        onSuccess: () => {
          toast.success(boost ? "Boost updated" : "Boost created");
          onClose();
        },
        // The API layer toasts the server's reason; keep the form open.
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !save.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{boost ? "Edit boost" : "Create boost"}</DialogTitle>
          <DialogDescription>
            Multiplies the card credit of the chosen bonuses earned between the
            start and the end (UTC). Boosted credit doesn&apos;t count toward
            the per-friend cap.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="boost-name">Name</Label>
            <Input
              id="boost-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Double welcome — Black Friday"
              disabled={save.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="boost-multiplier">Multiplier</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">×</span>
              <Input
                id="boost-multiplier"
                type="number"
                min={1.1}
                max={MAX_MULTIPLIER}
                step="0.1"
                value={multiplier}
                onChange={(event) => setMultiplier(event.target.value)}
                disabled={save.isPending}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Above 1, at most {MAX_MULTIPLIER}. ×2 doubles the credit.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="boost-sides">Sides</Label>
            <select
              id="boost-sides"
              value={sides}
              onChange={(event) =>
                setSides(event.target.value as ReferralV4BoostSides)
              }
              disabled={save.isPending}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              {SIDES.map((side) => (
                <option key={side} value={side}>
                  {BOOST_SIDES_LABELS[side]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="boost-start">Starts (UTC)</Label>
            <Input
              id="boost-start"
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
            <Label htmlFor="boost-end">Ends (UTC)</Label>
            <Input
              id="boost-end"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              disabled={save.isPending}
            />
            {endIso && (
              <p className="text-muted-foreground text-xs">
                {formatUtc(endIso)}
              </p>
            )}
          </div>

          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="mb-1 text-sm font-medium">Bonuses boosted</legend>
            <div className="flex flex-wrap gap-4">
              {STEPS.map((step) => (
                <label
                  key={step}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={steps.includes(step)}
                    onChange={(event) => toggleStep(step, event.target.checked)}
                    disabled={save.isPending}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  {REFERRAL_V4_STEP_LABELS[step]}
                  {step === "upgrade" && (
                    <span className="text-xs text-gray-400">
                      (referrer only)
                    </span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={save.isPending}
              aria-label="Enabled"
            />
            <span className="text-sm text-gray-700">
              {enabled
                ? "Enabled — applies during its window"
                : "Disabled — never applies"}
            </span>
          </div>
        </div>

        {attempted && error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={save.isPending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={save.isPending || (attempted && !!error)}
            className="cursor-pointer"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {boost ? "Save boost" : "Create boost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
