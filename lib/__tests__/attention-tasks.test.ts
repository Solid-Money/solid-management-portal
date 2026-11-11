import { describe, expect, it } from "vitest";
import {
  cardSummary,
  closedLine,
  problemKey,
  quietHours,
  quietLabel,
  radarTasks,
  tasksHref,
} from "@/lib/attention-tasks";
import type { AttentionItemView } from "@/types/radar";
import type { TaskRow } from "@/types/tasks";

// Shaped on the radar and Tasks as they stood on Nov 11 2026, 13:30 UTC.
const NOW = "2026-11-11T13:30:00.000Z";

const item = (over: Partial<AttentionItemView>): AttentionItemView =>
  ({
    id: "x",
    level: "escalate",
    severity: "high",
    status: "new",
    category: "reliability",
    title: "t",
    metaLine: "m",
    tag: "Reliability",
    codes: [],
    flows: [],
    affectedCount: 0,
    signals: [],
    resolution: null,
    resolvedAt: null,
    lastSeenAt: "2026-11-10T00:00:00.000Z",
    firstSeenAt: "2026-11-09T00:00:00.000Z",
    ...over,
  }) as AttentionItemView;

const signal = (detector: string, key: string) =>
  ({ detector, key }) as AttentionItemView["signals"][number];

const paymaster = (
  id: string,
  people: number,
  level: "escalate" | "watch",
  flow = "swap",
) =>
  item({
    id,
    level,
    severity: "medium",
    title: `PAYMASTER_REJECTED: ${flow} failing`,
    metaLine: `${people} people hit`,
    codes: ["PAYMASTER_REJECTED"],
    affectedCount: people,
    signals: [signal("flow_failure", flow)],
    lastSeenAt: "2026-11-11T10:51:03.964Z",
  });

const cashout = (id: string, accounts: number, last: string) =>
  item({
    id,
    category: "abuse",
    tag: "Abuse",
    title: `${accounts} accounts cash out to one wallet`,
    metaLine: `${accounts} accounts`,
    affectedCount: accounts,
    signals: [signal("shared_cashout_wallet", `0x${id}`)],
    lastSeenAt: last,
  });

const task = (over: Partial<TaskRow>): TaskRow =>
  ({
    id: "t",
    title: "t",
    status: "todo",
    priority: "medium",
    ownerEmail: "musab@fuse.io",
    labels: ["radar", "reliability"],
    source: { kind: "radar", label: "Reliability" },
    createdAt: "2026-11-08T17:05:21.357Z",
    lastPersonUpdateAt: null,
    radarItemIds: [],
    ...over,
  }) as TaskRow;

const items = [
  paymaster("p1", 26, "escalate"),
  paymaster("p2", 16, "escalate", "withdraw"),
  paymaster("p3", 33, "watch", "send"),
  cashout("w1", 47, "2026-11-11T13:26:17.755Z"),
  cashout("w2", 11, "2026-11-10T20:21:37.945Z"),
  item({
    id: "r1",
    category: "abuse",
    tag: "Abuse",
    title: 'Referral burst from "donney"',
    affectedCount: 1,
    signals: [signal("referral_burst", "6ab1")],
  }),
  item({
    id: "arb",
    status: "needs_check",
    title: "No Arbitrum deposits for 24 hours",
    signals: [signal("deposit_method_stopped", "chain:42161")],
  }),
  item({
    id: "z",
    level: "watch",
    severity: "medium",
    category: "abuse",
    title: "Flagged referrer still recruiting: zynqorw",
    signals: [signal("flagged_referrer_recruiting", "6aac")],
  }),
  item({
    id: "rev",
    level: "watch",
    severity: "watch",
    category: "money",
    title: "Rewards cost 15.2× revenue",
    signals: [signal("rewards_above_revenue", "week")],
  }),
  item({
    id: "orphan",
    title: "One passkey signs in to 3,199 accounts",
    category: "security",
    signals: [signal("passkey_many_accounts", "GJn")],
  }),
];

const tasks = [
  task({
    id: "t4",
    title:
      "PAYMASTER_REJECTED: Swaps, sends, withdrawals and card top-ups failing",
    radarItemIds: ["p1"],
  }),
  task({
    id: "t5",
    title: "Accounts cashing out to shared wallets",
    ownerEmail: "eli@fuse.io",
    labels: ["radar", "abuse"],
    radarItemIds: ["w1", "w2"],
    lastPersonUpdateAt: "2026-11-09T06:59:24.256Z",
  }),
  task({
    id: "t10",
    title: "Referral bursts",
    ownerEmail: null,
    labels: ["radar", "abuse"],
    radarItemIds: ["r1"],
    lastPersonUpdateAt: "2026-11-11T12:00:00.000Z",
  }),
  // Not from the radar: never on the card.
  task({ id: "mine", source: { kind: "manual", label: null } }),
];

