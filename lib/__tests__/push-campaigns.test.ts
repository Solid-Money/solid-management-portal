import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  campaignSlug,
  campaignType,
  controlGroupSources,
  defaultSendAt,
  describeFilters,
  emptyFilters,
  emptyVariant,
  expectedSplit,
  filtersDraftOf,
  formatUtcSendAt,
  groupDestinations,
  localInputToIso,
  localTimeClash,
  localTimeZoneLabel,
  parseAudience,
  parseCsvRecords,
  parseTestRecipients,
  sameFilters,
  sameIds,
  seedFromCampaign,
  sendAtInstant,
  sendTimeProblem,
  splitCsvLine,
  toFiltersInput,
  toLocalInput,
  toVariantInput,
  variantProblem,
} from "@/lib/push-campaigns";
import type {
  PushCampaignDetail,
  PushDestination,
} from "@/types/push-campaigns";

const A = "000000000000000000000a01";
const B = "000000000000000000000b02";

const destinations: PushDestination[] = [
  { id: "home", label: "Home", description: "", path: "/", group: "Home" },
  {
    id: "savings_euro",
    label: "Savings → Euro yield",
    description: "",
    path: "/savings?vault=eur",
    group: "Savings",
    needsNewApp: true,
  },
  {
    id: "whats_new",
    label: "What's New → a page",
    description: "",
    path: "/",
    group: "Announcements",
    needsWhatsNewStep: true,
  },
  {
    id: "activity",
    label: "Activity",
    description: "",
    path: "/activity",
    group: "Home",
  },
];
const whatsNew = {
  id: "ffffffffffffffffffffffff",
  steps: [
    { index: 0, title: "Card" },
    { index: 1, title: "Euro yield" },
  ],
};
const limits = { titleMaxLength: 80, bodyMaxLength: 240 };

describe("parseAudience", () => {
  it("reads a pasted list, deduping and setting aside what is not an id", () => {
    const parsed = parseAudience(`${A}\n${B.toUpperCase()}, ${A}; tester\n\n`);
    expect(parsed).toMatchObject({
      ids: [A, B],
      invalid: ["tester"],
      duplicates: 1,
      source: "list",
    });
  });

  it("reads only the user id column of an export", () => {
    const csv = [
      '"user_id","amplitude_id","country","last_seen"',
      `"${A}","123456789","DE","2026-11-01"`,
      `"${B}","987654321","FR, overseas","2026-11-02"`,
      `"","555","DE",""`,
    ].join("\r\n");

    expect(parseAudience(csv)).toEqual({
      ids: [A, B],
      invalid: [],
      duplicates: 0,
      source: "column",
      column: "user_id",
    });
  });

  it("finds the id column wherever it is and however it is cased", () => {
    const csv = `email,User ID\nx@solid.xyz,${A}\ny@solid.xyz,not-an-id`;
    expect(parseAudience(csv)).toMatchObject({
      ids: [A],
      invalid: ["not-an-id"],
      column: "User ID",
    });
  });

  it("keeps a row's id when an earlier quoted column spans lines", () => {
    const csv = [
      "note,user_id,country",
      `"first line\nsecond line, with a comma",${A},DE`,
      `plain,${B},FR`,
    ].join("\n");

    expect(parseAudience(csv)).toEqual({
      ids: [A, B],
      invalid: [],
      duplicates: 0,
      source: "column",
      column: "user_id",
    });
  });

  it("reads a headerless one-column file as a list", () => {
    expect(parseAudience(`${A}\n${B}\n`).ids).toEqual([A, B]);
  });

  it("is empty for an empty paste", () => {
    expect(parseAudience("  \n ")).toMatchObject({
      ids: [],
      invalid: [],
      duplicates: 0,
    });
  });
});

describe("splitCsvLine", () => {
  it("keeps commas and escaped quotes inside a quoted field", () => {
    expect(splitCsvLine('a,"b, c","say ""hi"""')).toEqual([
      "a",
      "b, c",
      'say "hi"',
    ]);
  });
});

describe("parseCsvRecords", () => {
  it("splits records on line breaks outside quotes only", () => {
    expect(parseCsvRecords('a,"b\r\nc"\r\n\r\nd,"say ""hi"""\n')).toEqual([
      ["a", "b\r\nc"],
      ["d", 'say "hi"'],
    ]);
  });
});

describe("sameIds", () => {
  it("ignores order but not membership", () => {
    expect(sameIds([A, B], [B, A])).toBe(true);
    expect(sameIds([A], [A, B])).toBe(false);
    expect(sameIds([A, A], [A, B])).toBe(false);
  });
});

