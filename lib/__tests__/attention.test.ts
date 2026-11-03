import { describe, expect, it } from "vitest";
import {
  aboutSummary,
  elapsed,
  footerLine,
  levelBadge,
  statusPill,
  summaryPills,
} from "@/lib/attention";
import type { AttentionItemView, RadarStatus } from "@/types/radar";

const item = (over: Partial<AttentionItemView>): AttentionItemView =>
  ({
    level: "watch",
    severity: "medium",
    status: "new",
    resolution: null,
    ...over,
  }) as AttentionItemView;

describe("attention card rules", () => {
  it("badges by level, check, severity, then how it ended", () => {
    expect(
      levelBadge(item({ level: "incident", severity: "high" })).label,
    ).toBe("INCIDENT");
    expect(
      levelBadge(item({ status: "needs_check", severity: "high" })).label,
    ).toBe("CHECK");
    expect(levelBadge(item({ severity: "high" })).label).toBe("HIGH");
    expect(levelBadge(item({ severity: "medium" })).label).toBe("MED");
    expect(levelBadge(item({ severity: "watch" })).label).toBe("WATCH");
    expect(
      levelBadge(item({ status: "resolved", resolution: "quiet" })).label,
    ).toBe("FIXED");
    expect(
      levelBadge(item({ status: "resolved", resolution: "dismissed" })).label,
    ).toBe("DISMISSED");
  });

  it("names statuses as the design does", () => {
    expect(statusPill("in_solid").label).toBe("In #solid");
    expect(statusPill("needs_check").label).toBe("Needs a check");
  });

  it("shows a status it does not know yet instead of throwing", () => {
    expect(statusPill("on_hold" as RadarStatus)).toEqual({ label: "On hold", tone: "gray" });
  });

  it("shows the summary pills that matter", () => {
    expect(
      summaryPills({ liveIncidents: 0, new: 5, toCheck: 1, watching: 1 }).map(
        (p) => p.label,
      ),
    ).toEqual(["No live incidents", "5 new", "1 to check", "1 watching"]);
    expect(
      summaryPills({ liveIncidents: 1, new: 0, toCheck: 0, watching: 0 }).map(
        (p) => p.label,
      ),
    ).toEqual(["1 live incident"]);
  });

  it("writes the footer line from the quiet detectors", () => {
    expect(
      footerLine({
        quiet: ["card_decline_spike", "spend_drop", "signup_spike"],
        lastCheckAt: "2026-11-02T11:30:00.000Z",
      }),
    ).toBe(
      "No spike this week in card declines, card spend or sign-ups · checks every 5 min · last check 11:30 UTC · escalations go to #solid",
    );
    expect(footerLine({ quiet: [], lastCheckAt: null })).toBe(
      "checks every 5 min · not checked yet · escalations go to #solid",
    );
  });

  it("says how long", () => {
    expect(elapsed("2026-10-30T18:27:00Z", "2026-10-30T20:05:00Z")).toBe(
      "1 h 38 min",
    );
    expect(elapsed("2026-10-30T18:27:00Z", "2026-10-30T18:39:00Z")).toBe(
      "12 min",
    );
    expect(elapsed("2026-10-28T18:00:00Z", "2026-10-30T20:00:00Z")).toBe(
      "2 days",
    );
  });
});

describe("aboutSummary", () => {
  it("keeps the first sentence for the row", () => {
    expect(
      aboutSummary(
        "Several Solid accounts sent money to the same address outside Solid. It can be one person running many accounts.",
      ),
    ).toBe("Several Solid accounts sent money to the same address outside Solid.");
    expect(aboutSummary("No full stop at all")).toBe("No full stop at all");
  });

  it("does not end a sentence at an abbreviation", () => {
    expect(aboutSummary("Check e.g. the same wallet. It is suspicious.")).toBe(
      "Check e.g. the same wallet.",
    );
    expect(aboutSummary("One owner, i.e. one person. Check them.")).toBe(
      "One owner, i.e. one person.",
    );
  });
});
