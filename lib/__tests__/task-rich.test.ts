import { describe, expect, it } from "vitest";
import { bodyToHtml, fileSize, imageUrls, inlineKeys, textToHtml } from "@/lib/task-rich";

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
