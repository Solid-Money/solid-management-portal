"use client";

import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";

import {
  BatchIssueTierTrialRequest,
  GiftableTier,
  IssueTierTrialRequest,
  TierTrial,
  TierTrialBatchConflictPolicy,
  TierTrialConflictResolution,
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
import { cn } from "@/lib/utils";
import {
  countDuplicateUsernames,
  MAX_TIER_TRIAL_BATCH_SIZE,
  MAX_TIER_TRIAL_DAYS,
  MIN_TIER_TRIAL_DAYS,
  parseUsernameList,
  tierTrialStatusLabel,
} from "@/lib/tier-trial";

/** The durations that actually get used, with the welcome offer's 30 first. */
const DURATION_PRESETS = [30, 7, 14, 60, 90];

const TIERS: { tier: GiftableTier; label: string; blurb: string }[] = [
  { tier: "prime", label: "Prime", blurb: "4% cashback · +2% yield" },
  { tier: "ultra", label: "Ultra", blurb: "5% cashback · +3% yield" },
];

/** The three answers a batch can give about users who already hold a trial. */
const BATCH_POLICIES: {
  policy: TierTrialBatchConflictPolicy;
  label: string;
  blurb: string;
}[] = [
  { policy: "skip", label: "Skip them", blurb: "Leave their trial alone" },
  { policy: "extend", label: "Extend it", blurb: "Add these days, same tier" },
  { policy: "replace", label: "Replace it", blurb: "Revoke theirs, start this" },
];

interface BaseProps {
  /**
   * Always `true` in practice: the form seeds itself on mount, so mount this
   * only while it is open rather than leaving it mounted and toggling.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSaving: boolean;
}

/** Gifting one user, from their profile page. */
interface SingleProps extends BaseProps {
  mode?: "single";
  username: string;
  /**
   * The trial the user already has, when they have one. Its presence is what
   * turns on the replace/extend choice — the backend refuses a gift that does
   * not make it.
   */
  existing?: TierTrial | null;
  onSubmit: (request: IssueTierTrialRequest) => void;
}

/** Gifting a pasted list of users at once. */
interface BatchProps extends BaseProps {
  mode: "batch";
  onSubmit: (request: BatchIssueTierTrialRequest) => void;
}

type TierTrialDialogProps = SingleProps | BatchProps;

/** One choice in a segmented row. */
function Choice({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 cursor-pointer rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-indigo-500 bg-indigo-50 text-indigo-900"
          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Gift a temporary tier upgrade — to one user, or to a pasted list of them.
 *
 * ## Why one component for both
 *
 * Everything about what the gift *is* — the tier, the duration, the message
 * the user reads, the internal reason — means exactly the same thing for four
 * hundred users as for one. Only the "who" and the conflict decision differ,
 * so the two modes are the same form with the list and the policy swapped in,
 * rather than two forms that would drift the moment a preset changed.
 *
 * ## Why the tier and duration are buttons, not fields
 *
 * There are two tiers and a handful of durations that ever get used, and the
 * welcome offer's 30 days is by far the most common. Presets make the usual
 * gift one click and keep the free-text field for the rare case, rather than
 * making every gift an exercise in typing.
 *
 * ## Why the replace/extend choice appears here
 *
 * A user holds one trial at a time. When they already have one, the backend
 * refuses a second gift that has not said what to do about it — durations are
 * never quietly summed and a tier is never quietly raised. The card reads the
 * open trial before opening this, so the choice is put to the operator up front
 * instead of arriving as a rejected save.
 *
 * Extending only ever adds days at the tier the trial already grants; picking a
 * different tier is a replacement, which is why choosing one switches the
 * decision back to Replace.
 *
 * A batch cannot ask that question per user — nobody is going to answer it
 * four hundred times — so it is asked once for everyone, and defaults to
 * leaving those users alone.
 */
export default function TierTrialDialog(props: TierTrialDialogProps) {
  const { open, onOpenChange, isSaving } = props;
  const isBatch = props.mode === "batch";
  // A batch has no one user to name and no one trial to look at, so both are
  // read out here once rather than guarded at every place they are shown.
  const username = props.mode === "batch" ? "" : props.username;
  const existing = (props.mode === "batch" ? null : props.existing) ?? null;

  const [tier, setTier] = useState<GiftableTier>(existing?.tier ?? "prime");
  const [days, setDays] = useState(String(DURATION_PRESETS[0]));
  const [giftMessage, setGiftMessage] = useState("");
  const [reason, setReason] = useState("");
  const [onExistingTrial, setOnExistingTrial] =
    useState<TierTrialConflictResolution>(existing ? "extend" : "replace");
  const [usernamesText, setUsernamesText] = useState("");
  const [batchPolicy, setBatchPolicy] =
    useState<TierTrialBatchConflictPolicy>("skip");

  const parsedDays = Number(days);
  const isValidDuration =
    Number.isInteger(parsedDays) &&
    parsedDays >= MIN_TIER_TRIAL_DAYS &&
    parsedDays <= MAX_TIER_TRIAL_DAYS;

  const usernames = isBatch ? parseUsernameList(usernamesText) : [];
  const duplicateCount = countDuplicateUsernames(usernames);
  const isOverBatchLimit = usernames.length > MAX_TIER_TRIAL_BATCH_SIZE;
  const isValidBatch = usernames.length > 0 && !isOverBatchLimit;

  // Extending keeps the open trial's tier, so the two controls cannot disagree.
  const isExtending = !!existing && onExistingTrial === "extend";
  const effectiveTier = isExtending ? existing.tier : tier;

  const pickTier = (next: GiftableTier) => {
    setTier(next);
    // A different tier is a replacement, not a top-up — say so rather than
    // letting the save be refused for a contradiction the form allowed.
    if (existing && next !== existing.tier) setOnExistingTrial("replace");
  };

  const submit = () => {
    if (props.mode === "batch") {
      props.onSubmit({
        usernames,
        tier,
        durationDays: parsedDays,
        giftMessage: giftMessage.trim() || undefined,
        reason: reason.trim() || undefined,
        onExistingTrial: batchPolicy,
      });
      return;
    }

    props.onSubmit({
      tier: effectiveTier,
      durationDays: parsedDays,
      giftMessage: giftMessage.trim() || undefined,
      reason: reason.trim() || undefined,
      ...(existing ? { onExistingTrial } : {}),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-gray-400" />
            {isBatch
              ? "Gift a tier trial to a list of users"
              : `Gift a tier trial to ${username}`}
          </DialogTitle>
          <DialogDescription>
            {isBatch ? "They all keep" : "They keep"} their points and FUSE
            balance exactly as they are. The trial grants its tier on top for
            its duration, and the countdown starts when they activate it — not
            now.
          </DialogDescription>
        </DialogHeader>

        {isBatch && (
          <div className="space-y-2">
            <Label htmlFor="tier-trial-usernames">Usernames</Label>
            <Textarea
              id="tier-trial-usernames"
              value={usernamesText}
              onChange={(event) => setUsernamesText(event.target.value)}
              rows={8}
              spellCheck={false}
              placeholder={"jane\njohn.doe\nsatoshi"}
              disabled={isSaving}
              className="font-mono text-xs"
            />
            {isOverBatchLimit ? (
              <p className="text-xs text-red-600">
                {usernames.length} usernames — one batch carries at most{" "}
                {MAX_TIER_TRIAL_BATCH_SIZE}. Split the list and run it twice.
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                One per line, up to {MAX_TIER_TRIAL_BATCH_SIZE}. Blank lines and
                a leading &ldquo;@&rdquo; are ignored.
                {usernames.length > 0 &&
                  ` ${usernames.length} name${usernames.length === 1 ? "" : "s"} so far`}
                {duplicateCount > 0 &&
                  `, ${duplicateCount} of them repeated — each is gifted once`}
                {usernames.length > 0 && "."}
              </p>
            )}
          </div>
        )}

        {isBatch && (
          <div className="space-y-2">
            <Label>If they already have a trial</Label>
            <div className="flex gap-2">
              {BATCH_POLICIES.map(({ policy, label, blurb }) => (
                <Choice
                  key={policy}
                  selected={batchPolicy === policy}
                  disabled={isSaving}
                  onClick={() => setBatchPolicy(policy)}
                >
                  <span className="font-medium">{label}</span>
                  <span className="block text-xs text-gray-500">{blurb}</span>
                </Choice>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Asked once for the whole list — nobody is going to answer it per
              user.
              {batchPolicy === "extend" &&
                " Extending only adds days at the tier a user's trial already grants, so anyone on the other tier is reported as failed rather than upgraded."}
            </p>
          </div>
        )}

        {existing && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">
              {username} already has a{" "}
              {tierTrialStatusLabel(existing.status).toLowerCase()}{" "}
              {existing.tier} trial
              {existing.status === "active" && existing.expiresAt
                ? ` until ${new Date(existing.expiresAt).toLocaleDateString()}`
                : ""}
              .
            </p>
            <div className="flex gap-2">
              <Choice
                selected={onExistingTrial === "extend"}
                disabled={isSaving || tier !== existing.tier}
                onClick={() => setOnExistingTrial("extend")}
              >
                <span className="font-medium">Extend it</span>
                <span className="block text-xs text-gray-500">
                  Add these days at {existing.tier}
                </span>
              </Choice>
              <Choice
                selected={onExistingTrial === "replace"}
                disabled={isSaving}
                onClick={() => setOnExistingTrial("replace")}
              >
                <span className="font-medium">Replace it</span>
                <span className="block text-xs text-gray-500">
                  Revoke that one, start this
                </span>
              </Choice>
            </div>
            {tier !== existing.tier && (
              <p className="text-xs text-amber-800">
                Extending only adds days at the tier the trial already grants,
                so a {tier} gift can only replace their {existing.tier} one.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Tier</Label>
          <div className="flex gap-2">
            {TIERS.map(({ tier: value, label, blurb }) => (
              <Choice
                key={value}
                selected={effectiveTier === value}
                disabled={isSaving || (isExtending && value !== existing.tier)}
                onClick={() => pickTier(value)}
              >
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-gray-500">{blurb}</span>
              </Choice>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tier-trial-days">
            {isExtending ? "Days to add" : "Duration"}
          </Label>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={parsedDays === preset}
                onClick={() => setDays(String(preset))}
                disabled={isSaving}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  parsedDays === preset
                    ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {preset} days
              </button>
            ))}
          </div>
          <Input
            id="tier-trial-days"
            type="number"
            inputMode="numeric"
            min={MIN_TIER_TRIAL_DAYS}
            max={MAX_TIER_TRIAL_DAYS}
            step={1}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            disabled={isSaving}
          />
          {isValidDuration ? (
            <p className="text-muted-foreground text-xs">
              {isExtending
                ? `Their trial runs ${existing.durationDays + parsedDays} days in total once this is added.`
                : `${parsedDays} days of ${effectiveTier}, starting when they activate it.`}
            </p>
          ) : (
            <p className="text-xs text-red-600">
              Enter a whole number of days between {MIN_TIER_TRIAL_DAYS} and{" "}
              {MAX_TIER_TRIAL_DAYS}.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tier-trial-message">
            Gift message{" "}
            <span className="text-muted-foreground">
              (optional, shown to the user{isBatch ? "s" : ""})
            </span>
          </Label>
          <Textarea
            id="tier-trial-message"
            value={giftMessage}
            onChange={(event) => setGiftMessage(event.target.value)}
            maxLength={280}
            placeholder="e.g. Thanks for being an early Solid user — enjoy a month of Prime"
            disabled={isSaving}
          />
          <p className="text-muted-foreground text-xs">
            {isBatch
              ? "Every user in the list sees this same note on the gift card in the app. Leave it empty for the app's own copy."
              : "They see this on the gift card in the app. Leave it empty for the app's own copy."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tier-trial-reason">
            Internal reason{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="tier-trial-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="e.g. Goodwill after the card issue on 3 Sep"
            disabled={isSaving}
          />
          <p className="text-muted-foreground text-xs">
            Never shown to the user. Recorded in the audit trail with your name.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isSaving || !isValidDuration || (isBatch && !isValidBatch)}
            className="cursor-pointer"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isBatch
              ? `Send ${isValidBatch ? usernames.length : ""} gift${usernames.length === 1 ? "" : "s"}`
              : isExtending
                ? `Add ${isValidDuration ? parsedDays : ""} days`
                : "Send gift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
