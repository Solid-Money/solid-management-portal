import type { ClaudeJob, ClaudeJobPr, ClaudeJobState } from "@/types/tasks";

/** States the hourly run still has work in, or a person has a button for. */
const OPEN: ClaudeJobState[] = ["waiting", "working", "in_review", "ready_to_ship", "shipping"];
/** A stuck job stops asking for attention after this long. */
const STUCK_SHOWN_MS = 7 * 24 * 60 * 60_000;
/** Branches a merge into goes to production from. */
const PRODUCTION_BASES = ["master", "main"];

export type ClaudeJobTone = "quiet" | "busy" | "ready" | "needs-you";

export function claudeJobsOpen(jobs: ClaudeJob[] | undefined): boolean {
  return !!jobs?.some((job) => OPEN.includes(job.state));
}

/**
 * The jobs a task shows a chip for, oldest first: the open ones, and a stuck
 * one for a week (until the asker answers it). A finished or cancelled job
 * has said what it had to say in its thread.
 */
export function shownClaudeJobs(jobs: ClaudeJob[] | undefined, now = new Date()): ClaudeJob[] {
  return (jobs ?? [])
    .filter(
      (job) =>
        OPEN.includes(job.state) ||
        (job.state === "stuck" && now.getTime() - new Date(job.updatedAt).getTime() < STUCK_SHOWN_MS),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** What the chip says for a job, and how loudly. */
export function claudeJobChip(job: Pick<ClaudeJob, "state">): { label: string; tone: ClaudeJobTone } {
  switch (job.state) {
    case "waiting":
      return { label: "Claude: queued for the next hourly run", tone: "quiet" };
    case "working":
      return { label: "Claude: working on it", tone: "busy" };
    case "in_review":
      return { label: "Claude: pull request in review", tone: "busy" };
    case "ready_to_ship":
      return { label: "Ready on QA", tone: "ready" };
    case "shipping":
      return { label: "Claude: shipping on the next hourly run", tone: "busy" };
    case "stuck":
      return { label: "Claude needs you", tone: "needs-you" };
    case "done":
      return { label: "Claude: done", tone: "quiet" };
    case "cancelled":
      return { label: "Claude: cancelled", tone: "quiet" };
  }
}

/** The pull requests that reach production when merged, then the rest. */
export function splitClaudePrs(prs: ClaudeJobPr[]): { production: ClaudeJobPr[]; other: ClaudeJobPr[] } {
  return {
    production: prs.filter((pr) => PRODUCTION_BASES.includes(pr.base)),
    other: prs.filter((pr) => !PRODUCTION_BASES.includes(pr.base)),
  };
}

/** "solid-backend #2400 → master". */
export function claudePrLabel(pr: ClaudeJobPr): string {
  return `${pr.repo.split("/").pop() ?? pr.repo} #${pr.number} → ${pr.base}`;
}

/** Only https links are shown as links; anything else stays out. */
export function safeHttps(url: string): string | null {
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