describe("campaign labels", () => {
  it("slugs a name the way accounts-service does", () => {
    expect(campaignSlug("Euro yield — Nov 2026!")).toBe("euro_yield_nov_2026");
    expect(campaignSlug("Café crème")).toBe("cafe_creme");
    expect(campaignSlug("  ")).toBe("");
  });

  it("keeps the slug short enough for the FCM label", () => {
    const slug = campaignSlug("A very long campaign name that goes on and on");
    expect(slug.length).toBeLessThanOrEqual(32);
    expect(slug.endsWith("_")).toBe(false);
    expect(campaignType(slug, "c").length).toBeLessThanOrEqual(50);
  });
});

describe("expectedSplit", () => {
  it("takes the rounded control share and deals the rest evenly", () => {
    expect(expectedSplit(1001, 2, 10)).toEqual({
      control: 100,
      arms: [451, 450],
    });
    expect(expectedSplit(10, 3, 0)).toEqual({ control: 0, arms: [4, 3, 3] });
  });

  it("matches a tiny audience", () => {
    expect(expectedSplit(1, 2, 0)).toEqual({ control: 0, arms: [1, 0] });
    expect(expectedSplit(0, 1, 20)).toEqual({ control: 0, arms: [0] });
  });
});

describe("groupDestinations", () => {
  it("groups in the order groups first appear", () => {
    expect(
      groupDestinations(destinations).map((g) => [
        g.group,
        g.items.map((d) => d.id),
      ]),
    ).toEqual([
      ["Home", ["home", "activity"]],
      ["Savings", ["savings_euro"]],
      ["Announcements", ["whats_new"]],
    ]);
  });
});

describe("variantProblem", () => {
  const ok = {
    ...emptyVariant(),
    title: "Earn on euros",
    destinationId: "savings_euro",
  };

  it("passes a complete variant", () => {
    expect(variantProblem(ok, destinations, whatsNew, limits)).toBeNull();
  });

  it.each([
    ["no title", { title: "  " }, "Write a title."],
    [
      "a long title",
      { title: "x".repeat(81) },
      "The title is over 80 characters.",
    ],
    [
      "long text",
      { body: "x".repeat(241) },
      "The text is over 240 characters.",
    ],
    ["no destination", { destinationId: "" }, "Choose where the push opens."],
    [
      "an unknown destination",
      { destinationId: "nowhere" },
      "Choose where the push opens.",
    ],
    [
      "a What's New push without a page",
      { destinationId: "whats_new" },
      "Choose the What's New page to open.",
    ],
    [
      "a page the announcement does not have",
      {
        destinationId: "whats_new",
        whatsNewStep: "2",
        whatsNewId: whatsNew.id,
      },
      "Choose the What's New page to open.",
    ],
    [
      "a page picked on an announcement since replaced",
      {
        destinationId: "whats_new",
        whatsNewStep: "1",
        whatsNewId: "eeeeeeeeeeeeeeeeeeeeeeee",
      },
      "The What's New announcement changed. Choose the page again.",
    ],
  ])("refuses %s", (_label, override, problem) => {
    expect(
      variantProblem({ ...ok, ...override }, destinations, whatsNew, limits),
    ).toBe(problem);
  });

  it("passes a What's New page picked on the active announcement", () => {
    expect(
      variantProblem(
        {
          ...ok,
          destinationId: "whats_new",
          whatsNewStep: "1",
          whatsNewId: whatsNew.id,
        },
        destinations,
        whatsNew,
        limits,
      ),
    ).toBeNull();
  });

  it("refuses What's New when nothing is active", () => {
    expect(
      variantProblem(
        { ...ok, destinationId: "whats_new", whatsNewStep: "0" },
        destinations,
        null,
        limits,
      ),
    ).toBe("There is no active What's New announcement to open.");
  });
});

describe("a single image or video What's New", () => {
  const single = { id: whatsNew.id, format: "single", steps: [] };
  const draft = {
    ...emptyVariant(),
    title: "New",
    destinationId: "whats_new",
    whatsNewId: whatsNew.id,
  };

  it("needs no page", () => {
    expect(variantProblem(draft, destinations, single, limits)).toBeNull();
  });

  it("refuses it once the announcement has been replaced", () => {
    expect(
      variantProblem(
        { ...draft, whatsNewId: "eeeeeeeeeeeeeeeeeeeeeeee" },
        destinations,
        single,
        limits,
      ),
    ).toBe("The What's New announcement changed. Choose it again.");
  });

  it("refuses a page picked while it was still a carousel", () => {
    for (const whatsNewStep of ["0", "2"]) {
      expect(
        variantProblem(
          { ...draft, whatsNewStep },
          destinations,
          single,
          limits,
        ),
      ).toBe("The What's New announcement changed. Choose it again.");
    }
  });

  it("sends the announcement without a page", () => {
    expect(toVariantInput(draft, destinations)).toEqual({
      title: "New",
      destinationId: "whats_new",
      whatsNewId: whatsNew.id,
    });
  });
});

