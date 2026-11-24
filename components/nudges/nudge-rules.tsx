"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
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
import { useUpdateNudgeSettings } from "@/hooks/use-nudges";
import { diffSettings, settingsIssues } from "@/lib/nudges";
import type { NudgeBoard, NudgeSettingsView } from "@/types/nudges";

/**
 * The rules every marketing nudge follows: the marketing switch, consent, the
 * frequency cap, quiet hours and the shared cooldown groups.
 */
export function NudgeRules({ board }: { board: NudgeBoard }) {
  // Remounted after a save (new version), so the form starts from it.
  return (
    <NudgeRulesForm key={board.settings.version} board={board} />
  );
}

function NudgeRulesForm({ board }: { board: NudgeBoard }) {
  const id = useId();
  const saved = board.settings;
  const editable = board.canEdit && board.migrated;
  const [draft, setDraft] = useState<NudgeSettingsView>(saved);
  const [reviewing, setReviewing] = useState(false);
  const update = useUpdateNudgeSettings();

  const { patch, changes } = useMemo(() => diffSettings(saved, draft), [saved, draft]);
  const issues = useMemo(() => settingsIssues(draft), [draft]);
  const dirty = changes.length > 0;

  const warnings: string[] = [];
  if (saved.marketingEnabled && !draft.marketingEnabled) {
    warnings.push("Every marketing nudge stops sending until this is turned back on.");
  }
  if (saved.respectMarketingConsent && !draft.respectMarketingConsent) {
    warnings.push(
      "Users who declined marketing at signup will start getting marketing nudges."
    );
  }

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
                disabled={!editable || !draft.frequencyCap.enabled}
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
                disabled={!editable || !draft.frequencyCap.enabled}
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
                disabled={!editable || !draft.quietHours.enabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-quiet-end`}>Until</Label>
              <Input
                id={`${id}-quiet-end`}
                type="time"
                value={draft.quietHours.end}
                onChange={(e) => setQuiet({ end: e.target.value })}
                disabled={!editable || !draft.quietHours.enabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-quiet-zone`}>Fallback time zone</Label>
              <Input
                id={`${id}-quiet-zone`}
                value={draft.quietHours.fallbackTimezone}
                onChange={(e) => setQuiet({ fallbackTimezone: e.target.value })}
                placeholder="UTC"
                disabled={!editable || !draft.quietHours.enabled}
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
                  const isNew = !saved.suppressionGroups.some((g) => g.id === group.id);
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={group.id}
                          onChange={(e) =>
                            setGroup(index, { id: e.target.value.toLowerCase() })
                          }
                          className="font-mono"
                          aria-label="Group id"
                          disabled={!editable || !isNew}
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
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              suppressionGroups: d.suppressionGroups.filter(
                                (_, i) => i !== index
                              ),
                            }))
                          }
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
            onClick={() =>
              setDraft((d) => ({
                ...d,
                suppressionGroups: [
                  ...d.suppressionGroups,
                  { id: "", label: "", days: 30 },
                ],
              }))
            }
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
            onClick={() => setDraft(saved)}
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
        open={reviewing}
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
        onConfirm={(reason) =>
          update.mutate(
            { expectedVersion: saved.version, reason, changes: patch },
            {
              onSuccess: (settings) => {
                setReviewing(false);
                toast.success(`Rules saved as v${settings.version}.`);
              },
            }
          )
        }
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
