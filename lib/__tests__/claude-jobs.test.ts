import { describe, expect, it } from "vitest";
import {
  claudeJobChip,
  claudeJobsOpen,
  claudePrLabel,
  safeHttps,
  shownClaudeJobs,
  splitClaudePrs,
} from "@/lib/claude-jobs";
import type { ClaudeJob, ClaudeJobState } from "@/types/tasks";

const NOW = new Date("2026-11-19T12:00:00Z");

function job(state: ClaudeJobState, createdAt: string, updatedAt = createdAt): ClaudeJob {
  return {
    id: `${state}-${createdAt}`,
    taskId: "a".repeat(24),
    taskNumber: 7,
    taskTitle: "Search placeholder",
    threadId: "b".repeat(24),
    state,
    kind: null,
    ask: "@Claude fix it",
    askedBy: { email: "eli@fuse.io", name: "Eli" },
    allowed: { code: true },
    attempts: 0,
    note: null,
    links: [],
    prs: [],
    go: null,
    canShip: false,
    canCancel: false,
    createdAt,
    updatedAt,
  };
}

describe("Claude's jobs on a task", () => {
  it("shows open jobs and a recent stuck one, oldest first", () => {
    const jobs = [
      job("done", "2026-11-19T08:00:00Z"),
      job("ready_to_ship", "2026-11-19T10:00:00Z"),
      job("stuck", "2026-11-18T09:00:00Z"),
      job("stuck", "2026-11-01T09:00:00Z"),
      job("cancelled", "2026-11-19T09:00:00Z"),
      job("waiting", "2026-11-19T11:00:00Z"),
    ];
    expect(shownClaudeJobs(jobs, NOW).map((j) => j.state)).toEqual(["stuck", "ready_to_ship", "waiting"]);
    expect(shownClaudeJobs(undefined, NOW)).toEqual([]);
  });

  it("knows when a job is still open", () => {
    expect(claudeJobsOpen([job("done", "2026-11-19T08:00:00Z"), job("in_review", "2026-11-19T09:00:00Z")])).toBe(
      true,
    );
    expect(claudeJobsOpen([job("stuck", "2026-11-19T08:00:00Z")])).toBe(false);
    expect(claudeJobsOpen(undefined)).toBe(false);
  });

  it("words the chip for each state", () => {
    expect(claudeJobChip({ state: "waiting" })).toEqual({
      label: "Claude: queued for the next hourly run",
      tone: "quiet",
    });
    expect(claudeJobChip({ state: "ready_to_ship" })).toEqual({ label: "Ready on QA", tone: "ready" });
    expect(claudeJobChip({ state: "stuck" })).toEqual({ label: "Claude needs you", tone: "needs-you" });
    expect(claudeJobChip({ state: "shipping" }).tone).toBe("busy");
  });

  it("separates the production pull request from the QA one", () => {
    const master = { repo: "Solid-Money/solid-backend", number: 2400, base: "master", url: "https://github.com/x/1" };
    const qa = { repo: "Solid-Money/solid-backend", number: 2401, base: "qa", url: "https://github.com/x/2" };
    const main = { repo: "Solid-Money/solid-management-portal", number: 210, base: "main", url: "https://github.com/x/3" };
    expect(splitClaudePrs([qa, master, main])).toEqual({ production: [master, main], other: [qa] });
    expect(claudePrLabel(master)).toBe("solid-backend #2400 → master");
  });

  it("links only to https", () => {
    expect(safeHttps("https://www.figma.com/design/x")).toBe("https://www.figma.com/design/x");
    expect(safeHttps("javascript:alert(1)")).toBeNull();
    expect(safeHttps("http://example.com")).toBeNull();
    expect(safeHttps("not a link")).toBeNull();
  });
});
