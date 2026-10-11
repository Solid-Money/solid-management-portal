"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import SupportMeGate from "@/components/support/support-me-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteSupportMacro,
  useSaveSupportMacro,
  useSupportMacros,
  useSupportSettings,
  useSupportSettingsHistory,
  useUpdateSupportSettings,
} from "@/hooks/use-support";
import { agentShortName, dateTime, intentLabel } from "@/components/support/support-format";
import { cn } from "@/lib/utils";
import {
  ALWAYS_HUMAN_INTENTS,
  SUPPORT_INTENTS,
  type SupportAgentProfile,
  type SupportIncident,
  type SupportMacro,
  type SupportMe,
  type SupportSettings,
} from "@/types/support";

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const MODES: Array<{ value: SupportSettings["aiMode"]; label: string; help: string }> = [
  { value: "off", label: "Off", help: "Every case goes straight to the queue. Customers get the acknowledgement." },
  { value: "shadow", label: "Shadow", help: "Solid AI drafts every reply for an agent to approve; nothing is sent on its own." },
  { value: "on", label: "On", help: "Solid AI answers intents on the allowlist when it is confident; everything else is drafted or handed off." },
];

type Draft = Pick<
  SupportSettings,
  | "aiMode"
  | "intentAllowlist"
  | "guidance"
  | "glossary"
  | "coreFacts"
  | "expectedReplyText"
  | "missingFundsThresholdUsd"
  | "businessHours"
  | "onCall"
  | "agentProfiles"
  | "incidents"
>;

function fromSettings(settings: SupportSettings): Draft {
  return {
    aiMode: settings.aiMode,
    intentAllowlist: settings.intentAllowlist,
    guidance: settings.guidance,
    glossary: settings.glossary,
    coreFacts: settings.coreFacts,
    expectedReplyText: settings.expectedReplyText,
    missingFundsThresholdUsd: settings.missingFundsThresholdUsd,
    businessHours: settings.businessHours,
    onCall: settings.onCall,
    agentProfiles: settings.agentProfiles,
    incidents: settings.incidents,
  };
}

/** Only the fields that differ, so a save never overwrites someone else's change to another field. */
function changedFields(before: Draft, after: Draft): Partial<Draft> {
  const patch: Partial<Draft> = {};
  for (const key of Object.keys(after) as Array<keyof Draft>) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      (patch as Record<string, unknown>)[key] = after[key];
    }
  }
  return patch;
}

