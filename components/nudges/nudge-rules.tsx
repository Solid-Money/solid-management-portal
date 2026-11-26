"use client";

import { useId, useMemo, useState } from "react";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { NudgeReviewDialog } from "@/components/nudges/nudge-review-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isVersionConflict, useUpdateNudgeSettings } from "@/hooks/use-nudges";
import {
  diffSettings,
  isValidTimeZone,
  rebaseSettings,
  settingsIssues,
} from "@/lib/nudges";
import type { NudgeBoard, NudgeSettingsView } from "@/types/nudges";

/** A row of the groups table: a stable React key, and whether its id is saved. */
interface GroupRow {
  rowKey: string;
  /** The id came from the saved rules, so it can no longer be changed. */
  locked: boolean;
}

let groupRowSeq = 0;

/** Rows for `groups`: an id already in `baseline` is locked, any other is new. */
function groupRows(
  groups: NudgeSettingsView["suppressionGroups"],
  baseline: NudgeSettingsView
): GroupRow[] {
  const savedIds = new Set(baseline.suppressionGroups.map((g) => g.id));
  return groups.map((g) => ({
    rowKey: `group-${(groupRowSeq += 1)}`,
    locked: savedIds.has(g.id),
  }));
}

/**
 * The rules every marketing nudge follows: the marketing switch, consent, the
 * frequency cap, quiet hours and the shared cooldown groups.
 */
export function NudgeRules({ board }: { board: NudgeBoard }) {
  return <NudgeRulesForm board={board} />;
}

