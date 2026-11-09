import { describe, expect, it } from "vitest";
import {
  daysLate,
  formatDue,
  formatWhen,
  mentionNames,
  mentionQuery,
  mentionsInText,
  personName,
  plainText,
  shiftSprint,
  splitMentions,
  splitRich,
  sprintLabel,
  sprintStart,
} from "@/lib/task-format";
import { isTaskChange } from "@/lib/realtime";

const people = [
  { email: "musab@fuse.io", name: "Musab Ali" },
  { email: "eli@fuse.io", name: null },
];

describe("personName", () => {
  it("uses the roster name, else the email's local part", () => {
    expect(personName("musab@fuse.io", people)).toBe("Musab Ali");
    expect(personName("eli@fuse.io", people)).toBe("Eli");
    expect(personName("mark.smith@fuse.io")).toBe("Mark Smith");
    expect(personName(null)).toBe("Nobody");
  });
});

describe("dates", () => {
  it("formats a due date without a time zone shift", () => {
    expect(formatDue("2026-11-10")).toBe("Tue, Nov 10");
  });

  it("counts days late in the admin's calendar", () => {
    const now = new Date(2026, 10, 8, 23, 30);
    expect(daysLate("2026-11-05", now)).toBe(3);
    expect(daysLate("2026-11-08", now)).toBe(0);
    expect(daysLate("2026-11-09", now)).toBe(-1);
  });

  it("says today and yesterday", () => {
    const now = new Date(2026, 10, 8, 15, 0);
    expect(formatWhen(new Date(2026, 10, 8, 9, 5).toISOString(), now)).toBe("Today, 09:05");
    expect(formatWhen(new Date(2026, 10, 7, 22, 0).toISOString(), now)).toBe("Yesterday, 22:00");
    expect(formatWhen(new Date(2026, 9, 30, 8, 0).toISOString(), now)).toBe("Oct 30, 08:00");
    expect(formatWhen(new Date(2025, 9, 30, 8, 0).toISOString(), now)).toBe("Oct 30 2025, 08:00");
  });
});

describe("mentions", () => {
  it("finds the @query before the caret", () => {
    expect(mentionQuery("hey @mu", 7)).toEqual({ text: "mu", start: 4 });
    expect(mentionQuery("@", 1)).toEqual({ text: "", start: 0 });
    expect(mentionQuery("mail eli@fuse", 13)).toBeNull();
    expect(mentionQuery("hey @musab ali", 14)).toBeNull();
  });

  it("drops a mention whose @Name was deleted", () => {
    const picked = ["musab@fuse.io", "eli@fuse.io"];
    expect(mentionsInText("@Musab Ali can you look", picked, people)).toEqual(["musab@fuse.io"]);
    expect(mentionsInText("@Eli and @Musab", picked, people)).toEqual(["musab@fuse.io", "eli@fuse.io"]);
  });

  it("splits text around mentions, longest name first", () => {
    const names = mentionNames(["musab@fuse.io"], people);
    expect(names).toEqual(["Musab Ali", "Musab"]);
    expect(splitMentions("ping @Musab Ali (and @Musab) about it", names)).toEqual([
      { text: "ping ", mention: false },
      { text: "@Musab Ali", mention: true },
      { text: " (and ", mention: false },
      { text: "@Musab", mention: true },
      { text: ") about it", mention: false },
    ]);
    expect(splitMentions("no mentions", [])).toEqual([{ text: "no mentions", mention: false }]);
  });
});

describe("isTaskChange", () => {
  it("accepts the gateway's payload only", () => {
    expect(isTaskChange({ taskId: "a".repeat(24), number: 661, reason: "update" })).toBe(true);
    expect(isTaskChange({ taskId: "nope", number: 661, reason: "update" })).toBe(false);
    expect(isTaskChange({ taskId: "a".repeat(24), number: 661, reason: "deleted" })).toBe(false);
    expect(isTaskChange(null)).toBe(false);
  });
});

describe("splitRich", () => {
  it("finds headings, portal links and pasted addresses", () => {
    expect(
      splitRich("**Customer:** [fuseprime](/users/u1) · see https://basescan.org/tx/0xab, thanks"),
    ).toEqual([
      { kind: "bold", text: "Customer:" },
      { kind: "text", text: " " },
      { kind: "link", text: "fuseprime", href: "/users/u1", internal: true },
      { kind: "text", text: " · see " },
      { kind: "link", text: "https://basescan.org/tx/0xab", href: "https://basescan.org/tx/0xab", internal: false },
      { kind: "text", text: ", thanks" },
    ]);
  });

  it("never makes a link of anything but a portal path or http(s)", () => {
    expect(splitRich("[click](javascript:alert(1)) and [x](//evil.example)")).toEqual([
      { kind: "text", text: "[click](javascript:alert(1)) and [x](//evil.example)" },
    ]);
  });

  it("gives plain text for previews", () => {
    expect(plainText("**Waiting on:** [Open the chat](/support?c=1)")).toBe("Waiting on: Open the chat");
  });
});

describe("sprints", () => {
  it("are weeks from Monday (UTC)", () => {
    expect(sprintStart(new Date("2026-11-15T23:00:00Z"))).toBe("2026-11-09");
    expect(sprintStart(new Date("2026-11-16T00:30:00Z"))).toBe("2026-11-16");
    expect(shiftSprint("2026-11-09", 1)).toBe("2026-11-16");
    expect(sprintLabel("2026-11-09")).toBe("Nov 9–15");
    expect(sprintLabel("2026-11-30")).toBe("Nov 30–Dec 6");
  });
});
