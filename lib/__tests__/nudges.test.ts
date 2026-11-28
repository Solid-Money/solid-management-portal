import { describe, expect, it } from "vitest";

import {
  boardEdges,
  connectedComponents,
  copyRuleMatches,
  destinationForPath,
  diffNudge,
  diffSettings,
  draftFromNudge,
  edgeDash,
  elkGraphInput,
  extractVariables,
  formatChangeValue,
  formatDelay,
  groupIntoSections,
  insertAt,
  isEditable,
  isValidAppPath,
  isValidTimeZone,
  missingTemplateParams,
  pushCopyIssues,
  rebaseDraft,
  rebaseSettings,
  renderExample,
  settingsIssues,
  slugifyKey,
  unknownVariables,
} from "@/lib/nudges";
import type {
  NudgeDestinationView,
  NudgeSettingsView,
  NudgeView,
} from "@/types/nudges";

function nudge(key: string, overrides: Partial<NudgeView> = {}): NudgeView {
  return {
    key,
    name: key,
    flow: "onboarding",
    description: "",
    source: "config",
    status: "live",
    implemented: true,
    managed: true,
    canPause: true,
    category: "marketing",
    priority: 3,
    trigger: { label: "trigger", delayMinutes: 60, delayEditable: true },
    audience: "everyone",
    stopWhen: null,
    cooldownDays: null,
    suppressionGroup: null,
    conditions: [],
    push: {
      enabled: true,
      title: "Hello",
      body: "World",
      path: "/",
      destinationId: "home",
      imageUrl: null,
      utmSource: "src",
      utmCampaign: "solid_engagement",
    },
    email: { enabled: true, templateId: 202 },
    variables: [{ name: "tier", description: "Tier", example: "Prime" }],
    edges: [],
    note: null,
    version: 1,
    updatedAt: null,
    updatedBy: null,
    stats: null,
    ...overrides,
  };
}

const flows = [
  { id: "onboarding", label: "Onboarding" },
  { id: "kyc-card", label: "KYC and card" },
  { id: "referral", label: "Referral" },
];

describe("connectedComponents", () => {
  it("joins nudges linked in either direction and ignores unknown targets", () => {
    const nudges = [
      nudge("a", { edges: [{ to: "b", kind: "then" }] }),
      nudge("b"),
      nudge("c", { edges: [{ to: "b", kind: "stops" }] }),
      nudge("d", { edges: [{ to: "missing", kind: "then" }] }),
      nudge("e", { edges: [{ to: "e", kind: "then" }] }),
    ];
    expect(connectedComponents(nudges)).toEqual([["a", "b", "c"], ["d"], ["e"]]);
  });

  it("drops edges to nudges not on the board", () => {
    const nudges = [nudge("a", { edges: [{ to: "zzz", kind: "then" }] })];
    expect(boardEdges(nudges)).toEqual([]);
  });
});

describe("groupIntoSections", () => {
  it("orders linked groups by flow and puts unlinked nudges last", () => {
    const nudges = [
      nudge("ref-1", { flow: "referral", edges: [{ to: "ref-2", kind: "then" }] }),
      nudge("ref-2", { flow: "referral", status: "draft" }),
      nudge("lonely", { flow: "onboarding" }),
      nudge("kyc-1", { flow: "kyc-card", edges: [{ to: "on-1", kind: "then" }] }),
      nudge("on-1", { flow: "onboarding", status: "paused" }),
    ];
    const sections = groupIntoSections(nudges, flows);
    expect(sections.map((s) => s.id)).toEqual(["kyc-1", "ref-1", "standalone"]);
    expect(sections[0].title).toBe("Onboarding · KYC and card");
    expect(sections[0].counts).toEqual({ live: 1, paused: 1, draft: 0, archived: 0 });
    expect(sections[1].counts.draft).toBe(1);
    expect(sections[2]).toMatchObject({ standalone: true, keys: ["lonely"] });
  });

  it("orders a group by its earliest flow, not its first nudge", () => {
    const nudges = [
      nudge("kyc-only", { flow: "kyc-card", edges: [{ to: "kyc-2", kind: "then" }] }),
      nudge("kyc-2", { flow: "kyc-card" }),
      nudge("ref-first", { flow: "referral", edges: [{ to: "on-x", kind: "then" }] }),
      nudge("on-x", { flow: "onboarding" }),
    ];
    expect(groupIntoSections(nudges, flows).map((s) => s.id)).toEqual([
      "ref-first",
      "kyc-only",
    ]);
  });

  it("returns one section when everything is linked", () => {
    const nudges = [
      nudge("a", { edges: [{ to: "b", kind: "then" }] }),
      nudge("b", { edges: [{ to: "c", kind: "then" }] }),
      nudge("c"),
    ];
    const sections = groupIntoSections(nudges, flows);
    expect(sections).toHaveLength(1);
    expect(sections[0].standalone).toBe(false);
  });
});

