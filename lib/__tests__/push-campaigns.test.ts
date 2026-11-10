import { describe, expect, it } from "vitest";

import {
  campaignSlug,
  campaignType,
  emptyVariant,
  expectedSplit,
  groupDestinations,
  parseAudience,
  parseTestRecipients,
  sameIds,
  splitCsvLine,
  toVariantInput,
  variantProblem,
} from "@/lib/push-campaigns";
import type { PushDestination } from "@/types/push-campaigns";

const A = "6ac4df9322b1a60a4458ab80";
const B = "688b65a758350ee917f73832";

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
  { id: "activity", label: "Activity", description: "", path: "/activity", group: "Home" },
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
    const parsed = parseAudience(`${A}\n${B.toUpperCase()}, ${A}; mark\n\n`);
    expect(parsed).toMatchObject({
      ids: [A, B],
      invalid: ["mark"],
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

  it("reads a headerless one-column file as a list", () => {
    expect(parseAudience(`${A}\n${B}\n`).ids).toEqual([A, B]);
  });

  it("is empty for an empty paste", () => {
    expect(parseAudience("  \n ")).toMatchObject({ ids: [], invalid: [], duplicates: 0 });
  });
});

describe("splitCsvLine", () => {
  it("keeps commas and escaped quotes inside a quoted field", () => {
    expect(splitCsvLine('a,"b, c","say ""hi"""')).toEqual(["a", "b, c", 'say "hi"']);
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
    expect(expectedSplit(1001, 2, 10)).toEqual({ control: 100, arms: [451, 450] });
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
      groupDestinations(destinations).map((g) => [g.group, g.items.map((d) => d.id)]),
    ).toEqual([
      ["Home", ["home", "activity"]],
      ["Savings", ["savings_euro"]],
      ["Announcements", ["whats_new"]],
    ]);
  });
});

describe("variantProblem", () => {
  const ok = { ...emptyVariant(), title: "Earn on euros", destinationId: "savings_euro" };

  it("passes a complete variant", () => {
    expect(variantProblem(ok, destinations, whatsNew, limits)).toBeNull();
  });

  it.each([
    ["no title", { title: "  " }, "Write a title."],
    ["a long title", { title: "x".repeat(81) }, "The title is over 80 characters."],
    ["long text", { body: "x".repeat(241) }, "The text is over 240 characters."],
    ["no destination", { destinationId: "" }, "Choose where the push opens."],
    ["an unknown destination", { destinationId: "nowhere" }, "Choose where the push opens."],
    [
      "a What's New push without a page",
      { destinationId: "whats_new" },
      "Choose the What's New page to open.",
    ],
    [
      "a page the announcement does not have",
      { destinationId: "whats_new", whatsNewStep: "2", whatsNewId: whatsNew.id },
      "Choose the What's New page to open.",
    ],
    [
      "a page picked on an announcement since replaced",
      { destinationId: "whats_new", whatsNewStep: "1", whatsNewId: "eeeeeeeeeeeeeeeeeeeeeeee" },
      "The What's New announcement changed. Choose the page again.",
    ],
  ])("refuses %s", (_label, override, problem) => {
    expect(variantProblem({ ...ok, ...override }, destinations, whatsNew, limits)).toBe(problem);
  });

  it("passes a What's New page picked on the active announcement", () => {
    expect(
      variantProblem(
        { ...ok, destinationId: "whats_new", whatsNewStep: "1", whatsNewId: whatsNew.id },
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
    expect(parseTestRecipients(`@mark, ${A}\nmark luka`)).toEqual(["mark", A, "luka"]);
  });
});
