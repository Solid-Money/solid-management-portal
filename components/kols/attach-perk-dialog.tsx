"use client";

import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { useAttachKolPerk } from "@/hooks/use-kols";
import {
  KOL_PERK_STATUS_LABEL,
  KOL_PERK_STATUS_VARIANT,
  perkBenefitsLabel,
} from "@/lib/kols";
import { cn } from "@/lib/utils";
import type { Kol, KolPerk } from "@/types/kols";

type AttachDialogProps =
  | {
      /** Attach a perk to this KOL: pick one of the unattached perks. */
      mode: "kol";
      kol: Kol;
      perks: KolPerk[];
      onCreatePerk: (kolId: string) => void;
      onClose: () => void;
    }
  | {
      /** Attach this perk to a KOL: pick one of the active KOLs. */
      mode: "perk";
      perk: KolPerk;
      kols: Kol[];
      onClose: () => void;
    };

/**
 * Attach a perk to a KOL, from either side: a KOL's row picks among the perks
 * not attached to anyone, a perk's row picks among the active KOLs. Once its
 * code is attached, the perk refers friends to that KOL.
 */
export function AttachPerkDialog(props: AttachDialogProps) {
  const attach = useAttachKolPerk();
  const [selected, setSelected] = useState<string | null>(
    props.mode === "perk" ? props.perk.kolId : null,
  );
  const inFlight = useRef(false);

  const candidates =
    props.mode === "kol"
      ? props.perks.filter((perk) => !perk.kolId)
      : props.kols.filter((kol) => kol.status === "active");

  const submit = () => {
    if (inFlight.current || !selected) return;
    const perk =
      props.mode === "kol"
        ? props.perks.find((candidate) => candidate.id === selected)
        : props.perk;
    const kolId = props.mode === "kol" ? props.kol.id : selected;
    if (!perk) return;
    if (perk.kolId === kolId) {
      props.onClose();
      return;
    }
    inFlight.current = true;
    attach.mutate(
      { id: perk.id, version: perk.version, kolId },
      {
        onSuccess: (saved) => {
          toast.success(`${saved.code} is now ${saved.kolUsername}’s code`);
          props.onClose();
        },
        onError: (err) => {
          if (isAxiosError(err) && err.response?.status === 409) props.onClose();
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  const title =
    props.mode === "kol"
      ? `Attach a perk to ${props.kol.username}`
      : props.perk.kolId
        ? `Move ${props.perk.code} to another KOL`
        : `Attach ${props.perk.code} to a KOL`;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !attach.isPending) props.onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {props.mode === "kol"
              ? "Perks not attached to anyone yet. Friends who sign up with the perk’s code are then referred by this KOL and get its benefits."
              : "Friends who sign up with this code are referred by the KOL you pick. A code that has been used stays with its KOL."}
          </DialogDescription>
        </DialogHeader>

        <Command className="rounded-md border">
          <CommandInput
            placeholder={props.mode === "kol" ? "Find a perk…" : "Find a KOL…"}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>
              {props.mode === "kol"
                ? "No unattached perks. Create one below."
                : "No active KOL by that name."}
            </CommandEmpty>
            <CommandGroup>
              {props.mode === "kol"
                ? (candidates as KolPerk[]).map((perk) => (
                    <CommandItem
                      key={perk.id}
                      value={`${perk.name} ${perk.code}`}
                      onSelect={() => setSelected(perk.id)}
                      className="items-start"
                    >
                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4",
                          selected === perk.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {perk.code}
                          </span>
                          <span className="truncate text-sm">{perk.name}</span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {perkBenefitsLabel(perk)}
                        </p>
                      </div>
                      <Badge variant={perk.enabled ? "info" : "warning"}>
                        {perk.enabled ? "On" : "Off"}
                      </Badge>
                    </CommandItem>
                  ))
                : (candidates as Kol[]).map((kol) => (
                    <CommandItem
                      key={kol.id}
                      value={`${kol.username} ${kol.referralCode}`}
                      onSelect={() => setSelected(kol.id)}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selected === kol.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="flex-1">{kol.username}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        own code {kol.referralCode}
                      </span>
                    </CommandItem>
                  ))}
            </CommandGroup>
          </CommandList>
        </Command>

        {props.mode === "perk" && (
          <p className="text-muted-foreground text-xs">
            Now:{" "}
            <Badge variant={KOL_PERK_STATUS_VARIANT[props.perk.status]}>
              {KOL_PERK_STATUS_LABEL[props.perk.status]}
            </Badge>{" "}
            {perkBenefitsLabel(props.perk)}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          {props.mode === "kol" ? (
            <Button
              variant="ghost"
              onClick={() => props.onCreatePerk(props.kol.id)}
              disabled={attach.isPending}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New perk for {props.kol.username}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={props.onClose}
              disabled={attach.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={attach.isPending || !selected}
              className="cursor-pointer"
            >
              {attach.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Attach
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
