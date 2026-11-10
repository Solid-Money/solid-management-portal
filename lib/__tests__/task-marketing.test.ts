import { describe, expect, it } from "vitest";
import {
  assetLabel,
  calendarWeek,
  campaignDates,
  groupByCampaign,
  hasBrief,
  launchesFor,
  localToday,
  publishLabel,
  shiftWeek,
  weekRange,
  weekStart,
} from "@/lib/task-marketing";
import type { TaskCampaign, TaskMarketing, TaskMarketingOverview, TaskRow } from "@/types/tasks";

function campaign(id: string, name: string, extra: Partial<TaskCampaign> = {}): TaskCampaign {
  return {
    id,
    name,
    startOn: null,
    endOn: null,
    color: "indigo",
    archived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...extra,
  };
}

let next = 0;
function piece(title: string, marketing: Partial<TaskMarketing> = {}, extra: Partial<TaskRow> = {}): TaskRow {
  next += 1;
  return {
    id: `p${next}`,
    title,
    status: "todo",
    ownerEmail: null,
    marketing: {
      campaignId: null,
      parentId: null,
      channel: null,
      stage: "coming",
      publishOn: null,
      publishTime: null,
      assetUrl: null,
      brief: {},
      approvers: [],
      approvalRequestedAt: null,
      approvalRequestedBy: null,
      approvedBy: null,
      approvedAt: null,
      ...marketing,
    },
    ...extra,
  } as TaskRow;
}

const titles = (overview: TaskMarketingOverview, matches?: (row: TaskRow) => boolean) =>
  groupByCampaign(overview, matches).map((group) => ({
    campaign: group.campaign?.name ?? null,
    rows: group.rows.map((row) => (row.child ? `  ${row.piece.title}` : row.piece.title)),
    progress: `${group.posted}/${group.total}`,
  }));

describe("groupByCampaign", () => {
  const euro = campaign("c1", "EURO, Cashback, Security");
  const july = campaign("c2", "July Blitz");
  const launch = piece("Rewards wave 1", { campaignId: "c2", channel: "launch", publishOn: "2026-07-13" });
  const overview: TaskMarketingOverview = {
    campaigns: [euro, july],
    pieces: [
      piece("Security checkup", { campaignId: "c1" }),
      piece("EURO follow-up", { campaignId: "c1", publishOn: "2026-10-20", stage: "posted" }),
      piece("Email E5", { campaignId: "c2", parentId: launch.id, publishOn: "2026-07-14", publishTime: "12:00" }),
      piece("Blog", { campaignId: "c2", parentId: launch.id, publishOn: "2026-07-14", publishTime: "11:00" }),
      launch,
      piece("Wirex", { campaignId: "c2", publishOn: "2026-07-27" }),
      piece("Loose idea"),
      piece("From an archived campaign", { campaignId: "gone" }),
    ],
    truncated: false,
  };

  it("puts launches above their pieces, dated first", () => {
    expect(titles(overview)).toEqual([
      { campaign: "EURO, Cashback, Security", rows: ["EURO follow-up", "Security checkup"], progress: "1/2" },
      { campaign: "July Blitz", rows: ["Rewards wave 1", "  Blog", "  Email E5", "Wirex"], progress: "0/4" },
      { campaign: null, rows: ["Loose idea", "From an archived campaign"], progress: "0/2" },
    ]);
    const rewards = groupByCampaign(overview)[1]!.rows[0]!;
    expect(rewards.children).toBe(2);
  });

  it("leaves cancelled pieces out of the progress", () => {
    const groups = groupByCampaign({
      campaigns: [euro],
      pieces: [
        piece("Posted", { campaignId: "c1", stage: "posted" }, { status: "done" }),
        piece("Dropped", { campaignId: "c1", stage: "posted" }, { status: "cancelled" }),
        piece("Coming", { campaignId: "c1" }),
      ],
      truncated: false,
    });
    expect([groups[0]!.posted, groups[0]!.total, groups[0]!.rows.length]).toEqual([1, 2, 3]);
  });

  it("keeps a matching piece's launch, and only what matches", () => {
    const groups = titles(overview, (row) => row.title.startsWith("Email"));
    // Groups with nothing to show are left to the board; no loose group at all.
    expect(groups.map((g) => g.rows)).toEqual([[], ["Rewards wave 1", "  Email E5"]]);
    // Progress still counts the whole campaign.
    expect(groups[1]!.progress).toBe("0/4");
  });

  it("shows an empty campaign, and no 'No campaign' group without loose pieces", () => {
    const groups = titles({ campaigns: [euro], pieces: [], truncated: false });
    expect(groups).toEqual([{ campaign: "EURO, Cashback, Security", rows: [], progress: "0/0" }]);
    expect(titles({ campaigns: [], pieces: [], truncated: false })).toEqual([
      { campaign: null, rows: [], progress: "0/0" },
    ]);
  });
});