/** Mounted only while open, so it always starts from the reply being edited. */
function MacroDialog({
  macro,
  open,
  onClose,
}: {
  macro: SupportMacro | null;
  open: boolean;
  onClose: () => void;
}) {
  const save = useSaveSupportMacro();
  const [title, setTitle] = useState(macro?.title ?? "");
  const [body, setBody] = useState(macro?.body ?? "");
  const [shortcut, setShortcut] = useState(macro?.shortcut ?? "");
  const valid = title.trim() && body.trim() && (!shortcut || /^[a-z0-9-]{2,30}$/.test(shortcut));
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{macro ? "Edit saved reply" : "New saved reply"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="macro-title">Title</Label>
            <Input id="macro-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="macro-body">Reply (English)</Label>
            <Textarea id="macro-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="text-xs text-gray-500">
              Variables: {"{firstName}"}, {"{username}"}, {"{caseNumber}"}, {"{agentName}"}. The customer receives it in their language.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="macro-shortcut">Shortcut (optional)</Label>
            <Input id="macro-shortcut" value={shortcut} onChange={(e) => setShortcut(e.target.value.toLowerCase())} placeholder="e.g. kyc-retry" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate(
                { id: macro?.id, title: title.trim(), body: body.trim(), shortcut: shortcut || undefined },
                { onSuccess: () => { toast.success("Saved reply saved"); onClose(); } },
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsScreen({ me }: { me: SupportMe }) {
  const { data, isLoading } = useSupportSettings();
  const history = useSupportSettingsHistory();
  const macros = useSupportMacros();
  const deleteMacro = useDeleteSupportMacro();
  const update = useUpdateSupportSettings();
  // Local edits on top of what is saved; null means "nothing changed yet".
  const [edits, setEdits] = useState<Draft | null>(null);
  const [macroOpen, setMacroOpen] = useState(false);
  const [editing, setEditing] = useState<SupportMacro | null>(null);

  const saved = useMemo(() => (data ? fromSettings(data.settings) : null), [data]);
  const draft = edits ?? saved;

  if (isLoading || !draft || !saved || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const patch = changedFields(saved, draft);
  const dirty = Object.keys(patch).length > 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setEdits((current) => ({ ...(current ?? saved), [key]: value }));
  // Everyone on the roster, plus anyone who already has a profile.
  const agents = [...new Set([...me.agents, ...draft.agentProfiles.map((profile) => profile.email)])].sort();
  const profileFor = (email: string): SupportAgentProfile =>
    draft.agentProfiles.find((profile) => profile.email === email) ?? { email, name: "" };
  const setProfile = (email: string, changes: Partial<SupportAgentProfile>) => {
    const next = { ...profileFor(email), ...changes };
    const others = draft.agentProfiles.filter((profile) => profile.email !== email);
    set("agentProfiles", next.name.trim() ? [...others, { ...next, ...(next.slackUserId ? {} : { slackUserId: undefined }) }] : others);
  };

  const saveAll = () =>
    update.mutate(
      {
        ...patch,
        ...(patch.agentProfiles && {
          agentProfiles: patch.agentProfiles.map((p) => ({
            email: p.email,
            name: p.name.trim(),
            ...(p.slackUserId?.trim() ? { slackUserId: p.slackUserId.trim() } : {}),
          })),
        }),
      },
      {
        onSuccess: () => {
          setEdits(null);
          toast.success("Support settings saved");
        },
      },
    );

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Support settings</h1>
          <p className="text-sm text-gray-500">
            Version {data.settings.version}
            {data.settings.updatedBy ? ` · last changed by ${data.settings.updatedBy} ${dateTime(data.settings.updatedAt)}` : ""}
            {!data.translationAvailable && " · translation is not set up on this environment"}
          </p>
        </div>
      </div>

      <Section title="Solid AI" description="Changes apply to the next turn on every server (within 15 seconds). Off is the kill switch.">
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => set("aiMode", mode.value)}
              className={cn(
                "rounded-lg border p-3 text-left",
                draft.aiMode === mode.value ? "border-indigo-600 bg-indigo-50" : "border-gray-200 hover:bg-gray-50",
              )}
            >
              <span className="text-sm font-semibold text-gray-900">{mode.label}</span>
              <p className="mt-1 text-xs text-gray-600">{mode.help}</p>
            </button>
          ))}
        </div>

        <div className="mt-5">
          <Label>Intents Solid AI may answer on its own (mode On)</Label>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {SUPPORT_INTENTS.map((intent) => {
              const humanOnly = ALWAYS_HUMAN_INTENTS.has(intent);
              const checked = draft.intentAllowlist.includes(intent);
              return (
                <label key={intent} className={cn("flex items-center gap-2 text-sm", humanOnly && "text-gray-400")} title={humanOnly ? "Always goes to a human" : undefined}>
                  <input
                    type="checkbox"
                    disabled={humanOnly}
                    checked={checked}
                    onChange={() =>
                      set("intentAllowlist", checked ? draft.intentAllowlist.filter((i) => i !== intent) : [...draft.intentAllowlist, intent])
                    }
                  />
                  {intentLabel(intent)}
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="guidance">Tone and policy guidance</Label>
            <Textarea id="guidance" rows={5} value={draft.guidance} onChange={(e) => set("guidance", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="glossary">Glossary (one product term per line, never translated)</Label>
              <Textarea id="glossary" rows={5} value={draft.glossary} onChange={(e) => set("glossary", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="core-facts">Core facts (fees, limits, networks)</Label>
              <Textarea id="core-facts" rows={5} value={draft.coreFacts} onChange={(e) => set("coreFacts", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expected">Expected reply text (shown in acknowledgements)</Label>
              <Input id="expected" value={draft.expectedReplyText ?? ""} onChange={(e) => set("expectedReplyText", e.target.value || null)} placeholder="We usually reply within a few hours." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="threshold">Missing funds at or above this always go to a human (USD)</Label>
              <Input
                id="threshold"
                type="number"
                min={0}
                value={draft.missingFundsThresholdUsd ?? ""}
                onChange={(e) => set("missingFundsThresholdUsd", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Team" description="Who is on call for urgent cases, and how the inbox names each agent.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="hours">Business hours</Label>
            <Input id="hours" value={draft.businessHours ?? ""} onChange={(e) => set("businessHours", e.target.value || null)} placeholder="Mon–Fri 9:00–18:00 UK time" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oncall-name">On-call person</Label>
            <Input
              id="oncall-name"
              value={draft.onCall?.name ?? ""}
              onChange={(e) =>
                set("onCall", e.target.value || draft.onCall?.slackUserId ? { name: e.target.value, slackUserId: draft.onCall?.slackUserId ?? "" } : null)
              }
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="oncall-slack">Their Slack member id (U…): the page @-mentions them, so Slack rings their phone</Label>
            <Input
              id="oncall-slack"
              value={draft.onCall?.slackUserId ?? ""}
              onChange={(e) =>
                set("onCall", e.target.value || draft.onCall?.name ? { name: draft.onCall?.name ?? "", slackUserId: e.target.value.trim() } : null)
              }
              placeholder="U01ABCDEF"
            />
          </div>
        </div>
        <div className="mt-5">
          <Label>Agents</Label>
          <p className="text-xs text-gray-500">
            Every admin who has opened the portal in the last 90 days. Customers see the name on replies; the Slack id
            lets @mentions in notes reach them.
          </p>
          <div className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
            {agents.map((email) => (
              <div key={email} className="grid grid-cols-1 items-center gap-2 p-2 sm:grid-cols-[1fr_10rem_10rem]">
                <span className="text-sm text-gray-700">{email}</span>
                <Input className="h-8" placeholder={`Name (e.g. ${agentShortName(email)})`} value={profileFor(email).name} onChange={(e) => setProfile(email, { name: e.target.value })} />
                <Input className="h-8" placeholder="Slack id" value={profileFor(email).slackUserId ?? ""} onChange={(e) => setProfile(email, { slackUserId: e.target.value.trim() })} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Known incidents"
        description="Active incidents are shown in the app's chat and given to Solid AI, in the wording you approve here."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set("incidents", [
                ...draft.incidents,
                { id: `inc-${Date.now().toString(36)}`, title: "", customerMessage: "", active: true, startedAt: new Date().toISOString() },
              ])
            }
          >
            <Plus /> Add
          </Button>
        }
      >
        {draft.incidents.length === 0 ? (
          <p className="text-sm text-gray-500">No incidents.</p>
        ) : (
          <div className="space-y-3">
            {draft.incidents.map((incident: SupportIncident, index: number) => {
              const change = (changes: Partial<SupportIncident>) =>
                set("incidents", draft.incidents.map((item, i) => (i === index ? { ...item, ...changes } : item)));
              return (
                <div key={incident.id} className="space-y-2 rounded-md border border-gray-200 p-3">
                  <div className="flex items-center gap-2">
                    <Input className="h-8" placeholder="Title, e.g. Card payments delayed" value={incident.title} onChange={(e) => change({ title: e.target.value })} />
                    <label className="flex shrink-0 items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={incident.active} onChange={(e) => change({ active: e.target.checked })} /> Active
                    </label>
                    <Button size="icon-sm" variant="ghost" aria-label="Remove incident" onClick={() => set("incidents", draft.incidents.filter((_, i) => i !== index))}>
                      <Trash2 />
                    </Button>
                  </div>
                  <Textarea rows={2} placeholder="What customers are told" value={incident.customerMessage} onChange={(e) => change({ customerMessage: e.target.value })} />
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        title="Saved replies"
        description="Inserted from the composer. Written in English; the customer receives their language."
        action={
          <Button size="sm" variant="outline" onClick={() => { setEditing(null); setMacroOpen(true); }}>
            <Plus /> New
          </Button>
        }
      >
        {macros.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        ) : !macros.data?.length ? (
          <p className="text-sm text-gray-500">No saved replies yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {macros.data.map((macro) => (
              <li key={macro.id} className="flex items-start gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {macro.title} {macro.shortcut && <span className="text-xs text-gray-400">/{macro.shortcut}</span>}
                  </p>
                  <p className="line-clamp-2 text-xs text-gray-500">{macro.body}</p>
                </div>
                <Badge variant="muted">used {macro.usageCount}×</Badge>
                <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => { setEditing(macro); setMacroOpen(true); }}>
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete"
                  onClick={() => {
                    if (window.confirm(`Delete "${macro.title}"?`)) deleteMacro.mutate(macro.id);
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="History" description="Every saved version, newest first.">
        {history.data?.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1 font-medium">Version</th>
                <th className="py-1 font-medium">When</th>
                <th className="py-1 font-medium">Who</th>
                <th className="py-1 font-medium">Changed</th>
              </tr>
            </thead>
            <tbody>
              {history.data.slice(0, 20).map((entry) => (
                <tr key={entry.version} className="border-t border-gray-100">
                  <td className="py-1.5">{entry.version}</td>
                  <td className="py-1.5">{dateTime(entry.createdAt)}</td>
                  <td className="py-1.5">{entry.updatedBy}</td>
                  <td className="py-1.5 text-gray-600">{entry.changed.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">No changes saved yet.</p>
        )}
      </Section>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <span className="text-sm text-gray-600">
              Unsaved: {Object.keys(patch).join(", ")}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEdits(null)}>Discard</Button>
              <Button onClick={saveAll} disabled={update.isPending}>
                {update.isPending && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {macroOpen && (
        <MacroDialog macro={editing} open={macroOpen} onClose={() => setMacroOpen(false)} />
      )}
    </div>
  );
}

export default function SupportSettingsPage() {
  return <SupportMeGate>{(me) => <SettingsScreen me={me} />}</SupportMeGate>;
}