describe("toVariantInput", () => {
  it("trims the copy and drops an empty body", () => {
    expect(
      toVariantInput(
        {
          title: " Earn ",
          body: "  ",
          destinationId: "savings_euro",
          whatsNewStep: "1",
          whatsNewId: whatsNew.id,
        },
        destinations,
      ),
    ).toEqual({ title: "Earn", destinationId: "savings_euro" });
  });

  it("names the announcement the page was picked on, and the page", () => {
    expect(
      toVariantInput(
        {
          title: "New",
          body: "See it",
          destinationId: "whats_new",
          whatsNewStep: "1",
          whatsNewId: whatsNew.id,
        },
        destinations,
      ),
    ).toEqual({
      title: "New",
      body: "See it",
      destinationId: "whats_new",
      whatsNewId: whatsNew.id,
      whatsNewStep: 1,
    });
  });
});

describe("parseTestRecipients", () => {
  it("accepts ids and usernames, with or without @", () => {
    expect(parseTestRecipients(`@tester, ${A}\ntester tester2`)).toEqual([
      "tester",
      A,
      "tester2",
    ]);
  });
});

describe("send-time filters", () => {
  const ALL = ["core", "prime", "ultra"] as const;

  it("sends nothing when they leave nobody out", () => {
    expect(toFiltersInput(emptyFilters(), ALL)).toBeUndefined();
    // Every tier ticked is the same as none.
    expect(
      toFiltersInput({ ...emptyFilters(), tiers: [...ALL] }, ALL),
    ).toBeUndefined();
  });

  it("keeps the tiers in ladder order, with how a trial counts", () => {
    expect(
      toFiltersInput(
        { tiers: ["prime", "core"], ignoreTrials: true, excludeControlOf: [] },
        ALL,
      ),
    ).toEqual({ tiers: ["core", "prime"], ignoreTrials: true });
  });

  it("names the control groups to leave out", () => {
    expect(
      toFiltersInput(
        { tiers: [], ignoreTrials: true, excludeControlOf: [A] },
        ALL,
      ),
    ).toEqual({ excludeControlOf: [A] });
  });

  it("compares filters by who they leave out, not by order", () => {
    expect(
      sameFilters(
        { tiers: ["core", "prime"], ignoreTrials: true },
        { tiers: ["prime", "core"], ignoreTrials: true },
      ),
    ).toBe(true);
    expect(sameFilters(undefined, {})).toBe(true);
    expect(
      sameFilters(
        { tiers: ["core"], ignoreTrials: true },
        { tiers: ["core"], ignoreTrials: false },
      ),
    ).toBe(false);
    expect(sameFilters({ excludeControlOf: [A] }, undefined)).toBe(false);
  });

  it("describes them in a sentence", () => {
    expect(
      describeFilters(
        { tiers: ["core"], ignoreTrials: true, excludeControlOf: [A] },
        () => "BF opening",
      ),
    ).toBe(
      "only Core at send time (free trials not counted); leaving out the control group of BF opening",
    );
    expect(describeFilters(undefined, () => "")).toBeNull();
  });

  it("round-trips a stored campaign's filters through the form", () => {
    const stored = { tiers: ["prime" as const], ignoreTrials: false };
    expect(toFiltersInput(filtersDraftOf(stored), ALL)).toEqual(stored);
  });
});

