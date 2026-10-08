"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SEVERITIES,
  SEVERITY_LABELS,
  WHO_ACTS,
  WHO_ACTS_HINTS,
  WHO_ACTS_LABELS,
} from "@/lib/errors";
import { formatDateTime } from "@/lib/utils";
import type {
  ErrorGroupRow,
  Severity,
  UpdateErrorGroupBody,
  WhoActs,
} from "@/types/errors";

const DAY_MS = 24 * 60 * 60 * 1000;

const TITLE_MAX = 80;
const ACTION_MAX = 160;

const SELECT_CLASS =
  "block h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

interface GroupFormProps {
  group: ErrorGroupRow;
  saving: boolean;
  onUpdate: (body: UpdateErrorGroupBody) => void;
}

/**
 * Where a group stands and who has it: the status buttons, an owner and a
 * note. Each status change saves at once; owner and note save together.
 */
export function TriagePanel({ group, saving, onUpdate }: GroupFormProps) {
  const ownerId = useId();
  const noteId = useId();
  const [owner, setOwner] = useState(group.owner ?? "");
  const [note, setNote] = useState(group.note ?? "");

  const changed =
    owner.trim() !== (group.owner ?? "") || note.trim() !== (group.note ?? "");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={saving || group.status === "acknowledged"}
          onClick={() => onUpdate({ status: "acknowledged" })}
        >
          Acknowledge
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={saving || group.status === "resolved"}
          onClick={() => onUpdate({ status: "resolved" })}
        >
          Resolve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={saving}
          onClick={() =>
            onUpdate({
              status: "muted",
              mutedUntil: new Date(Date.now() + DAY_MS).toISOString(),
            })
          }
        >
          Mute 24h
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={saving || group.status === "open"}
          onClick={() => onUpdate({ status: "open", mutedUntil: null })}
        >
          Reopen
        </Button>
      </div>

      {(group.updatedBy || (group.status === "muted" && group.mutedUntil)) && (
        <p className="text-xs text-gray-500">
          {group.status === "muted" && group.mutedUntil
            ? `Muted until ${formatDateTime(group.mutedUntil)}. `
            : ""}
          {group.updatedBy ? `Last changed by ${group.updatedBy}.` : ""}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={ownerId} className="text-xs text-gray-600">
          Owner
        </Label>
        <Input
          id={ownerId}
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
          placeholder="Who is looking into it"
          maxLength={80}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={noteId} className="text-xs text-gray-600">
          Note
        </Label>
        <Textarea
          id={noteId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What we know so far, a ticket link…"
          rows={3}
        />
      </div>
      <Button
        size="sm"
        className="cursor-pointer"
        disabled={saving || !changed}
        onClick={() =>
          onUpdate({ owner: owner.trim() || null, note: note.trim() || null })
        }
      >
        {saving && <Loader2 className="animate-spin" />}
        Save owner and note
      </Button>
    </div>
  );
}

interface LabelFormProps extends GroupFormProps {
  /** Opened from the "Needs a label" queue: start typing straight away. */
  autoFocus?: boolean;
  onCancel?: () => void;
}

/**
 * Explain a group in words support can repeat to a user. Saving any of these
 * marks the group labelled, which takes it out of the "Needs a label" queue.
 *
 * An unlabelled group's title and action are placeholders, so the form
 * starts empty for one rather than inviting an edit of "New error".
 */
export function LabelForm({
  group,
  saving,
  onUpdate,
  autoFocus = false,
  onCancel,
}: LabelFormProps) {
  const titleId = useId();
  const actionId = useId();
  const whoActsId = useId();
  const severityId = useId();
  const [title, setTitle] = useState(group.labelled ? group.title : "");
  const [action, setAction] = useState(group.labelled ? group.action : "");
  const [whoActs, setWhoActs] = useState<WhoActs>(group.whoActs);
  const [severity, setSeverity] = useState<Severity>(group.severity);

  const valid = title.trim().length > 0 && action.trim().length > 0;

  return (
    <form
      className="space-y-3 rounded-lg border border-gray-200 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onUpdate({ title: title.trim(), action: action.trim(), whoActs, severity });
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          {group.labelled ? "Edit label" : "Label this error"}
        </h3>
        <p className="text-xs text-gray-500">
          What went wrong and what to do about it, in plain English.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={titleId} className="text-xs text-gray-600">
            Title
          </Label>
          <span className="text-[10px] text-gray-400 tabular-nums">
            {title.length}/{TITLE_MAX}
          </span>
        </div>
        <Input
          id={titleId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Card declined: not enough balance"
          maxLength={TITLE_MAX}
          autoFocus={autoFocus}
          required
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={actionId} className="text-xs text-gray-600">
            What to do
          </Label>
          <span className="text-[10px] text-gray-400 tabular-nums">
            {action.length}/{ACTION_MAX}
          </span>
        </div>
        <Textarea
          id={actionId}
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="e.g. Ask the user to top up their card and try again"
          maxLength={ACTION_MAX}
          rows={2}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={whoActsId} className="text-xs text-gray-600">
            Who acts
          </Label>
          <select
            id={whoActsId}
            value={whoActs}
            onChange={(event) =>
              setWhoActs(
                WHO_ACTS.find((value) => value === event.target.value) ??
                  group.whoActs
              )
            }
            className={SELECT_CLASS}
          >
            {WHO_ACTS.map((value) => (
              <option key={value} value={value} title={WHO_ACTS_HINTS[value]}>
                {WHO_ACTS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={severityId} className="text-xs text-gray-600">
            Severity
          </Label>
          <select
            id={severityId}
            value={severity}
            onChange={(event) =>
              setSeverity(
                SEVERITIES.find((value) => value === event.target.value) ??
                  group.severity
              )
            }
            className={SELECT_CLASS}
          >
            {SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {SEVERITY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          className="cursor-pointer"
          disabled={saving || !valid}
        >
          {saving && <Loader2 className="animate-spin" />}
          Save label
        </Button>
        {onCancel && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="cursor-pointer"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
