"use client";

import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { useAddKol, useUpdateKol } from "@/hooks/use-kols";
import { KOL_NOTE_MAX, normalizeKolUsername } from "@/lib/kols";
import type { Kol } from "@/types/kols";

interface KolDialogProps {
  /** The KOL whose note to edit, or null to add one. */
  kol: Kol | null;
  onClose: () => void;
}

/**
 * Add a KOL by their Solid username, or edit the note kept on one. Adding a
 * user who was removed brings the same KOL back, with their perks and history.
 */
export function KolDialog({ kol, onClose }: KolDialogProps) {
  const add = useAddKol();
  const update = useUpdateKol();
  const pending = add.isPending || update.isPending;
  const [username, setUsername] = useState("");
  const [note, setNote] = useState(kol?.note ?? "");
  const [attempted, setAttempted] = useState(false);
  const inFlight = useRef(false);

  const normalized = normalizeKolUsername(username);
  const error = !kol && !normalized ? "Give the KOL’s Solid username." : null;

  const submit = () => {
    if (inFlight.current) return;
    setAttempted(true);
    if (error) return;
    const onError = (err: unknown) => {
      // A 409 on a note means someone saved the KOL meanwhile.
      if (kol && isAxiosError(err) && err.response?.status === 409) onClose();
    };
    const onSettled = () => {
      inFlight.current = false;
    };
    inFlight.current = true;
    if (kol) {
      update.mutate(
        { id: kol.id, version: kol.version, note: note.trim() },
        {
          onSuccess: () => {
            toast.success(`Note saved for ${kol.username}`);
            onClose();
          },
          onError,
          onSettled,
        },
      );
    } else {
      add.mutate(
        { username: normalized, ...(note.trim() && { note: note.trim() }) },
        {
          onSuccess: (saved) => {
            toast.success(`${saved.username} is a KOL`);
            onClose();
          },
          onError,
          onSettled,
        },
      );
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kol ? `Note on ${kol.username}` : "Add KOL"}</DialogTitle>
          <DialogDescription>
            {kol
              ? "Kept for the team: the deal, the channel, who the contact is."
              : "An existing Solid user. Their own referral code keeps working as it is; perks you attach give their followers a special code with extra benefits."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!kol && (
            <div className="space-y-2">
              <Label htmlFor="kol-username">Solid username</Label>
              <Input
                id="kol-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. artem.betev"
                autoComplete="off"
                autoFocus
                disabled={pending}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="kol-note">Note (optional)</Label>
            <Textarea
              id="kol-note"
              value={note}
              maxLength={KOL_NOTE_MAX}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. YouTube, 120k subs · contact via Telegram"
              rows={3}
              disabled={pending}
            />
            <p className="text-muted-foreground text-xs">
              {note.length}/{KOL_NOTE_MAX}
            </p>
          </div>
        </div>

        {attempted && error && <p className="text-xs text-red-600">{error}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={pending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending} className="cursor-pointer">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {kol ? "Save note" : "Add KOL"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
