"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createCampaign, patchCampaign } from "@/lib/tasks-api";
import { CAMPAIGN_SWATCH } from "@/components/tasks/marketing-format";
import { TASK_CAMPAIGN_COLORS, type TaskCampaign, type TaskCampaignColor } from "@/types/tasks";

const input =
  "h-9 w-full rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

/** A new campaign (a week's theme or a launch), or changes to one. */
export default function CampaignDialog({
  open,
  campaign,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** Set to edit it; null for a new one. */
  campaign: TaskCampaign | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (campaign: TaskCampaign) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [startOn, setStartOn] = useState("");
  const [endOn, setEndOn] = useState("");
  const [color, setColor] = useState<TaskCampaignColor>("indigo");
  const [saving, setSaving] = useState(false);
  // Each time it opens, start from the campaign (or blank), set during render.
  const [seen, setSeen] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  if (seen.open !== open || seen.id !== (campaign?.id ?? null)) {
    setSeen({ open, id: campaign?.id ?? null });
    if (open) {
      setName(campaign?.name ?? "");
      setStartOn(campaign?.startOn ?? "");
      setEndOn(campaign?.endOn ?? "");
      setColor(campaign?.color ?? "indigo");
    }
  }
  const backwards = !!startOn && !!endOn && endOn < startOn;
  const ready = !!name.trim() && !backwards && !saving;

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      const saved = campaign
        ? await patchCampaign(campaign.id, {
            name: name.trim(),
            startOn: startOn || null,
            endOn: endOn || null,
            color,
          })
        : await createCampaign({
            name: name.trim(),
            ...(startOn ? { startOn } : {}),
            ...(endOn ? { endOn } : {}),
            color,
          });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "marketing"] });
      onOpenChange(false);
      onSaved?.(saved);
    } catch {
      // The API layer shows the error; keep what was typed.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>A week&apos;s theme or a launch. Pieces go in it.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="campaign-name" className="text-xs font-medium text-gray-600">
              Name
            </label>
            <input
              id="campaign-name"
              autoFocus
              value={name}
              maxLength={80}
              placeholder="EURO, Cashback, Security"
              onChange={(event) => setName(event.target.value)}
              className={input}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="campaign-start" className="text-xs font-medium text-gray-600">
                Starts
              </label>
              <input
                id="campaign-start"
                type="date"
                value={startOn}
                onChange={(event) => setStartOn(event.target.value)}
                className={input}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="campaign-end" className="text-xs font-medium text-gray-600">
                Ends
              </label>
              <input
                id="campaign-end"
                type="date"
                value={endOn}
                min={startOn || undefined}
                onChange={(event) => setEndOn(event.target.value)}
                className={input}
              />
            </div>
          </div>
          {backwards && <p className="text-xs text-red-600">It ends on or after the day it starts.</p>}
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-gray-600">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {TASK_CAMPAIGN_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={option}
                  aria-pressed={color === option}
                  onClick={() => setColor(option)}
                  className={cn(
                    "flex size-7 cursor-pointer items-center justify-center rounded-md text-white",
                    CAMPAIGN_SWATCH[option],
                    color === option && "ring-2 ring-gray-900 ring-offset-2",
                  )}
                >
                  {color === option && <Check className="size-4" />}
                </button>
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={!ready}>
              {saving && <Loader2 className="animate-spin" />}
              {campaign ? "Save" : "Create campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
