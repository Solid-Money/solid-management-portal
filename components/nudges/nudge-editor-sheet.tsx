"use client";

import { useId, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowRight, Hammer, Loader2, Lock, Save } from "lucide-react";
import { toast } from "sonner";

import { EmailFields } from "@/components/nudges/email-fields";
import { STATUS_VARIANT } from "@/components/nudges/nudge-node";
import { NudgeReviewDialog } from "@/components/nudges/nudge-review-dialog";
import { NudgeTestPanel } from "@/components/nudges/nudge-test-panel";
import { NudgeVersions } from "@/components/nudges/nudge-versions";
import { PushFields } from "@/components/nudges/push-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useNudgeDetail, useUpdateNudge } from "@/hooks/use-nudges";
import {
  diffNudge,
  draftFromNudge,
  formatDelay,
  isEditable,
  isValidAppPath,
  pushCopyIssues,
  type NudgeDraft,
} from "@/lib/nudges";
import {
  NUDGE_CATEGORIES,
  NUDGE_STATUSES,
  type NudgeBoard,
  type NudgeCategory,
  type NudgeStatus,
  type NudgeView,
} from "@/types/nudges";

const NO_GROUP = "__none__";

interface NudgeEditorSheetProps {
  nudgeKey: string | null;
  board: NudgeBoard;
  onClose: () => void;
}