describe("launchesFor", () => {
  it("offers launches in the piece's campaign, and the one it's under", () => {
    const a = piece("Wave 1", { campaignId: "c1", channel: "launch" });
    const b = piece("Virtual Accounts", { campaignId: "c1", channel: "launch" });
    const other = piece("Card launch", { campaignId: "c2", channel: "launch" });
    const post = piece("A post", { campaignId: "c1", channel: "x_post" });
    const child = piece("Email", { campaignId: "c1", channel: "launch", parentId: a.id });
    const all = [a, b, other, post, child];
    expect(launchesFor(all, "c1").map((p) => p.title)).toEqual(["Wave 1", "Virtual Accounts"]);
    expect(launchesFor(all, "c1", { id: a.id }).map((p) => p.title)).toEqual(["Virtual Accounts"]);
    // Under one in another campaign: it stays on offer.
    expect(launchesFor(all, "c1", { parentId: other.id }).map((p) => p.title)).toEqual([
      "Wave 1",
      "Virtual Accounts",
      "Card launch",
    ]);
  });
});

describe("calendarWeek", () => {
  it("lays a week out Monday to Sunday, all day first then by time", () => {
    const pieces = [
      piece("Push", { publishOn: "2026-11-11", publishTime: "11:00" }),
      piece("Article", { publishOn: "2026-11-11" }),
      piece("Thread", { publishOn: "2026-11-11", publishTime: "09:30" }),
      piece("Sunday post", { publishOn: "2026-11-15", publishTime: "18:00" }),
      piece("Next week", { publishOn: "2026-11-16" }),
    ];
    const days = calendarWeek("2026-11-09", pieces, "2026-11-10");
    expect(days.map((d) => `${d.weekday} ${d.day}${d.today ? " (today)" : ""}`)).toEqual([
      "Mon 9",
      "Tue 10 (today)",
      "Wed 11",
      "Thu 12",
      "Fri 13",
      "Sat 14",
      "Sun 15",
    ]);
    expect(days[2]!.pieces.map((p) => p.title)).toEqual(["Article", "Thread", "Push"]);
    expect(days[6]!.pieces.map((p) => p.title)).toEqual(["Sunday post"]);
    expect(days.flatMap((d) => d.pieces).some((p) => p.title === "Next week")).toBe(false);
  });

  it("finds a week's Monday and moves by weeks", () => {
    expect(weekStart("2026-11-10")).toBe("2026-11-09");
    expect(weekStart("2026-11-15")).toBe("2026-11-09");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(weekRange("2026-10-26")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(shiftWeek("2026-11-09", -1)).toBe("2026-11-02");
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
    expect(localToday(new Date(2026, 10, 8, 23, 30))).toBe("2026-11-08");
  });
});

describe("labels", () => {
  it("says when a piece goes out", () => {
    expect(publishLabel("2026-10-27", "13:00")).toBe("Tue, Oct 27 · 13:00");
    expect(publishLabel("2026-10-27", null)).toBe("Tue, Oct 27");
    expect(publishLabel(null, null)).toBeNull();
  });

  it("says a campaign's dates", () => {
    expect(campaignDates(campaign("a", "A", { startOn: "2026-10-19", endOn: "2026-10-24" }))).toBe("Oct 19 – 24");
    expect(campaignDates(campaign("a", "A", { startOn: "2026-10-26", endOn: "2026-11-01" }))).toBe("Oct 26 – Nov 1");
    expect(campaignDates(campaign("a", "A", { startOn: "2026-10-19" }))).toBe("From Oct 19");
    expect(campaignDates(campaign("a", "A", { endOn: "2026-10-24" }))).toBe("Until Oct 24");
    expect(campaignDates(campaign("a", "A"))).toBeNull();
  });

  it("names an asset link by where it lives", () => {
    expect(assetLabel("https://www.figma.com/design/abc/Launch")).toBe("Figma");
    expect(assetLabel("https://typefully.com/t/xyz")).toBe("Typefully");
    expect(assetLabel("https://docs.google.com/document/d/1")).toBe("Google Docs");
    expect(assetLabel("https://www.solid.xyz/post/invite")).toBe("solid.xyz");
    expect(assetLabel("https://notfigma.com.evil.io/x")).toBe("notfigma.com.evil.io");
    expect(assetLabel("not a url")).toBe("Link");
  });

  it("knows when a brief has something in it", () => {
    expect(hasBrief(piece("a", { brief: { tone: "Warm" } }))).toBe(true);
    expect(hasBrief(piece("a", { brief: { tone: "  " } }))).toBe(false);
    expect(hasBrief(piece("a"))).toBe(false);
  });
});