describe("Needs your attention, as a summary of Tasks", () => {
  it("knows which alerts are the same problem, as the radar groups them", () => {
    expect(problemKey(paymaster("a", 1, "watch", "swap"))).toBe(
      "code:PAYMASTER_REJECTED",
    );
    expect(problemKey(paymaster("b", 1, "watch", "withdraw"))).toBe(
      "code:PAYMASTER_REJECTED",
    );
    expect(problemKey(cashout("w9", 5, NOW))).toBe("shared_cashout_wallet");
    expect(problemKey(items.find((i) => i.id === "arb")!)).toBe(
      "deposit_method_stopped:chain:42161",
    );
    expect(
      problemKey(
        item({
          id: "u",
          codes: ["UNKNOWN"],
          signals: [signal("flow_failure", "swap")],
        }),
      ),
    ).toBe("flow_failure:swap");
  });

  it("puts every alert of a problem under its task, largest first", () => {
    const rows = radarTasks(tasks, items, NOW);
    expect(rows.map((r) => r.task.id)).toEqual(["t5", "t4", "t10"]);
    const t4 = rows.find((r) => r.task.id === "t4")!;
    // p2 and p3 are the same error, in tasks or not yet: one problem.
    expect(t4.items.map((i) => i.id)).toEqual(["p3", "p1", "p2"]);
    // A failure's alerts repeat the task's error: its numbers only.
    expect(t4.meta).toBe("33 people hit · 2 more alerts in this task");
    // A grouped kind's alert names its own thing.
    expect(rows.find((r) => r.task.id === "t5")!.meta).toBe(
      "47 accounts cash out to one wallet · 47 accounts · 1 more alert in this task",
    );
    expect(t4.badge.label).toBe("MED");
  });

  it("puts a failure that hit people today before an old alert with more accounts", () => {
    const passkey = item({
      id: "pk",
      category: "security",
      tag: "Security",
      title: "One passkey signs in to 3,199 accounts",
      affectedCount: 3211,
      signals: [signal("passkey_many_accounts", "GJn")],
      lastSeenAt: "2026-10-25T09:40:37.974Z",
    });
    const rows = radarTasks(
      [
        ...tasks,
        task({
          id: "t15",
          radarItemIds: ["pk"],
          labels: ["radar", "security"],
        }),
      ],
      [...items, passkey],
      NOW,
    );
    const order = rows.map((r) => r.task.id);
    expect(order.indexOf("t4")).toBeLessThan(order.indexOf("t15"));
  });

  it("orders incidents first, then what is still happening, then by people hit", () => {
    // w1's last send was 4 minutes ago: still happening, so the cash-outs lead.
    const rows = radarTasks(tasks, items, NOW);
    expect(rows[0].happening).toBe(true);
    const withIncident = radarTasks(
      [...tasks, task({ id: "inc", priority: "critical", radarItemIds: [] })],
      items,
      NOW,
    );
    expect(withIncident[0].task.id).toBe("inc");
    expect(withIncident[0].badge.label).toBe("INCIDENT");
  });

  it("counts quiet from a person's last update, not the radar's", () => {
    expect(quietHours(tasks[0], NOW)).toBe(68);
    expect(quietHours(tasks[1], NOW)).toBe(54);
    expect(quietHours(tasks[2], NOW)).toBe(1);
    expect(quietLabel(68)).toEqual({ text: "2d quiet", quiet: true });
    expect(quietLabel(5)).toEqual({ text: "updated 5 h ago", quiet: false });
    expect(quietLabel(0)).toEqual({ text: "updated just now", quiet: false });
    // No person has written yet: opening it is not an update.
    expect(quietLabel(5, false)).toEqual({
      text: "opened 5 h ago",
      quiet: false,
    });
    expect(quietLabel(30, false)).toEqual({ text: "1d quiet", quiet: true });
  });

  it("sums up the card: tasks, quiet, to check, watching, and what has no task", () => {
    const summary = cardSummary(tasks, items, [], NOW);
    expect(summary.tasks).toHaveLength(3);
    expect(summary.quiet.map((r) => r.task.id)).toEqual(["t4", "t5"]);
    expect(summary.toCheck.map((i) => i.id)).toEqual(["arb"]);
    // The watch-level Paymaster alert belongs to its task, not here.
    expect(summary.watching.map((i) => i.id)).toEqual(["z", "rev"]);
    // Escalated with no task you can see: shown, never hidden.
    expect(summary.untasked.map((i) => i.id)).toEqual(["orphan"]);
    expect(summary.byCategory).toBe("Abuse 2 · Reliability 1");
    expect(summary.unassigned).toBe(1);
  });

  it("says what closed on its own in the last day", () => {
    const resolved = [
      item({
        id: "bank",
        title: "No bank transfer deposits for 9 hours",
        status: "resolved",
        resolution: "quiet",
        resolvedAt: "2026-11-11T04:35:00.000Z",
      }),
      item({
        id: "dec",
        title: "Card declines spiking",
        status: "resolved",
        resolution: "quiet",
        resolvedAt: "2026-11-11T06:00:00.000Z",
      }),
      item({
        id: "old",
        title: "Old",
        status: "resolved",
        resolution: "quiet",
        resolvedAt: "2026-11-09T06:00:00.000Z",
      }),
      item({
        id: "byhand",
        title: "By hand",
        status: "resolved",
        resolution: "fixed",
        resolvedAt: "2026-11-11T08:00:00.000Z",
      }),
    ];
    const { closedOnOwn } = cardSummary(tasks, items, resolved, NOW);
    expect(closedOnOwn.map((i) => i.id)).toEqual(["dec", "bank"]);
    expect(closedLine(closedOnOwn)).toBe(
      "2 closed on their own in the last 24 h: Card declines spiking, No bank transfer deposits for 9 hours",
    );
    expect(closedLine([])).toBeNull();
  });

  it("links to the radar board in Tasks", () => {
    expect(tasksHref()).toBe("/tasks?board=radar");
    expect(tasksHref("abc")).toBe("/tasks?board=radar&task=abc");
  });
});