describe("elkGraphInput", () => {
  it("builds a layered graph of the section's nodes and de-duplicated edges", () => {
    const nudges = [
      nudge("a", {
        edges: [
          { to: "b", kind: "then" },
          { to: "b", kind: "then" },
          { to: "c", kind: "then" },
        ],
      }),
      nudge("b"),
      nudge("c"),
    ];
    const graph = elkGraphInput(nudges, ["a", "b"]);
    expect(graph.layoutOptions["elk.algorithm"]).toBe("layered");
    expect(graph.layoutOptions["elk.direction"]).toBe("RIGHT");
    expect(graph.children.map((c) => c.id)).toEqual(["a", "b"]);
    expect(graph.edges).toEqual([
      { id: "a->b:then", sources: ["a"], targets: ["b"] },
    ]);
  });

  it("packs standalone nudges instead of layering them", () => {
    const graph = elkGraphInput([nudge("a"), nudge("b")], ["a", "b"], true);
    expect(graph.layoutOptions["elk.algorithm"]).toBe("rectpacking");
    expect(graph.edges).toEqual([]);
  });

  it("draws then solid, replaces dotted, the rest dashed", () => {
    expect(edgeDash("then")).toBeUndefined();
    expect(edgeDash("replaces")).toBe("2 4");
    expect(edgeDash("stops")).toBe("6 4");
  });
});

describe("copy checks", () => {
  const variables = [
    { name: "tier", description: "", example: "Prime" },
    { name: "amount", description: "", example: "$50" },
  ];
  const limits = { pushTitleMax: 20, pushBodyMax: 40, pushBodyCollapsed: 10 };

  it("extracts variables once each", () => {
    expect(extractVariables("{tier} and {amount} and {tier}")).toEqual([
      "tier",
      "amount",
    ]);
    expect(unknownVariables("{tier} {nope}", variables)).toEqual(["nope"]);
    expect(renderExample("Welcome to {tier}, {who}", variables)).toBe(
      "Welcome to Prime, {who}"
    );
  });

  it("flags lengths, unknown variables and copy rules", () => {
    const issues = pushCopyIssues(
      { title: "Your balance earns {nope}", body: "Twelve chars" },
      variables,
      limits,
      [{ pattern: "balance earns", message: "The balance does not earn." }]
    );
    expect(issues).toEqual([
      { level: "error", message: "The title is 25 characters; the most is 20." },
      {
        level: "warning",
        message: "The body is cut after about 10 characters when the push is collapsed.",
      },
      { level: "error", message: "This nudge has no {nope}." },
      { level: "warning", message: "The balance does not earn." },
    ]);
  });

  it("requires a title and skips broken rule patterns", () => {
    expect(pushCopyIssues({ title: " ", body: "" }, variables, limits, [])).toEqual([
      { level: "error", message: "The push needs a title." },
    ]);
    expect(copyRuleMatches("x", [{ pattern: "(", message: "bad" }])).toEqual([]);
  });

  it("lists template params the nudge does not send", () => {
    expect(
      missingTemplateParams(["recipientName", "tier", "apy"], variables)
    ).toEqual(["apy"]);
  });

  it("inserts at the caret, replacing a selection", () => {
    expect(insertAt("Hello world", "{tier} ", 6)).toEqual({
      text: "Hello {tier} world",
      caret: 13,
    });
    expect(insertAt("Hello world", "there", 6, 11)).toEqual({
      text: "Hello there",
      caret: 11,
    });
  });
});