function NudgeRulesForm({ board }: { board: NudgeBoard }) {
  const id = useId();
  /** The rules as saved now (refreshes when anyone saves them). */
  const latest = board.settings;
  const editable = board.canEdit && board.migrated;
  // The version this edit started from. The diff, the review and the save's
  // expectedVersion are all against it, never against whatever arrives later.
  const [saved, setBaseline] = useState<NudgeSettingsView>(latest);
  const [draft, setDraft] = useState<NudgeSettingsView>(latest);
  const [rows, setRows] = useState<GroupRow[]>(() =>
    groupRows(latest.suppressionGroups, latest)
  );
  const [reviewing, setReviewing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [overlapping, setOverlapping] = useState<string[]>([]);
  const update = useUpdateNudgeSettings();

  const { patch, changes } = useMemo(() => diffSettings(saved, draft), [saved, draft]);
  const issues = useMemo(() => settingsIssues(draft), [draft]);
  const dirty = changes.length > 0;
  const behind = latest.version > saved.version;

  /** Start over from `next`, as both the baseline and the draft. */
  const resetTo = (next: NudgeSettingsView) => {
    setBaseline(next);
    setDraft(next);
    setRows(groupRows(next.suppressionGroups, next));
    setConflict(false);
    setOverlapping([]);
  };

  // Someone saved a newer version while nothing here is unsaved: follow it.
  // (Adjusted during render, so the old version never flashes.)
  if (behind && !dirty) resetTo(latest);

  /** Keep the edit, re-applied on top of what is saved now. */
  const reapply = () => {
    const rebased = rebaseSettings(saved, draft, latest);
    setBaseline(latest);
    setDraft(rebased.draft);
    setRows(groupRows(rebased.draft.suppressionGroups, latest));
    setConflict(false);
    setOverlapping(rebased.overlapping);
  };

  const warnings: string[] = [];
  if (saved.marketingEnabled && !draft.marketingEnabled) {
    warnings.push("Every marketing nudge stops sending until this is turned back on.");
  }
  if (saved.respectMarketingConsent && !draft.respectMarketingConsent) {
    warnings.push(
      draft.marketingEnabled
        ? "Users who declined marketing at signup will start getting marketing nudges."
        : "Users who declined marketing at signup will also get marketing nudges once marketing is turned back on."
    );
  } else if (
    !saved.marketingEnabled &&
    draft.marketingEnabled &&
    !draft.respectMarketingConsent
  ) {
    warnings.push(
      "Marketing nudges resume for everyone, including users who declined marketing at signup."
    );
  }

  // A field stays editable while its rule is off if its value is invalid, so
  // the admin can still correct what would be saved.
  const capDayOk = Number.isInteger(draft.frequencyCap.perDay) && draft.frequencyCap.perDay >= 1;
  const capWeekOk =
    Number.isInteger(draft.frequencyCap.perWeek) &&
    draft.frequencyCap.perWeek >= 1 &&
    (!capDayOk || draft.frequencyCap.perWeek >= draft.frequencyCap.perDay);
  const timeOk = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const zoneOk = isValidTimeZone(draft.quietHours.fallbackTimezone);
  const capField = (ok: boolean) => !editable || (!draft.frequencyCap.enabled && ok);
  const quietField = (ok: boolean) => !editable || (!draft.quietHours.enabled && ok);

  const setCap = (patchCap: Partial<NudgeSettingsView["frequencyCap"]>) =>
    setDraft((d) => ({ ...d, frequencyCap: { ...d.frequencyCap, ...patchCap } }));
  const setQuiet = (patchQuiet: Partial<NudgeSettingsView["quietHours"]>) =>
    setDraft((d) => ({ ...d, quietHours: { ...d.quietHours, ...patchQuiet } }));
  const setGroup = (
    index: number,
    patchGroup: Partial<NudgeSettingsView["suppressionGroups"][number]>
  ) =>
    setDraft((d) => ({
      ...d,
      suppressionGroups: d.suppressionGroups.map((g, i) =>
        i === index ? { ...g, ...patchGroup } : g
      ),
    }));
  const addGroup = () => {
    setDraft((d) => ({
      ...d,
      suppressionGroups: [...d.suppressionGroups, { id: "", label: "", days: 30 }],
    }));
    setRows((r) => [...r, { rowKey: `group-${(groupRowSeq += 1)}`, locked: false }]);
  };
  const removeGroup = (index: number) => {
    setDraft((d) => ({
      ...d,
      suppressionGroups: d.suppressionGroups.filter((_, i) => i !== index),
    }));
    setRows((r) => r.filter((_, i) => i !== index));
  };

  const save = (reason: string) => {
    if (!editable) return;
    update.mutate(
      { expectedVersion: saved.version, reason, changes: patch },
      {
        onSuccess: (settings) => {
          setReviewing(false);
          resetTo(settings);
          toast.success(`Rules saved as v${settings.version}.`);
        },
        onError: (error) => {
          // Someone saved first: keep the dialog and the edit; the hook fetches
          // their version, and the admin re-applies this edit on top of it.
          if (isVersionConflict(error)) setConflict(true);
        },
      }
    );
  };

  const choices = (onDiscard: () => void) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={reapply}>
        <RefreshCw />
        Re-apply my changes on v{latest.version}
      </Button>
      <Button size="sm" variant="outline" onClick={onDiscard}>
        Discard mine and load v{latest.version}
      </Button>
    </div>
  );

  const conflictNotice = conflict ? (
    <div className="space-y-2">
      <p>
        Someone saved the rules after you started, so this save was refused.
        {behind
          ? ` Their version is v${latest.version}${latest.updatedBy ? `, by ${latest.updatedBy}` : ""}.`
          : " Loading their version…"}
      </p>
      {behind
        ? choices(() => {
            resetTo(latest);
            setReviewing(false);
          })
        : null}
    </div>
  ) : undefined;

  return (
    <div className="space-y-4">
      {!board.migrated ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The rules can be changed once the nudges are moved to the database.
        </p>
      ) : null}
      {saved.updatedBy ? (
        <p className="text-xs text-gray-500">
          v{saved.version}, last saved by {saved.updatedBy}
          {saved.updatedAt ? ` on ${new Date(saved.updatedAt).toLocaleString()}` : ""}
        </p>
      ) : null}
      {behind && dirty && !reviewing ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p>
            A newer version of the rules (v{latest.version}
            {latest.updatedBy ? `, by ${latest.updatedBy}` : ""}) was saved by
            someone else. Your unsaved changes started from v{saved.version}.
          </p>
          {choices(() => resetTo(latest))}
        </div>
      ) : null}
      {overlapping.length > 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your changes were re-applied on v{saved.version}. These rules were also
          changed in that version and now hold your value:{" "}
          <span className="font-mono">{overlapping.join(", ")}</span>. Check them
          before saving.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marketing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id={`${id}-marketing`}
            label="Send marketing nudges"
            hint="Off holds every marketing nudge. Transactional ones (deposits, KYC, card) still send."
            checked={draft.marketingEnabled}
            onChange={(marketingEnabled) => setDraft((d) => ({ ...d, marketingEnabled }))}
            disabled={!editable}
          />
          <ToggleRow
            id={`${id}-consent`}
            label="Respect marketing consent"
            hint="Skip marketing nudges for users who declined marketing at signup."
            checked={draft.respectMarketingConsent}
            onChange={(respectMarketingConsent) =>
              setDraft((d) => ({ ...d, respectMarketingConsent }))
            }
            disabled={!editable}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frequency cap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id={`${id}-cap`}
            label="Cap marketing nudges per user"
            hint="A push and its email for the same nudge count as one. Transactional nudges never count."
            checked={draft.frequencyCap.enabled}
            onChange={(enabled) => setCap({ enabled })}
            disabled={!editable}
          />
          <div className="grid max-w-md gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-per-day`}>Per day</Label>
              <Input
                id={`${id}-per-day`}
                type="number"
                min={1}
                value={draft.frequencyCap.perDay}
                onChange={(e) => setCap({ perDay: Number(e.target.value) })}
                disabled={capField(capDayOk)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-per-week`}>Per rolling 7 days</Label>
              <Input
                id={`${id}-per-week`}
                type="number"
                min={1}
                value={draft.frequencyCap.perWeek}
                onChange={(e) => setCap({ perWeek: Number(e.target.value) })}
                disabled={capField(capWeekOk)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quiet hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id={`${id}-quiet`}
            label="Hold marketing pushes overnight"
            hint="A marketing push due in this window waits until it ends, in the user's own time zone."
            checked={draft.quietHours.enabled}
            onChange={(enabled) => setQuiet({ enabled })}
            disabled={!editable}
          />
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-quiet-start`}>From</Label>
              <Input
                id={`${id}-quiet-start`}
                type="time"
                value={draft.quietHours.start}
                onChange={(e) => setQuiet({ start: e.target.value })}
                disabled={quietField(timeOk(draft.quietHours.start))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-quiet-end`}>Until</Label>
              <Input
                id={`${id}-quiet-end`}
                type="time"
                value={draft.quietHours.end}
                onChange={(e) => setQuiet({ end: e.target.value })}
                disabled={quietField(timeOk(draft.quietHours.end))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-quiet-zone`}>Fallback time zone</Label>
              <Input
                id={`${id}-quiet-zone`}
                value={draft.quietHours.fallbackTimezone}
                onChange={(e) => setQuiet({ fallbackTimezone: e.target.value })}
                placeholder="UTC"
                disabled={quietField(zoneOk)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Used for users whose time zone is unknown (an IANA zone such as
            Europe/Berlin).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shared cooldown groups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500">
            Nudges in one group share a cooldown: a user gets at most one of
            them per period (for example one invite ask per 30 days). Put a
            nudge in a group from its editor.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Id</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="w-32">Days</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.suppressionGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                    No groups.
                  </TableCell>
                </TableRow>
              ) : (
                draft.suppressionGroups.map((group, index) => {
                  const row = rows[index];
                  return (
                    <TableRow key={row?.rowKey ?? index}>
                      <TableCell>
                        <Input
                          value={group.id}
                          onChange={(e) =>
                            setGroup(index, { id: e.target.value.toLowerCase() })
                          }
                          className="font-mono"
                          aria-label="Group id"
                          disabled={!editable || (row?.locked ?? false)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={group.label}
                          onChange={(e) => setGroup(index, { label: e.target.value })}
                          aria-label="Group label"
                          disabled={!editable}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={group.days}
                          onChange={(e) => setGroup(index, { days: Number(e.target.value) })}
                          aria-label="Days"
                          disabled={!editable}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeGroup(index)}
                          aria-label={`Remove group ${group.id}`}
                          disabled={!editable}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <Button
            variant="outline"
            size="sm"
            onClick={addGroup}
            disabled={!editable}
          >
            <Plus />
            Add group
          </Button>
        </CardContent>
      </Card>

      {issues.length > 0 && dirty ? (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-red-700">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      {editable ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => resetTo(behind ? latest : saved)}
            disabled={!dirty || update.isPending}
          >
            Discard
          </Button>
          <Button onClick={() => setReviewing(true)} disabled={!dirty || update.isPending}>
            <Save />
            Review and save
          </Button>
        </div>
      ) : null}

      <NudgeReviewDialog
        // Closed while the board is read-only; reviewing is kept, so it
        // reopens if edit rights come back.
        open={reviewing && editable}
        onOpenChange={setReviewing}
        title="Save the nudge rules"
        description="The rules apply to every nudge sent from now on, within a minute."
        changes={changes}
        warnings={warnings}
        errors={issues}
        reasonMin={board.catalog.limits.reasonMin}
        reasonMax={board.catalog.limits.reasonMax}
        saving={update.isPending}
        confirmLabel={`Save as v${saved.version + 1}`}
        destructive={warnings.length > 0}
        notice={conflictNotice}
        onConfirm={save}
      />
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
