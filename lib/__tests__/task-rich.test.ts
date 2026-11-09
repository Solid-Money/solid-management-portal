import { describe, expect, it } from "vitest";
import {
  CLAUDE_HOLDING_LINE,
  bodyToHtml,
  claudeLookingIn,
  fileSize,
  imageUrls,
  inlineKeys,
  isClaudeLooking,
  textToHtml,
} from "@/lib/task-rich";
import type { TaskDetail, TaskUpdate } from "@/types/tasks";

describe("rich task text", () => {
  it("opens old plain text in the editor as it looked", () => {
    expect(
      textToHtml("**Customer:** [fuseprime](/users/1) <b>\nline two\n\nNext [x](javascript:alert(1))"),
    ).toBe(
      '<p><strong>Customer:</strong> <a href="/users/1">fuseprime</a> &lt;b&gt;<br>line two</p>' +
        "<p>Next [x](javascript:alert(1))</p>",
    );
    expect(textToHtml("   ")).toBe("");
    expect(bodyToHtml("<p>hi</p>", "html")).toBe("<p>hi</p>");
    expect(bodyToHtml("<p>hi</p>", "text")).toBe("<p>&lt;p&gt;hi&lt;/p&gt;</p>");
  });

  it("finds inline images and their links", () => {
    expect([...inlineKeys('<p><img data-key="a/b.jpg"></p><img data-key="c.jpg" />')]).toEqual(["a/b.jpg", "c.jpg"]);
    const urls = imageUrls([
      { key: "a/b.jpg", mime: "image/jpeg", size: 1, fileName: null, width: null, height: null, url: "https://x/1" },
      { key: "d.bin", mime: "application/octet-stream", size: 1, fileName: "d", width: null, height: null, url: "https://x/2" },
      { key: "e.jpg", mime: "image/jpeg", size: 1, fileName: null, width: null, height: null, url: null },
    ]);
    expect([...urls]).toEqual([["a/b.jpg", "https://x/1"]]);
  });

  it("says how big a file is", () => {
    expect(fileSize(900)).toBe("900 B");
    expect(fileSize(482_100)).toBe("471 KB");
    expect(fileSize(1_820_100)).toBe("1.7 MB");
  });
});

describe("Claude in a task", () => {
  const update = (bot: "claude" | null, body: string, replies: TaskUpdate[] = []): TaskUpdate =>
    ({
      id: body,
      kind: "update",
      parentId: null,
      author: { email: bot ? null : "eli@fuse.io", name: null, bot },
      body,
      format: "text",
      mentions: [],
      attachments: [],
      activity: null,
      reactions: [],
      seenBy: [],
      createdAt: "2026-11-09T20:00:00Z",
      editedAt: null,
      deleted: false,
      replies,
    }) as unknown as TaskUpdate;

  it("knows when Claude is still looking, in a reply too", () => {
    const asked = update(null, "@Claude follow up", [update("claude", CLAUDE_HOLDING_LINE)]);
    expect(isClaudeLooking(asked.replies[0]!)).toBe(true);
    expect(claudeLookingIn({ updates: [asked] } as unknown as TaskDetail)).toBe(true);
    const answered = update(null, "@Claude follow up", [update("claude", "The batch went out at 10:00.")]);
    expect(claudeLookingIn({ updates: [answered] } as unknown as TaskDetail)).toBe(false);
    // Someone typing the same words isn't Claude.
    expect(isClaudeLooking(update(null, CLAUDE_HOLDING_LINE))).toBe(false);
    expect(claudeLookingIn(undefined)).toBe(false);
  });
});