describe("destinations", () => {
  const destinations: NudgeDestinationView[] = [
    { id: "home", label: "Home", description: "", path: "/", group: "Home" },
    {
      id: "refer",
      label: "Refer",
      description: "",
      path: "/rewards?referral=open",
      group: "Rewards",
    },
  ];

  it("matches paths ignoring utm params, order and trailing slashes", () => {
    expect(
      destinationForPath("/rewards/?utm_source=x&referral=open", destinations)?.id
    ).toBe("refer");
    expect(destinationForPath("/", destinations)?.id).toBe("home");
    expect(destinationForPath("/rewards", destinations)).toBeNull();
  });

  it("keeps query boundaries when comparing", () => {
    const tricky: NudgeDestinationView[] = [
      { id: "ab", label: "AB", description: "", path: "/rewards?a=1&b=2", group: "R" },
    ];
    expect(destinationForPath("/rewards?b=2&a=1", tricky)?.id).toBe("ab");
    expect(destinationForPath("/rewards?a=1%26b%3D2", tricky)).toBeNull();
  });

  it("accepts in-app paths only", () => {
    expect(isValidAppPath("/savings?vault=eur")).toBe(true);
    expect(isValidAppPath("https://evil.example")).toBe(false);
    expect(isValidAppPath("savings")).toBe(false);
  });
});

describe("diffNudge", () => {
  it("returns only changed fields, with blank optional text as null", () => {
    const saved = nudge("a", { suppressionGroup: null });
    const draft = draftFromNudge(saved);
    draft.push = {
      ...(draft.push as NonNullable<typeof draft.push>),
      title: "New title",
      imageUrl: "  ",
    };
    draft.suppressionGroup = "";
    draft.email = { enabled: false, templateId: 202 };
    draft.priority = 1;

    const { patch, changes } = diffNudge(saved, draft);
    expect(patch).toEqual({
      priority: 1,
      push: { title: "New title" },
      email: { enabled: false },
    });
    expect(changes.map((c) => c.field)).toEqual([
      "priority",
      "push.title",
      "email.enabled",
    ]);
  });

  it("is empty when nothing changed", () => {
    const saved = nudge("a");
    expect(diffNudge(saved, draftFromNudge(saved))).toEqual({
      patch: {},
      changes: [],
    });
  });
});

describe("settings", () => {
  const saved: NudgeSettingsView = {
    version: 3,
    marketingEnabled: true,
    respectMarketingConsent: true,
    frequencyCap: { enabled: true, perDay: 1, perWeek: 3 },
    quietHours: {
      enabled: true,
      start: "21:00",
      end: "08:00",
      fallbackTimezone: "UTC",
    },
    suppressionGroups: [{ id: "invite-ask", label: "Invite asks", days: 30 }],
    updatedAt: null,
    updatedBy: null,
  };

  it("diffs nested fields and groups", () => {
    const draft: NudgeSettingsView = {
      ...saved,
      marketingEnabled: false,
      frequencyCap: { ...saved.frequencyCap, perWeek: 4 },
      suppressionGroups: [{ id: "invite-ask", label: "Invite asks", days: 14 }],
    };
    const { patch, changes } = diffSettings(saved, draft);
    expect(patch).toEqual({
      marketingEnabled: false,
      frequencyCap: { perWeek: 4 },
      suppressionGroups: [{ id: "invite-ask", label: "Invite asks", days: 14 }],
    });
    expect(changes.map((c) => c.field)).toEqual([
      "marketingEnabled",
      "frequencyCap.perWeek",
      "suppressionGroups",
    ]);
  });

  it("sends the fallback zone trimmed, as it was validated", () => {
    const draft: NudgeSettingsView = {
      ...saved,
      quietHours: { ...saved.quietHours, fallbackTimezone: "  Europe/Berlin " },
    };
    expect(diffSettings(saved, draft).patch).toEqual({
      quietHours: { fallbackTimezone: "Europe/Berlin" },
    });
    const padded: NudgeSettingsView = {
      ...saved,
      quietHours: { ...saved.quietHours, fallbackTimezone: " UTC " },
    };
    expect(diffSettings(saved, padded)).toEqual({ patch: {}, changes: [] });
  });

  it("validates caps, times and groups", () => {
    expect(settingsIssues(saved)).toEqual([]);
    const bad: NudgeSettingsView = {
      ...saved,
      frequencyCap: { enabled: true, perDay: 2, perWeek: 1 },
      quietHours: { ...saved.quietHours, start: "9pm" },
      suppressionGroups: [
        { id: "A", label: "", days: 0 },
        { id: "a-b", label: "x", days: 2 },
        { id: "a-b", label: "y", days: 2 },
      ],
    };
    expect(settingsIssues(bad)).toEqual([
      "The weekly cap cannot be lower than the daily cap.",
      "Quiet hours need a start and end as HH:mm.",
      'Group id "A" must be 2-40 lowercase letters, digits or dashes.',
      'Group "A" needs a label.',
      'Group "A" needs a whole number of days.',
      'Group id "a-b" is used twice.',
    ]);
  });
});

