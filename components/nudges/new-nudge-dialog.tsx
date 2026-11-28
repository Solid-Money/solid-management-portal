"use client";

import { useId, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { EmailFields } from "@/components/nudges/email-fields";
import { PushFields } from "@/components/nudges/push-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCreateNudge } from "@/hooks/use-nudges";
import {
  formatDelay,
  isValidAppPath,
  pushCopyIssues,
  slugifyKey,
  type NudgeEmailDraft,
  type NudgePushDraft,
} from "@/lib/nudges";
import {
  NUDGE_CATEGORIES,
  type NudgeBoard,
  type NudgeCategory,
} from "@/types/nudges";

const NO_GROUP = "__none__";

interface NewNudgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: NudgeBoard;
  onCreated: (key: string) => void;
}

/**
 * Build a new nudge on something that already happens to users (an event the
 * backend reports, with the variables it carries), without a developer. It is
 * created as a draft: test it, then set it live from its editor.
 */
export function NewNudgeDialog({
  open,
  onOpenChange,
  board,
  onCreated,
}: NewNudgeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        {open ? (
          <NewNudgeForm
            board={board}
            onCancel={() => onOpenChange(false)}
            onCreated={onCreated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NewNudgeForm({
  board,
  onCancel,
  onCreated,
}: {
  board: NudgeBoard;
  onCancel: () => void;
  onCreated: (key: string) => void;
}) {
  const id = useId();
  const { catalog, settings } = board;
  const create = useCreateNudge();

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [flow, setFlow] = useState(catalog.flows[0]?.id ?? "");
  const [eventId, setEventId] = useState(catalog.events[0]?.id ?? "");
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [conditions, setConditions] = useState<string[]>([]);
  const [category, setCategory] = useState<NudgeCategory>("marketing");
  const [priority, setPriority] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [cooldownDays, setCooldownDays] = useState<number | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [withPush, setWithPush] = useState(true);
  const [withEmail, setWithEmail] = useState(false);
  const [push, setPush] = useState<NudgePushDraft>({
    enabled: true,
    title: "",
    body: "",
    path: catalog.destinations[0]?.path ?? "/",
    destinationId: catalog.destinations[0]?.id ?? null,
    imageUrl: null,
  });
  const [email, setEmail] = useState<NudgeEmailDraft>({
    enabled: true,
    templateId: null,
  });
  const [reason, setReason] = useState("");

  const event = catalog.events.find((e) => e.id === eventId) ?? null;
  const variables = useMemo(() => event?.variables ?? [], [event]);
  const effectiveKey = keyTouched ? key : slugifyKey(name);
  const taken = board.nudges.some((n) => n.key === effectiveKey);

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push("Give the nudge a name.");
    if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(effectiveKey)) {
      list.push("The key must be 2-60 lowercase letters, digits or dashes.");
    }
    if (taken) list.push(`A nudge with the key "${effectiveKey}" already exists.`);
    if (!event) list.push("Choose the event the nudge is built on.");
    if (!Number.isInteger(delayMinutes) || delayMinutes < 0) {
      list.push("The delay must be a whole number of minutes.");
    }
    if (!Number.isInteger(priority) || priority < 1 || priority > 7) {
      list.push("The priority must be a whole number from 1 to 7.");
    }
    if (withPush && uploading) list.push("Wait for the image upload to finish.");
    if (!withPush && !withEmail) list.push("Add a push, an email or both.");
    if (withPush) {
      for (const issue of pushCopyIssues(push, variables, catalog.limits, [])) {
        if (issue.level === "error") list.push(`Push: ${issue.message}`);
      }
      if (!isValidAppPath(push.path)) {
        list.push("Push: the screen it opens must be an in-app path.");
      }
    }
    if (withEmail && !email.templateId) list.push("Email: choose a Brevo template.");
    const trimmed = reason.trim();
    if (
      trimmed.length < catalog.limits.reasonMin ||
      trimmed.length > catalog.limits.reasonMax
    ) {
      list.push(`Give a reason of at least ${catalog.limits.reasonMin} characters.`);
    }
    return list;
  }, [
    name,
    effectiveKey,
    taken,
    event,
    delayMinutes,
    priority,
    uploading,
    withPush,
    withEmail,
    push,
    variables,
    catalog.limits,
    email.templateId,
    reason,
  ]);

  const submit = () => {
    create.mutate(
      {
        reason: reason.trim(),
        nudge: {
          key: effectiveKey,
          name: name.trim(),
          flow,
          ...(description.trim() ? { description: description.trim() } : {}),
          event: eventId,
          delayMinutes,
          conditions,
          category,
          priority,
          cooldownDays,
          suppressionGroup: group,
          push: withPush
            ? {
                title: push.title,
                body: push.body,
                path: push.path.trim(),
                destinationId: push.destinationId,
                imageUrl: push.imageUrl?.trim() || null,
              }
            : null,
          email:
            withEmail && email.templateId ? { templateId: email.templateId } : null,
        },
      },
      {
        onSuccess: (created) => {
          toast.success(`${created.name} created as a draft.`);
          onCreated(created.key);
        },
      }
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>New nudge</DialogTitle>
        <DialogDescription>
          Built on an event the app already reports, using only the variables
          that event carries. It starts as a draft: send yourself a test, then
          set it live from its editor.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friend joined"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-key`}>Key</Label>
          <Input
            id={`${id}-key`}
            value={effectiveKey}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value.toLowerCase());
            }}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${id}-description`}>Description (optional)</Label>
          <Textarea
            id={`${id}-description`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-event`}>Sent after</Label>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger id={`${id}-event`} className="w-full">
              <SelectValue placeholder="Choose an event" />
            </SelectTrigger>
            <SelectContent>
              {catalog.events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {event ? (
            <p className="text-xs text-gray-500">{event.description}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-delay`}>Delay (minutes)</Label>
          <Input
            id={`${id}-delay`}
            type="number"
            min={0}
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(Number(e.target.value))}
          />
          <p className="text-xs text-gray-500">{formatDelay(delayMinutes)}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-flow`}>Journey stage</Label>
          <Select value={flow} onValueChange={setFlow}>
            <SelectTrigger id={`${id}-flow`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {catalog.flows.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-category`}>Category</Label>
          <Select
            value={category}
            onValueChange={(next) => setCategory(next as NudgeCategory)}
          >
            <SelectTrigger id={`${id}-category`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NUDGE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-priority`}>Priority (1 = highest)</Label>
          <Input
            id={`${id}-priority`}
            type="number"
            min={1}
            max={7}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-cooldown`}>Cooldown (days)</Label>
          <Input
            id={`${id}-cooldown`}
            type="number"
            min={1}
            value={cooldownDays ?? ""}
            onChange={(e) =>
              setCooldownDays(e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder="No cooldown"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${id}-group`}>Shared cooldown group</Label>
          <Select
            value={group ?? NO_GROUP}
            onValueChange={(next) => setGroup(next === NO_GROUP ? null : next)}
          >
            <SelectTrigger id={`${id}-group`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_GROUP}>None</SelectItem>
              {settings.suppressionGroups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.label} (1 per {g.days}d)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {catalog.conditions.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Only send when (checked at send time)</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {catalog.conditions.map((condition) => (
              <label
                key={condition.id}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <Checkbox
                  checked={conditions.includes(condition.id)}
                  onCheckedChange={(next) =>
                    setConditions((current) =>
                      next === true
                        ? [...current, condition.id]
                        : current.filter((c) => c !== condition.id)
                    )
                  }
                />
                {condition.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-md border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${id}-with-push`}>Push</Label>
          <Switch id={`${id}-with-push`} checked={withPush} onCheckedChange={setWithPush} />
        </div>
        {withPush ? (
          <PushFields
            value={push}
            onChange={setPush}
            variables={variables}
            catalog={catalog}
            disabled={false}
            hideEnabled
            nudgeKey={effectiveKey || "new-nudge"}
            onUploadingChange={setUploading}
          />
        ) : null}
      </div>

      <div className="space-y-3 rounded-md border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${id}-with-email`}>Email</Label>
          <Switch
            id={`${id}-with-email`}
            checked={withEmail}
            onCheckedChange={setWithEmail}
          />
        </div>
        {withEmail ? (
          <EmailFields
            value={email}
            onChange={setEmail}
            variables={variables}
            disabled={false}
            hideEnabled
          />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-reason`}>Reason</Label>
        <Textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={catalog.limits.reasonMax}
          rows={2}
          placeholder="Why this nudge, in a sentence. Kept in the history and the audit log."
        />
      </div>

      {errors.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-gray-500">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={create.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={errors.length > 0 || create.isPending}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Create draft
        </Button>
      </DialogFooter>
    </>
  );
}
