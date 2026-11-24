"use client";

import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Check, ChevronsUpDown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { suggestKolPerkCode, useSaveKolPerk } from "@/hooks/use-kols";
import { windowInstant } from "@/lib/fee-promotions";
import {
  KOL_DEFAULT_LIMITS,
  KOL_PERK_NAME_MAX,
  kolPerkChanges,
  kolPerkCreateBody,
  kolPerkDraftError,
  kolReferralLinks,
  formatSepaUsd,
  normalizePerkCode,
  perkBenefitsLabel,
} from "@/lib/kols";
import { formatUtc, isoToUtcInput } from "@/lib/referral-v4";
import { cn, formatNumber } from "@/lib/utils";
import type { Kol, KolLimits, KolPerk } from "@/types/kols";

/** What the first campaign asked for: 50% off, a month of free SEPA. */
const SUGGESTED = { pct: "50", months: "1", capUsd: "10000" };
const DAY_MS = 24 * 60 * 60 * 1000;

interface KolPerkDialogProps {
  /** The perk to edit, or null to create one. */
  perk: KolPerk | null;
  /** Active KOLs, to attach a new perk to straight away. */
  kols: Kol[];
  /** Preselected KOL for a new perk (opened from a KOL's row). */
  defaultKolId?: string | null;
  limits: KolLimits | undefined;
  onClose: () => void;
}

/** A UTC `datetime-local` value for an instant, minutes only. */
const utcInput = (ms: number) => new Date(ms).toISOString().slice(0, 16);

/**
 * Create or edit a perk: what a KOL's special referral code gives the friends
 * who sign up with it between the start and the end (UTC).
 *
 * Benefits are copied onto each signup's grant when it is made, so editing a
 * perk changes what later signups get, never what anyone was promised. The
 * code can't change once someone has used it — it is in links already shared.
 * Saving a perk that is on takes a second step that spells out what it does.
 */
