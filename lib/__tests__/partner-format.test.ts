import { describe, expect, it } from "vitest";
import { followUpLabel, morningIn, nextMonday, partnerListText } from "@/lib/partner-format";
import type { TaskPartnerGroup } from "@/types/tasks";

const NOW = new Date(2026, 10, 8, 22, 0); // Sun 8 Nov 2026, 22:00 local

describe("partner format", () => {
  it("says overdue, soon, or the date", () => {
    expect(followUpLabel(new Date(2026, 10, 8, 19, 0).toISOString(), NOW)).toEqual({ text: "Overdue 3h", tone: "late" });
    expect(followUpLabel(new Date(2026, 10, 5, 22, 0).toISOString(), NOW)).toEqual({ text: "Overdue 3d", tone: "late" });
    expect(followUpLabel(new Date(2026, 10, 9, 9, 0).toISOString(), NOW)).toEqual({ text: "In 11h", tone: "soon" });
    expect(followUpLabel(new Date(2026, 10, 11, 9, 30).toISOString(), NOW)).toEqual({ text: "Nov 11, 09:30", tone: "later" });
  });

  it("picks mornings", () => {
    expect(morningIn(1, NOW)).toEqual(new Date(2026, 10, 9, 9, 0));
    expect(nextMonday(NOW)).toEqual(new Date(2026, 10, 9, 9, 0));
    expect(nextMonday(new Date(2026, 10, 9, 8, 0))).toEqual(new Date(2026, 10, 16, 9, 0));
  });

  it("writes a list a partner can act on", () => {
    const group: TaskPartnerGroup = {
      partner: "wirex",
      label: "Wirex",
      overdue: 0,
      cases: [
        {
          caseId: "c1",
          conversationId: "v1",
          caseNumber: 1,
          userId: "u1",
          customer: "roberwii",
          intent: "deposit",
          target: "card_issuer",
          partnerId: "wx-9",
          reason: "Two SEPA transfers\nmissing: €50 and €20",
          externalRef: "WX-1",
          followUpAt: NOW.toISOString(),
          escalatedAt: NOW.toISOString(),
          escalatedBy: "eli@fuse.io",
          assigneeEmail: null,
          customerWroteSince: false,
          backInInbox: false,
          task: null,
        },
        {
          caseId: "c2",
          conversationId: "v2",
          caseNumber: 1,
          userId: null,
          customer: null,
          intent: null,
          target: "card_issuer",
          partnerId: null,
          reason: "x".repeat(300),
          externalRef: null,
          followUpAt: NOW.toISOString(),
          escalatedAt: NOW.toISOString(),
          escalatedBy: "eli@fuse.io",
          assigneeEmail: null,
          customerWroteSince: false,
          backInInbox: false,
          task: null,
        },
      ],
    };
    const text = partnerListText(group, NOW).split("\n");
    expect(text[0]).toBe("Wirex: 2 customers waiting (Nov 8)");
    expect(text[1]).toBe("1. wx-9 · roberwii: Two SEPA transfers missing: €50 and €20 (ref WX-1)");
    expect(text[2].startsWith("2. unknown customer: xxx")).toBe(true);
    expect(text[2].endsWith("…")).toBe(true);
  });
});