describe("send time", () => {
  const limits = { scheduleMinLeadMinutes: 2, scheduleMaxAheadDays: 60 };
  const now = new Date("2026-11-27T10:00:00");

  it("reads a datetime-local value in this browser's time zone", () => {
    const iso = localInputToIso("2026-11-30T09:30");
    expect(iso).toBe(new Date(2026, 10, 30, 9, 30).toISOString());
    expect(toLocalInput(iso)).toBe("2026-11-30T09:30");
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("next monday")).toBeNull();
  });

  it("refuses a time too soon, too far, or missing", () => {
    expect(sendTimeProblem("2026-11-27T10:01", limits, now)).toMatch(
      /at least 2 minutes/,
    );
    expect(sendTimeProblem("2026-11-27T09:00", limits, now)).toMatch(
      /at least 2 minutes/,
    );
    expect(sendTimeProblem("2027-02-01T10:00", limits, now)).toMatch(
      /at most 60 days/,
    );
    expect(sendTimeProblem("", limits, now)).toBe("Pick a date and time.");
    expect(sendTimeProblem("2026-11-30T09:00", limits, now)).toBeNull();
  });

  it("defaults to a whole hour at least an hour away", () => {
    expect(defaultSendAt(new Date("2026-11-27T10:20:00"))).toBe(
      "2026-11-27T12:00",
    );
  });

  it("shows the time in UTC too", () => {
    expect(formatUtcSendAt("2026-11-30T09:00:00.000Z")).toBe(
      "Mon, Nov 30, 09:00 UTC",
    );
  });

  it("names the time zone with its offset", () => {
    expect(localTimeZoneLabel()).toContain(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});

describe("editing a scheduled campaign", () => {
  const scheduled: PushCampaignDetail = {
    id: "6b0000000000000000000009",
    name: "BF reminder",
    slug: "bf_reminder",
    status: "scheduled",
    variants: [
      {
        key: "a",
        title: "Your upgrade is still 30% off",
        destinationId: "whats_new",
        path: "/?whatsNew=ffffffffffffffffffffffff&whatsNewStep=1",
        type: "campaign-bf_reminder-a",
        whatsNewId: "ffffffffffffffffffffffff",
        whatsNewStep: 1,
        recipients: 0,
        handedOff: 0,
      },
    ],
    controlPercent: 0,
    controlCount: 0,
    requested: 2,
    notFound: 0,
    unreachable: 0,
    reachable: 0,
    audienceFilters: { tiers: ["core"], ignoreTrials: true },
    createdBy: "luka@fuse.io",
    sendAt: "2026-11-30T09:00:00.000Z",
    createdAt: "2026-11-26T09:00:00.000Z",
    userIds: [A, B],
  };

  it("starts the form from what was scheduled", () => {
    const seed = seedFromCampaign(scheduled);
    expect(parseAudience(seed.raw).ids).toEqual([A, B]);
    expect(seed.variants[0]).toEqual({
      title: "Your upgrade is still 30% off",
      body: "",
      destinationId: "whats_new",
      whatsNewStep: "1",
      whatsNewId: "ffffffffffffffffffffffff",
    });
    expect(seed.controlOn).toBe(false);
    expect(seed.filters.tiers).toEqual(["core"]);
    expect(localInputToIso(seed.sendAt)).toBe("2026-11-30T09:00:00.000Z");
  });

  it("offers only campaigns that held a control group back, never itself", () => {
    const sources = controlGroupSources(
      [
        { ...scheduled, controlPercent: 10 },
        { ...scheduled, id: "a", status: "sent", controlPercent: 10 },
        { ...scheduled, id: "b", status: "sent", controlPercent: 0 },
        { ...scheduled, id: "c", status: "cancelled", controlPercent: 10 },
        { ...scheduled, id: "d", status: "failed", controlPercent: 10 },
      ],
      scheduled.id,
    );
    expect(sources.map((c) => c.id)).toEqual(["a"]);
  });

  describe("around a clock change (New York)", () => {
    const limits = { scheduleMinLeadMinutes: 2, scheduleMaxAheadDays: 60 };
    const now = new Date("2027-10-01T12:00:00Z");
    let zone: string | undefined;
    beforeAll(() => {
      zone = process.env.TZ;
      process.env.TZ = "America/New_York";
    });
    afterAll(() => {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    });

    it("tells a repeated or skipped local time from an ordinary one", () => {
      // Clocks go back from 02:00 to 01:00 on 7 Nov 2027, forward from 02:00
      // to 03:00 on 14 Mar 2027.
      expect(localTimeClash("2027-11-07T01:30")).toBe("repeated");
      expect(localTimeClash("2027-03-14T02:30")).toBe("skipped");
      expect(localTimeClash("2027-11-07T03:30")).toBeNull();
      expect(localTimeClash("")).toBeNull();
    });

    it("keeps the stored instant when the time is left as loaded", () => {
      // 06:30 UTC is the second 01:30 that night; read back from the local
      // time it would be the first, an hour earlier.
      const seed = seedFromCampaign({
        ...scheduled,
        sendAt: "2027-11-07T06:30:00.000Z",
      });
      expect(seed.sendAt).toBe("2027-11-07T01:30");
      expect(localInputToIso(seed.sendAt)).toBe("2027-11-07T05:30:00.000Z");
      expect(sendAtInstant(seed.sendAt, seed.storedSendAt)).toBe(
        "2027-11-07T06:30:00.000Z",
      );
      expect(
        sendTimeProblem(seed.sendAt, limits, now, seed.storedSendAt),
      ).toBeNull();
    });

    it("refuses a repeated or skipped time typed in", () => {
      expect(sendTimeProblem("2027-11-07T01:30", limits, now)).toMatch(
        /happens twice/,
      );
      expect(sendTimeProblem("2027-03-14T02:30", limits, now)).toMatch(
        /never happens/,
      );
      expect(sendTimeProblem("2027-11-07T03:30", limits, now)).toBeNull();
    });
  });
});
