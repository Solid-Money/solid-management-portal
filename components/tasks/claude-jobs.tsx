"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Rocket } from "lucide-react";
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
import { BotAvatar } from "@/components/tasks/task-format";
import {
  claudeJobChip,
  claudePrCommit,
  claudePrLabel,
  safeHttps,
  shownClaudeJobs,
  splitClaudePrs,
  type ClaudeJobTone,
} from "@/lib/claude-jobs";
import { cancelClaudeJob, shipClaudeJob } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import type { ClaudeJob } from "@/types/tasks";

const TONE: Record<ClaudeJobTone, string> = {
  quiet: "border-gray-200 bg-gray-50 text-gray-700",
  busy: "border-indigo-200 bg-indigo-50 text-indigo-900",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "needs-you": "border-amber-200 bg-amber-50 text-amber-900",
};

function OutLink({ href, children }: { href: string; children: React.ReactNode }) {
  const safe = safeHttps(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 underline decoration-current/30 underline-offset-2 hover:decoration-current"
    >
      {children}
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

/**
 * Claude's jobs on a task: where each one stands (queued, working, in
 * review, ready on QA, needs you), its pull requests and links, and the two
 * things a person does here: cancel their own job, and press Ship to
 * production when they are on the ship list. The backend decides both.
 */
export default function ClaudeJobs({
  jobs,
  onChanged,
  className,
}: {
  jobs: ClaudeJob[] | undefined;
  onChanged: () => void;
  className?: string;
}) {
  const shown = shownClaudeJobs(jobs);
  if (!shown.length) return null;
  return (
    <div className={cn("space-y-1.5", className)}>
      {shown.map((job) => (
        <JobRow key={job.id} job={job} onChanged={onChanged} />
      ))}
    </div>
  );
}

function JobRow({ job, onChanged }: { job: ClaudeJob; onChanged: () => void }) {
  // The job as it was when the Ship dialog opened. The dialog shows this
  // and approves this revision, never the live job: a poll can bring a newer
  // one (another commit, other pull requests) while it is open.
  const [reviewing, setReviewing] = useState<ClaudeJob | null>(null);
  const [moved, setMoved] = useState(false);
  const [busy, setBusy] = useState<"ship" | "cancel" | null>(null);
  // It changed under the open dialog: close it, so nothing is approved that
  // was not read there. Shipping needs a fresh look and a fresh confirm.
  // (Not while this person's own Ship is on its way: that changes it too.)
  if (reviewing && reviewing.rev !== job.rev && busy !== "ship") {
    setReviewing(null);
    setMoved(true);
  }
  // A job that is finished or cancelled meanwhile leaves the list, and this
  // row and its dialog with it: say why the dialog went, since the note
  // below has no row left to show in.
  const watching = useRef(false);
  useEffect(() => {
    watching.current = !!reviewing && busy !== "ship";
  }, [reviewing, busy]);
  useEffect(
    () => () => {
      if (watching.current)
        toast.message("Claude's job changed while you were looking at it, so nothing was approved.");
    },
    [],
  );
  const chip = claudeJobChip(job);
  const { production, other } = splitClaudePrs(job.prs);
  const shown = reviewing ? splitClaudePrs(reviewing.prs) : null;

  const act = async (what: "ship" | "cancel") => {
    setBusy(what);
    try {
      if (what === "ship") {
        if (!reviewing) return;
        // Approval is for the revision this dialog opened with and shows:
        // the backend refuses if the job moved since.
        await shipClaudeJob(reviewing.id, reviewing.rev);
        toast.success("Approved. Claude ships it on the next hourly run.");
      } else {
        await cancelClaudeJob(job.id);
        toast.success("Claude's job cancelled");
      }
      setReviewing(null);
      onChanged();
    } catch {
      // The API layer shows the error. The job may have moved: close the
      // dialog and read it again, so what gets approved is what is shown.
      setReviewing(null);
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2.5 py-1.5 text-xs", TONE[chip.tone])}>
      <BotAvatar size={16} />
      <span className="font-medium">{chip.label}</span>
      <span className="opacity-70">· asked by {job.askedBy.name ?? job.askedBy.email}</span>
      {job.state === "shipping" && job.go && <span className="opacity-70">· approved by {job.go.by}</span>}
      {job.state === "stuck" && <span className="opacity-70">· reply to Claude in the thread, tagging it</span>}
      {[...production, ...other].map((pr) => (
        <OutLink key={`${pr.repo}#${pr.number}`} href={pr.url}>
          {claudePrLabel(pr)}
        </OutLink>
      ))}
      {job.links.map((link) => (
        <OutLink key={link.url} href={link.url}>
          {link.label}
        </OutLink>
      ))}
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {job.canCancel && (
          <Button variant="ghost" size="xs" disabled={!!busy} onClick={() => void act("cancel")}>
            {busy === "cancel" && <Loader2 className="animate-spin" />}
            Cancel
          </Button>
        )}
        {job.canShip && (
          <Button
            size="xs"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!!busy}
            onClick={() => {
              setMoved(false);
              setReviewing(job);
            }}
          >
            <Rocket /> Ship to production
          </Button>
        )}
      </span>
      {moved && (
        <span className="basis-full text-amber-800">
          {job.canShip
            ? "This changed while you were looking at it. Check it again before shipping."
            : "This changed while you were looking at it, so nothing was approved. It is not waiting to ship any more."}
        </span>
      )}
      <Dialog open={!!reviewing} onOpenChange={(next) => !busy && !next && setReviewing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ship this to production?</DialogTitle>
            <DialogDescription>
              Claude merges exactly the commits below on the next hourly run and they go live for everyone. Check it
              on QA first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-800">
            {reviewing?.note && (
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700">
                {reviewing?.note}
              </p>
            )}
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">Goes to production</p>
              <ul className="space-y-1">
                {(shown?.production ?? []).map((pr) => (
                  <li key={`${pr.repo}#${pr.number}`}>
                    <OutLink href={pr.url}>{claudePrLabel(pr)}</OutLink>
                    {claudePrCommit(pr) && (
                      <span className="ml-1.5 font-mono text-xs text-gray-500">at {claudePrCommit(pr)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {((shown?.other.length ?? 0) > 0 || (reviewing?.links.length ?? 0) > 0) && (
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">To check first</p>
                <ul className="space-y-1">
                  {(shown?.other ?? []).map((pr) => (
                    <li key={`${pr.repo}#${pr.number}`}>
                      <OutLink href={pr.url}>{claudePrLabel(pr)}</OutLink>
                    </li>
                  ))}
                  {(reviewing?.links ?? []).map((link) => (
                    <li key={link.url}>
                      <OutLink href={link.url}>{link.label}</OutLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={!!busy} onClick={() => setReviewing(null)}>
              Not yet
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!!busy}
              onClick={() => void act("ship")}
            >
              {busy === "ship" ? <Loader2 className="animate-spin" /> : <Rocket />}
              Ship to production
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
