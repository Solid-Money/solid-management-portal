"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  CheckCircle2,
  ChevronDown,
  Flag,
  Hand,
  RotateCcw,
  Send,
  UserPlus,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runSupportCaseAction } from "@/lib/support-api";
import {
  COMPLAINT_LABELS,
  ESCALATION_TARGETS,
  agentShortName,
  intentLabel,
} from "@/components/support/support-format";
import { SUPPORT_INTENTS, type SupportAgentCase } from "@/types/support";

type Action = Parameters<typeof runSupportCaseAction>[1];

function at(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60_000).toISOString();
}

/** Local 09:00 on the next day matching `weekday` (or tomorrow when null). */
function nextMorning(weekday: number | null): string {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  do {
    date.setDate(date.getDate() + 1);
  } while (weekday !== null && date.getDay() !== weekday);
  return date.toISOString();
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export default function CaseActions({
  supportCase,
  agents,
  me,
  conversationId,
}: {
  supportCase: SupportAgentCase;
  agents: string[];
  me: string;
  conversationId: string;
}) {
  const queryClient = useQueryClient();
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [unflagOpen, setUnflagOpen] = useState(false);
  const [target, setTarget] = useState("card_issuer");
  const [reason, setReason] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [followUpAt, setFollowUpAt] = useState(() => toLocalInput(nextMorning(null)));
  const [unflagReason, setUnflagReason] = useState("");

  const act = useMutation({
    mutationFn: (action: Action) => runSupportCaseAction(supportCase.id, action),
    onSuccess: (_data, action) => {
      void queryClient.invalidateQueries({ queryKey: ["support", "conversation", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["support", "queue"] });
      void queryClient.invalidateQueries({ queryKey: ["support", "counts"] });
      if (action.action === "resolve") toast.success(`Case #${supportCase.number} resolved; the customer is asked to rate it`);
    },
  });

  const resolved = supportCase.status === "resolved";
  const mine = supportCase.assigneeEmail === me;

  if (resolved) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => act.mutate({ action: "reopen" })} disabled={act.isPending}>
          <RotateCcw /> Reopen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!mine && (
        <Button size="sm" variant="outline" onClick={() => act.mutate({ action: "assign", body: { assigneeEmail: me } })} disabled={act.isPending}>
          <Hand /> Take
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={act.isPending}>
            <UserPlus />
            {supportCase.assigneeEmail ? agentShortName(supportCase.assigneeEmail) : "Assign"}
            <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {agents.map((email) => (
            <DropdownMenuItem key={email} onSelect={() => act.mutate({ action: "assign", body: { assigneeEmail: email } })}>
              {email === me ? `${agentShortName(email)} (me)` : agentShortName(email)}
            </DropdownMenuItem>
          ))}
          {supportCase.assigneeEmail && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => act.mutate({ action: "assign", body: { assigneeEmail: null } })}>
                Back to the queue
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={act.isPending}>
            <AlarmClock /> Snooze <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => act.mutate({ action: "snooze", body: { until: at(1) } })}>1 hour</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => act.mutate({ action: "snooze", body: { until: at(4) } })}>4 hours</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => act.mutate({ action: "snooze", body: { until: nextMorning(null) } })}>Tomorrow 9:00</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => act.mutate({ action: "snooze", body: { until: nextMorning(1) } })}>Monday 9:00</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => act.mutate({ action: "snooze", body: { until: null } })}>Until the customer replies</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" onClick={() => setEscalateOpen(true)} disabled={act.isPending}>
        <Send /> Escalate
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant={supportCase.complaint ? "destructive" : "outline"} disabled={act.isPending}>
            <Flag />
            {supportCase.complaint ? COMPLAINT_LABELS[supportCase.complaint.type] ?? "Flagged" : "Flag"}
            <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-normal text-gray-500">
            Flagged cases never auto-resolve and go on the complaint register.
          </DropdownMenuLabel>
          {Object.entries(COMPLAINT_LABELS).map(([type, label]) => (
            <DropdownMenuItem
              key={type}
              disabled={supportCase.complaint?.type === type}
              onSelect={() => act.mutate({ action: "complaint", body: { type } })}
            >
              {label}
            </DropdownMenuItem>
          ))}
          {supportCase.complaint && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onSelect={() => setUnflagOpen(true)}>
                Remove the flag…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <select
        aria-label="Intent"
        className={selectClass}
        value={supportCase.intent ?? ""}
        onChange={(event) => event.target.value && act.mutate({ action: "intent", body: { intent: event.target.value } })}
        disabled={act.isPending}
      >
        {!supportCase.intent && <option value="">Set intent…</option>}
        {SUPPORT_INTENTS.map((intent) => (
          <option key={intent} value={intent}>
            {intentLabel(intent)}
          </option>
        ))}
      </select>

      <Button size="sm" className="ml-auto" onClick={() => act.mutate({ action: "resolve" })} disabled={act.isPending}>
        <CheckCircle2 /> Resolve
      </Button>

      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate case #{supportCase.number}</DialogTitle>
            <DialogDescription>
              The case waits on another team. On the follow-up date it comes back to Needs a human.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="escalate-target">Waiting on</Label>
              <select id="escalate-target" className={`${selectClass} w-full`} value={target} onChange={(e) => setTarget(e.target.value)}>
                {ESCALATION_TARGETS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="escalate-reason">What for</Label>
              <Textarea id="escalate-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Refund stuck at Rain since Oct 3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="escalate-ref">Their reference (optional)</Label>
                <Input id="escalate-ref" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="escalate-follow-up">Follow up by</Label>
                <Input id="escalate-follow-up" type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateOpen(false)}>Cancel</Button>
            <Button
              disabled={reason.trim().length < 3 || !followUpAt || act.isPending}
              onClick={() =>
                act.mutate(
                  {
                    action: "escalate",
                    body: {
                      target,
                      reason: reason.trim(),
                      ...(externalRef.trim() ? { externalRef: externalRef.trim() } : {}),
                      followUpAt: new Date(followUpAt).toISOString(),
                    },
                  },
                  {
                    onSuccess: () => {
                      setEscalateOpen(false);
                      setReason("");
                      setExternalRef("");
                    },
                  },
                )
              }
            >
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unflagOpen} onOpenChange={setUnflagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove the {supportCase.complaint ? COMPLAINT_LABELS[supportCase.complaint.type]?.toLowerCase() : ""} flag</DialogTitle>
            <DialogDescription>The case leaves the complaint register. The reason is kept in the audit log.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="unflag-reason">Reason</Label>
            <Input id="unflag-reason" value={unflagReason} onChange={(e) => setUnflagReason(e.target.value)} placeholder="e.g. Flagged by mistake, a how-to question" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnflagOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={unflagReason.trim().length < 3 || act.isPending}
              onClick={() =>
                act.mutate(
                  { action: "complaint", body: { type: "none", reason: unflagReason.trim() } },
                  { onSuccess: () => { setUnflagOpen(false); setUnflagReason(""); } },
                )
              }
            >
              Remove flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