describe("rebasing an unsaved edit onto a newer version", () => {
  it("keeps the admin's fields and takes everyone else's", () => {
    const v1 = nudge("a");
    const mine = draftFromNudge(v1);
    mine.push = { ...(mine.push as NonNullable<typeof mine.push>), title: "Mine" };
    mine.priority = 2;
    const v2 = nudge("a", {
      version: 2,
      push: { ...(v1.push as NonNullable<typeof v1.push>), body: "Theirs" },
      priority: 4,
    });

    const { draft, overlapping } = rebaseDraft(v1, mine, v2);
    expect(draft.push?.title).toBe("Mine");
    expect(draft.push?.body).toBe("Theirs");
    expect(draft.priority).toBe(2);
    expect(overlapping).toEqual(["priority"]);
    expect(diffNudge(v2, draft).changes.map((c) => c.field)).toEqual([
      "priority",
      "push.title",
    ]);
  });

  it("does the same for the rules", () => {
    const v3: NudgeSettingsView = {
      version: 3,
      marketingEnabled: true,
      respectMarketingConsent: true,
      frequencyCap: { enabled: true, perDay: 1, perWeek: 3 },
      quietHours: { enabled: true, start: "21:00", end: "08:00", fallbackTimezone: "UTC" },
      suppressionGroups: [],
      updatedAt: null,
      updatedBy: null,
    };
    const mine = { ...v3, frequencyCap: { ...v3.frequencyCap, perDay: 2 } };
    const v4 = { ...v3, version: 4, quietHours: { ...v3.quietHours, start: "22:00" } };

    const { draft, overlapping } = rebaseSettings(v3, mine, v4);
    expect(draft.frequencyCap.perDay).toBe(2);
    expect(draft.quietHours.start).toBe("22:00");
    expect(draft.version).toBe(4);
    expect(overlapping).toEqual([]);
  });
});

describe("rebasing a padded time zone", () => {
  it("treats padding alone as no edit, so their zone wins", () => {
    const v3: NudgeSettingsView = {
      version: 3,
      marketingEnabled: true,
      respectMarketingConsent: true,
      frequencyCap: { enabled: true, perDay: 1, perWeek: 3 },
      quietHours: { enabled: true, start: "21:00", end: "08:00", fallbackTimezone: "UTC" },
      suppressionGroups: [],
      updatedAt: null,
      updatedBy: null,
    };
    const mine = { ...v3, quietHours: { ...v3.quietHours, fallbackTimezone: " UTC " } };
    const v4 = { ...v3, version: 4, quietHours: { ...v3.quietHours, fallbackTimezone: "Europe/Berlin" } };
    const rebased = rebaseSettings(v3, mine, v4);
    expect(rebased.draft.quietHours.fallbackTimezone).toBe("Europe/Berlin");
    expect(rebased.overlapping).toEqual([]);

    const real = { ...v3, quietHours: { ...v3.quietHours, fallbackTimezone: " Asia/Dubai " } };
    const carried = rebaseSettings(v3, real, v4);
    expect(carried.draft.quietHours.fallbackTimezone).toBe("Asia/Dubai");
    expect(carried.overlapping).toEqual(["quietHours.fallbackTimezone"]);
  });
});

describe("time zones", () => {
  it("accepts IANA zones only", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone(" UTC ")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("formatting", () => {
  it("formats change values, delays and keys", () => {
    expect(formatChangeValue(true)).toBe("on");
    expect(formatChangeValue(null)).toBe("—");
    expect(formatChangeValue(["a", "b"])).toBe("a, b");
    expect(formatDelay(90)).toBe("1h 30m");
    expect(formatDelay(2880)).toBe("2d");
    expect(formatDelay(0)).toBe("at once");
    expect(slugifyKey("Friend joined (v2)!")).toBe("friend-joined-v2");
  });

  it("only lets config, managed nudges be edited by editors", () => {
    expect(isEditable(nudge("a"), true)).toBe(true);
    expect(isEditable(nudge("a"), false)).toBe(false);
    expect(isEditable(nudge("a", { source: "code" }), true)).toBe(false);
    expect(isEditable(nudge("a", { managed: false }), true)).toBe(false);
  });
});
