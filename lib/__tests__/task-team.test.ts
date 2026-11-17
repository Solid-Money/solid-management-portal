import { describe, expect, it } from "vitest";
import { activity, outsideScope, owned, personCounts, personFlags, quietCount, upNextGroups } from "@/lib/task-team";
import type { TaskRow, TaskTeamCard, TaskTeamPerson } from "@/types/tasks";

const now = new Date("2026-11-16T10:00:00Z");
const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

let next = 0;
function card(extra: Partial<TaskRow> = {}, more: Partial<TaskTeamCard> = {}): TaskTeamCard {
  next += 1;
  return {
    task: { id: `t${next}`, title: `Task ${next}`, sprint: "2026-11-16", ...extra } as TaskRow,
    helping: false,
    quietDays: null,
    ...more,
  };
}

function person(extra: Partial<TaskTeamPerson> = {}, columns: Partial<TaskTeamPerson["columns"]> = {}): TaskTeamPerson {
  return {
    email: "musab@fuse.io",
    lastActiveAt: ago(1),
    updatesThisWeek: 3,
    open: 0,
    columns: { working: [], blocked: [], review: [], next: [], done: [], ...columns },
    ...extra,
  };
}

describe("team view", () => {
  it("flags too much at once, nothing started, and quiet people", () => {
    const busy = person({ open: 9 }, { working: [card(), card(), card(), card(), card(), card({}, { helping: true })] });
    expect(personFlags(busy, now)).toEqual([{ tone: "busy", label: "5 in progress" }]);
    const idle = person({ open: 3 }, { next: [card()] });
    expect(personFlags(idle, now)).toEqual([{ tone: "idle", label: "Nothing in progress" }]);
    const quiet = person({ open: 2, lastActiveAt: ago(4 * 24 + 1) }, { working: [card()] });
    expect(personFlags(quiet, now)).toEqual([{ tone: "quiet", label: "Quiet 4 days" }]);
    // Never posted: the line under the name says so; no flag on top.
    const never = person({ open: 1, lastActiveAt: null }, { working: [card()] });
    expect(personFlags(never, now)).toEqual([]);
    const nobody = person({ email: null, lastActiveAt: null }, { working: [card(), card()] });
    expect(personFlags(nobody, now)).toEqual([{ tone: "busy", label: "2 in progress with no owner" }]);
  });

  it("says when someone was last active", () => {
    expect(activity(ago(0.2), now)).toEqual({ label: "Active 12m ago", recent: true });
    expect(activity(new Date(now.getTime() - 10_000).toISOString(), now)).toEqual({ label: "Active now", recent: true });
    expect(activity(ago(50), now)).toEqual({ label: "Active 2d ago", recent: true });
    expect(activity(ago(73), now)).toEqual({ label: "Last update 3 days ago", recent: false });
    expect(activity(null, now)).toEqual({ label: "No updates yet", recent: false });
  });

  it("counts their own tasks, what the scope leaves out, and quiet ones", () => {
    const p = person(
      { open: 9 },
      {
        working: [card({}, { quietDays: 4 }), card({}, { helping: true, quietDays: 5 })],
        review: [card()],
        next: [card()],
      },
    );
    expect(owned(p.columns, "working")).toBe(1);
    expect(outsideScope(p)).toBe(6);
    expect(quietCount(p)).toBe(1);
    expect(personCounts(p)).toEqual([
      [1, "in progress"],
      [1, "in review"],
      [1, "up next"],
      [9, "open"],
    ]);
    expect(personCounts(person({ email: null }, { working: [card()] }))).toEqual([[1, "in progress"]]);
  });

  it("groups up next: this sprint, helping, then the rest", () => {
    const groups = upNextGroups(
      [card({ title: "A" }), card({ title: "B", sprint: null }), card({ title: "C" }, { helping: true })],
      "2026-11-16",
    );
    expect(groups.map((g) => [g.label, g.cards.map((c) => c.task.title)])).toEqual([
      ["This sprint", ["A"]],
      ["Helping", ["C"]],
      ["Not in this sprint", ["B"]],
    ]);
  });
});