/** One nudge: what it is, its push and email, a test send and its history. */
export function NudgeEditorSheet({ nudgeKey, board, onClose }: NudgeEditorSheetProps) {
  const detail = useNudgeDetail(nudgeKey);
  const fromBoard = board.nudges.find((n) => n.key === nudgeKey) ?? null;
  const nudge = detail.data?.nudge ?? fromBoard;

  return (
    <Sheet open={nudgeKey !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-3xl">
        {nudge ? (
          // Remounted per nudge and per saved version, so a save or someone
          // else's change starts the form from what is stored.
          <NudgeEditorForm
            key={`${nudge.key}:${nudge.version}`}
            nudge={nudge}
            board={board}
            versions={detail.data?.versions ?? []}
            versionsLoading={detail.isLoading}
          />
        ) : (
          <SheetHeader>
            <SheetTitle>Nudge not found</SheetTitle>
            <SheetDescription>
              It may have been archived or renamed. Close this and reload.
            </SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NudgeEditorForm({
  nudge,
  board,
  versions,
  versionsLoading,
}: {
  nudge: NudgeView;
  board: NudgeBoard;
  versions: NonNullable<ReturnType<typeof useNudgeDetail>["data"]>["versions"];
  versionsLoading: boolean;
}) {
  const id = useId();
  const { catalog, settings } = board;
  const editable = isEditable(nudge, board.canEdit);
  const [draft, setDraft] = useState<NudgeDraft>(() => draftFromNudge(nudge));
  const [reviewing, setReviewing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const update = useUpdateNudge();

  const { patch, changes } = useMemo(() => diffNudge(nudge, draft), [nudge, draft]);
  const dirty = changes.length > 0;

  const { errors, warnings } = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!draft.name.trim()) errors.push("The nudge needs a name.");
    if (draft.push?.enabled) {
      for (const issue of pushCopyIssues(
        draft.push,
        nudge.variables,
        catalog.limits,
        catalog.copyRules
      )) {
        (issue.level === "error" ? errors : warnings).push(`Push: ${issue.message}`);
      }
      if (!isValidAppPath(draft.push.path)) {
        errors.push("Push: the screen it opens must be an in-app path.");
      }
    }
    if (draft.email?.enabled && !draft.email.templateId) {
      errors.push("Email: choose a Brevo template, or turn the email off.");
    }
    if (draft.status === "live" && !nudge.implemented) {
      errors.push("This nudge's trigger is not built yet, so it cannot go live.");
    }
    if (
      (draft.status === "paused" || draft.status === "archived") &&
      !nudge.canPause
    ) {
      errors.push("This nudge must always send; it cannot be paused or archived.");
    }
    if (!Number.isInteger(draft.priority) || draft.priority < 1 || draft.priority > 7) {
      errors.push("Priority must be a whole number from 1 to 7.");
    }
    if (
      draft.cooldownDays !== null &&
      (!Number.isInteger(draft.cooldownDays) || draft.cooldownDays < 1)
    ) {
      errors.push("Cooldown must be a whole number of days, or empty.");
    }
    if (
      nudge.trigger.delayEditable &&
      draft.delayMinutes !== null &&
      (!Number.isInteger(draft.delayMinutes) || draft.delayMinutes < 0)
    ) {
      errors.push("The delay must be a whole number of minutes.");
    }
    if (nudge.status !== "live" && draft.status === "live") {
      warnings.push(
        nudge.category === "marketing"
          ? "Going live: this marketing nudge starts reaching users within a minute."
          : "Going live: this nudge starts sending within a minute."
      );
    }
    return { errors, warnings };
  }, [draft, nudge, catalog]);

  const set = (patchDraft: Partial<NudgeDraft>) =>
    setDraft((current) => ({ ...current, ...patchDraft }));

  const save = (reason: string) => {
    update.mutate(
      {
        key: nudge.key,
        input: { expectedVersion: nudge.version, reason, changes: patch },
      },
      {
        onSuccess: (saved) => {
          setReviewing(false);
          toast.success(`${saved.name} saved as v${saved.version}.`);
        },
        onError: (error) => {
          if (isAxiosError(error) && error.response?.status === 409) {
            setReviewing(false);
            setConflict(true);
          }
        },
      },
    );
  };

  const flowLabel =
    catalog.flows.find((f) => f.id === nudge.flow)?.label ?? nudge.flow;

  return (
    <div className="flex flex-col gap-6 p-6">
      <SheetHeader className="p-0">
        <SheetTitle className="flex flex-wrap items-center gap-2 pr-8">
          {nudge.name}
          <Badge variant={STATUS_VARIANT[nudge.status]}>{nudge.status}</Badge>
          <Badge variant={nudge.category === "marketing" ? "info" : "muted"}>
            {nudge.category}
          </Badge>
          {!nudge.implemented ? (
            <Badge variant="warning">
              <Hammer />
              not built yet
            </Badge>
          ) : null}
        </SheetTitle>
        <SheetDescription>
          <span className="font-mono">{nudge.key}</span> · {flowLabel} · v
          {nudge.version}
          {nudge.updatedBy ? ` · last saved by ${nudge.updatedBy}` : ""}
        </SheetDescription>
      </SheetHeader>

      {!editable ? (
        <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          {!nudge.managed
            ? "This push is owned by code (it confirms a payment or a security step), so it is shown here read-only."
            : nudge.source === "code"
              ? "Read-only until the nudges are moved to the database (Scripts → Automated nudges migrations)."
              : "You can view this nudge but not change it (NUDGE_ADMIN_EMAILS)."}
        </p>
      ) : null}
      {nudge.note ? (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {nudge.note}
        </p>
      ) : null}
      {conflict ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Someone saved this nudge after you opened it. Close and reopen it to
          load their version, then make your change again.
        </p>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">When and who</h3>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[120px_1fr]">
          <dt className="text-gray-500">Trigger</dt>
          <dd className="text-gray-800">
            {nudge.trigger.label}
            {nudge.trigger.event ? (
              <span className="ml-1 font-mono text-xs text-gray-500">
                ({nudge.trigger.event})
              </span>
            ) : null}
          </dd>
          <dt className="text-gray-500">Audience</dt>
          <dd className="text-gray-800">{nudge.audience}</dd>
          {nudge.stopWhen ? (
            <>
              <dt className="text-gray-500">Stops when</dt>
              <dd className="text-gray-800">{nudge.stopWhen}</dd>
            </>
          ) : null}
          {nudge.stats ? (
            <>
              <dt className="text-gray-500">Last 30 days</dt>
              <dd className="text-gray-800">
                {nudge.stats.sent} sent ({nudge.stats.pushSent} push,{" "}
                {nudge.stats.emailSent} email) · {nudge.stats.skipped} skipped
                {Object.keys(nudge.stats.byReason).length > 0
                  ? ` (${Object.entries(nudge.stats.byReason)
                      .map(([reason, count]) => `${reason.replace(/_/g, " ")} ${count}`)
                      .join(", ")})`
                  : ""}
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">General</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              id={`${id}-name`}
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              disabled={!editable}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${id}-description`}>Description</Label>
            <Textarea
              id={`${id}-description`}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              disabled={!editable}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-status`}>Status</Label>
            <Select
              value={draft.status}
              onValueChange={(status) => set({ status: status as NudgeStatus })}
              disabled={!editable}
            >
              <SelectTrigger id={`${id}-status`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUDGE_STATUSES.map((status) => (
                  <SelectItem
                    key={status}
                    value={status}
                    disabled={
                      (status === "live" && !nudge.implemented) ||
                      ((status === "paused" || status === "archived") &&
                        !nudge.canPause)
                    }
                  >
                    {status === "archived" ? "archived (removed)" : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-category`}>Category</Label>
            <Select
              value={draft.category}
              onValueChange={(category) =>
                set({ category: category as NudgeCategory })
              }
              disabled={!editable}
            >
              <SelectTrigger id={`${id}-category`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUDGE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
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
              value={draft.priority}
              onChange={(e) => set({ priority: Number(e.target.value) })}
              disabled={!editable}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-cooldown`}>Cooldown (days)</Label>
            <Input
              id={`${id}-cooldown`}
              type="number"
              min={1}
              value={draft.cooldownDays ?? ""}
              onChange={(e) =>
                set({
                  cooldownDays: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="No cooldown"
              disabled={!editable}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-group`}>Shared cooldown group</Label>
            <Select
              value={draft.suppressionGroup ?? NO_GROUP}
              onValueChange={(group) =>
                set({ suppressionGroup: group === NO_GROUP ? null : group })
              }
              disabled={!editable}
            >
              <SelectTrigger id={`${id}-group`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GROUP}>None</SelectItem>
                {settings.suppressionGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.label} (1 per {group.days}d)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {nudge.trigger.delayEditable ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-delay`}>Delay after the trigger (minutes)</Label>
              <Input
                id={`${id}-delay`}
                type="number"
                min={0}
                value={draft.delayMinutes ?? ""}
                onChange={(e) =>
                  set({
                    delayMinutes: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                disabled={!editable}
              />
              <p className="text-xs text-gray-500">{formatDelay(draft.delayMinutes)}</p>
            </div>
          ) : null}
        </div>

        {nudge.trigger.event && catalog.conditions.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Only send when</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {catalog.conditions.map((condition) => {
                const checked = draft.conditions.includes(condition.id);
                return (
                  <label
                    key={condition.id}
                    className="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        set({
                          conditions:
                            next === true
                              ? [...draft.conditions, condition.id]
                              : draft.conditions.filter((c) => c !== condition.id),
                        })
                      }
                      disabled={!editable}
                    />
                    {condition.label}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {draft.push ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Push</h3>
          <PushFields
            value={draft.push}
            onChange={(push) => set({ push })}
            variables={nudge.variables}
            catalog={catalog}
            disabled={!editable}
            nudgeKey={nudge.key}
          />
        </section>
      ) : (
        <p className="text-sm text-gray-500">This nudge has no push.</p>
      )}

      {draft.email ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Email</h3>
          <EmailFields
            value={draft.email}
            onChange={(email) => set({ email })}
            variables={nudge.variables}
            disabled={!editable}
          />
        </section>
      ) : (
        <p className="text-sm text-gray-500">This nudge has no email.</p>
      )}

      {nudge.edges.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Links</h3>
          <ul className="space-y-1 text-sm text-gray-700">
            {nudge.edges.map((edge) => (
              <li key={`${edge.kind}:${edge.to}`} className="flex items-center gap-2">
                <Badge variant="muted">{edge.kind}</Badge>
                <ArrowRight className="h-3 w-3 text-gray-400" />
                <span className="font-mono text-xs">{edge.to}</span>
                {edge.label ? (
                  <span className="text-xs text-gray-500">{edge.label}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nudge.managed && nudge.source === "config" && board.canEdit ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Send a test</h3>
          <NudgeTestPanel
            nudge={nudge}
            draft={{ push: patch.push, email: patch.email }}
          />
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">History</h3>
        {versionsLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        ) : (
          <NudgeVersions
            nudge={nudge}
            versions={versions}
            catalog={catalog}
            canRestore={editable}
          />
        )}
      </section>

      {editable ? (
        <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-6 py-3">
          <span className="text-sm text-gray-500">
            {dirty
              ? `${changes.length} unsaved change${changes.length === 1 ? "" : "s"}`
              : "No changes"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDraft(draftFromNudge(nudge))}
              disabled={!dirty || update.isPending}
            >
              Discard
            </Button>
            <Button onClick={() => setReviewing(true)} disabled={!dirty || update.isPending}>
              <Save />
              Review and save
            </Button>
          </div>
        </div>
      ) : null}

      <NudgeReviewDialog
        open={reviewing}
        onOpenChange={setReviewing}
        title={`Save ${nudge.name}`}
        description="These changes apply to the next sends, within a minute. The reason goes in the history and the audit log."
        changes={changes}
        warnings={warnings}
        errors={errors}
        reasonMin={catalog.limits.reasonMin}
        reasonMax={catalog.limits.reasonMax}
        saving={update.isPending}
        confirmLabel={`Save as v${nudge.version + 1}`}
        destructive={draft.status === "archived" && nudge.status !== "archived"}
        onConfirm={save}
      />
    </div>
  );
}