export function KolPerkDialog({
  perk,
  kols,
  defaultKolId,
  limits = KOL_DEFAULT_LIMITS,
  onClose,
}: KolPerkDialogProps) {
  const save = useSaveKolPerk();
  const [now] = useState(() => Date.now());
  const [name, setName] = useState(perk?.name ?? "");
  const [code, setCode] = useState(perk?.code ?? "");
  const [kolId, setKolId] = useState<string | null>(
    perk ? perk.kolId : (defaultKolId ?? null),
  );
  const [kolPickerOpen, setKolPickerOpen] = useState(false);
  const [startsAt, setStartsAt] = useState(
    perk ? isoToUtcInput(perk.startsAt) : utcInput(now),
  );
  const [endsAt, setEndsAt] = useState(
    perk ? isoToUtcInput(perk.endsAt) : utcInput(now + 30 * DAY_MS),
  );
  const [tierDiscountPct, setTierDiscountPct] = useState(
    perk ? String(perk.tierDiscountPct) : SUGGESTED.pct,
  );
  const [sepaFreeMonths, setSepaFreeMonths] = useState(
    perk ? String(perk.sepaFreeMonths) : SUGGESTED.months,
  );
  const [sepaFreeCapUsd, setSepaFreeCapUsd] = useState(
    perk
      ? perk.sepaFreeCapUsd > 0
        ? String(perk.sepaFreeCapUsd)
        : SUGGESTED.capUsd
      : SUGGESTED.capUsd,
  );
  const [maxSignups, setMaxSignups] = useState(
    perk?.maxSignups ? String(perk.maxSignups) : "",
  );
  const [enabled, setEnabled] = useState(perk?.enabled ?? false);
  const [attempted, setAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const inFlight = useRef(false);

  const codeUsed = !!perk && perk.stats.granted + perk.stats.ineligible > 0;
  const selectedKol = kols.find((kol) => kol.id === kolId) ?? null;
  const startIso = windowInstant(startsAt, perk?.startsAt);
  const endIso = windowInstant(endsAt, perk?.endsAt);
  const draft = {
    name,
    code,
    enabled,
    startsAt: startIso,
    endsAt: endIso,
    tierDiscountPct,
    sepaFreeMonths,
    sepaFreeCapUsd,
    maxSignups,
  };
  const error = kolPerkDraftError(draft, limits, undefined, perk);
  const changes = perk && !error ? kolPerkChanges(perk, draft) : null;
  const nothingChanged = !!changes && Object.keys(changes).length === 0;
  const switchingOff = !!perk?.enabled && !enabled;
  const months = Number(sepaFreeMonths);
  const benefits = perkBenefitsLabel({
    tierDiscountPct: Number(tierDiscountPct) || 0,
    sepaFreeMonths: months || 0,
    sepaFreeCapUsd: Number(sepaFreeCapUsd) || 0,
  });

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const seed = selectedKol?.username ?? perk?.kolUsername ?? name.trim();
      setCode(await suggestKolPerkCode(seed));
    } catch {
      // The API layer has already toasted why.
    } finally {
      setGenerating(false);
    }
  };

  const submit = () => {
    if (inFlight.current) return;
    setAttempted(true);
    if (error || !startIso || !endIso) return;
    if (nothingChanged) {
      onClose();
      return;
    }
    if ((enabled || switchingOff) && !confirming) {
      setConfirming(true);
      return;
    }
    const onSuccess = (saved: KolPerk) => {
      toast.success(
        perk ? `“${saved.name}” updated` : `“${saved.name}” created — code ${saved.code}`,
      );
      onClose();
    };
    const onError = (err: unknown) => {
      // A 409 is a stale version or a code someone else holds. On a stale
      // edit, close so it reopens from the fresh copy; a taken code stays
      // open for another try.
      if (
        perk &&
        isAxiosError(err) &&
        err.response?.status === 409 &&
        !/code/i.test(String(err.response?.data?.message ?? ""))
      ) {
        onClose();
      }
      setConfirming(false);
    };
    const onSettled = () => {
      inFlight.current = false;
    };
    inFlight.current = true;
    if (perk && changes) {
      save.mutate(
        { id: perk.id, body: { version: perk.version, ...changes } },
        { onSuccess, onError, onSettled },
      );
    } else {
      save.mutate(
        { body: kolPerkCreateBody(draft, kolId ?? undefined) },
        { onSuccess, onError, onSettled },
      );
    }
  };

  const shownCode = normalizePerkCode(code);
  const links = shownCode ? kolReferralLinks(shownCode) : null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !save.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {confirming ? "Confirm perk" : perk ? "Edit perk" : "Create perk"}
          </DialogTitle>
          <DialogDescription>
            {confirming
              ? enabled
                ? "It is on: everyone who signs up with its code during its window gets these benefits, on top of the normal referral rewards. Check it before saving."
                : "It is being switched off: signups from now on are referred to the KOL without the perk. Everyone already granted keeps theirs."
              : "A friend who signs up with this code is referred by the KOL, exactly as with the KOL’s own code, and also gets these benefits. Changes apply to signups from now on; people already granted keep what they were promised."}
          </DialogDescription>
        </DialogHeader>

        {confirming && startIso && endIso && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
            <dt className="text-gray-500">Perk</dt>
            <dd className="text-gray-900">{name.trim()}</dd>
            <dt className="text-gray-500">Code</dt>
            <dd className="font-mono text-gray-900">
              {shownCode || "generated on save"}
            </dd>
            <dt className="text-gray-500">KOL</dt>
            <dd className="text-gray-900">
              {selectedKol?.username ??
                perk?.kolUsername ??
                "Not attached — the code works once attached"}
            </dd>
            <dt className="text-gray-500">Benefits</dt>
            <dd className="font-medium text-gray-900">{benefits}</dd>
            <dt className="text-gray-500">Signups (UTC)</dt>
            <dd className="text-gray-900">
              {formatUtc(startIso)} → {formatUtc(endIso)}
            </dd>
            <dt className="text-gray-500">Limit</dt>
            <dd className="text-gray-900">
              {maxSignups.trim()
                ? `${formatNumber(Number(maxSignups), 0, 0)} signups`
                : "No limit"}
            </dd>
          </dl>
        )}

        {/* Kept mounted while confirming, so Back returns to the same form. */}
        <div className={confirming ? "hidden" : "grid gap-4 sm:grid-cols-2"}>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="perk-name">Name</Label>
            <Input
              id="perk-name"
              value={name}
              maxLength={KOL_PERK_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Artem — December launch"
              disabled={save.isPending}
            />
            <p className="text-muted-foreground text-xs">
              For the team only; the app shows the KOL’s username.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perk-code">Special referral code</Label>
            <div className="flex gap-2">
              <Input
                id="perk-code"
                value={code}
                maxLength={limits.codeMaxLength}
                onChange={(event) =>
                  setCode(event.target.value.replace(/[^A-Za-z0-9]/g, ""))
                }
                placeholder={perk ? "" : "Leave empty to generate"}
                className="font-mono uppercase"
                autoComplete="off"
                disabled={save.isPending || codeUsed}
              />
              <Button
                type="button"
                variant="outline"
                onClick={generate}
                disabled={save.isPending || codeUsed || generating}
                className="cursor-pointer"
                title="Generate a free code"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {codeUsed
                ? "Already used, so it is in links people have shared — create a new perk for a new code."
                : `${limits.codeMinLength}–${limits.codeMaxLength} letters and digits, matched in any case.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label>KOL</Label>
            {perk ? (
              <p className="pt-2 text-sm text-gray-900">
                {perk.kolUsername ?? "Not attached"}
                <span className="block text-xs text-gray-500">
                  Attach or detach from the perk&apos;s actions.
                </span>
              </p>
            ) : (
              <Popover open={kolPickerOpen} onOpenChange={setKolPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={kolPickerOpen}
                    className="w-full cursor-pointer justify-between font-normal"
                    disabled={save.isPending}
                  >
                    {selectedKol ? selectedKol.username : "Attach later"}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Find a KOL…" />
                    <CommandList>
                      <CommandEmpty>No active KOL by that name.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="attach later none"
                          onSelect={() => {
                            setKolId(null);
                            setKolPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              kolId === null ? "opacity-100" : "opacity-0",
                            )}
                          />
                          Attach later
                        </CommandItem>
                        {kols.map((kol) => (
                          <CommandItem
                            key={kol.id}
                            value={`${kol.username} ${kol.referralCode}`}
                            onSelect={() => {
                              setKolId(kol.id);
                              setKolPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                kolId === kol.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {kol.username}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {links && (
            <div className="bg-muted/40 space-y-1 rounded-md border p-3 text-xs sm:col-span-2">
              <p className="font-medium text-gray-700">Links it will be shared as</p>
              <p className="truncate font-mono text-gray-600">{links.website}</p>
              <p className="truncate font-mono text-gray-600">{links.app}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="perk-start">Signups from (UTC)</Label>
            <Input
              id="perk-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              disabled={save.isPending}
            />
            {startIso && (
              <p className="text-muted-foreground text-xs">{formatUtc(startIso)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="perk-end">Signups until (UTC)</Label>
            <Input
              id="perk-end"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              disabled={save.isPending}
            />
            <p className="text-muted-foreground text-xs">
              {endIso
                ? `${formatUtc(endIso)} — later signups are referred without the perk`
                : "Later signups are referred without the perk."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perk-discount">Membership discount (%)</Label>
            <Input
              id="perk-discount"
              type="number"
              min={0}
              max={limits.maxTierDiscountPct}
              step={1}
              value={tierDiscountPct}
              onChange={(event) => setTierDiscountPct(event.target.value)}
              disabled={save.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Off the first year of their first Prime or Ultra membership; renews
              at full price. Never stacked on a cheaper sale. 0 for none.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perk-signups">Signup limit</Label>
            <Input
              id="perk-signups"
              type="number"
              min={1}
              max={limits.maxSignups}
              step={1}
              value={maxSignups}
              onChange={(event) => setMaxSignups(event.target.value)}
              placeholder="No limit"
              disabled={save.isPending}
            />
            <p className="text-muted-foreground text-xs">
              How many signups get the perk. Later ones are referred without it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perk-months">Free SEPA deposits (months)</Label>
            <Input
              id="perk-months"
              type="number"
              min={0}
              max={limits.maxSepaFreeMonths}
              step={1}
              value={sepaFreeMonths}
              onChange={(event) => setSepaFreeMonths(event.target.value)}
              disabled={save.isPending}
            />
            <p className="text-muted-foreground text-xs">
              From each user&apos;s signup, deposits to their euro account cost
              nothing. 0 for none.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perk-cap">Free SEPA cap (USD per user)</Label>
            <Input
              id="perk-cap"
              type="number"
              min={0}
              max={limits.maxSepaFreeCapUsd}
              step={100}
              value={sepaFreeCapUsd}
              onChange={(event) => setSepaFreeCapUsd(event.target.value)}
              disabled={save.isPending || !(months > 0)}
            />
            <p className="text-muted-foreground text-xs">
              {months > 0 && Number(sepaFreeCapUsd) > 0
                ? `Deposits free up to ${formatSepaUsd(Number(sepaFreeCapUsd))} in total; the fee is charged on anything past it.`
                : "The most deposit volume the free months cover."}
            </p>
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={save.isPending}
              aria-label="On"
            />
            <span className="text-sm text-gray-700">
              {enabled
                ? "On — granted to signups during its window"
                : "Off — the code still refers friends to the KOL, without the perk"}
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
              ? switchingOff
                ? "Save and switch off"
                : perk?.enabled
                  ? "Save"
                  : "Save and switch on"
              : perk
                ? "Save changes"
                : "Create perk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
