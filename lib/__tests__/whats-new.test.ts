import { describe, expect, it } from "vitest";

import {
  isValidWhatsNewLink,
  mediaWarnings,
  singleFormErrors,
  singleMediaSize,
  singlePayload,
  whatsNewBadge,
  whatsNewDisplayName,
  whatsNewThumbnail,
  type SingleFormState,
} from "@/lib/whats-new";
import type { WhatsNew, WhatsNewMedia } from "@/types";

const STEP = {
  imageUrl: "https://cdn.test/step-1.png",
  title: "Euro cards are here",
  text: "Pay 0 fees.",
};

const popup = (over: Partial<WhatsNew>): WhatsNew => ({
  _id: "1",
  steps: [],
  isActive: false,
  showOnLoad: true,
  createdAt: "2026-11-04T00:00:00.000Z",
  updatedAt: "2026-11-04T00:00:00.000Z",
  ...over,
});

const IMAGE: WhatsNewMedia = {
  type: "image",
  url: "https://cdn.test/new.webp",
  width: 1080,
  height: 1350,
  alt: "Euro cards are here",
};

const VIDEO: WhatsNewMedia = {
  type: "video",
  url: "https://cdn.test/new.mp4",
  width: 1080,
  height: 1350,
  alt: "Swap in two taps",
  posterUrl: "https://cdn.test/new-poster.jpg",
  durationSec: 12.345,
  hasAudio: true,
};

const form = (over: Partial<SingleFormState> = {}): SingleFormState => ({
  name: "Swap v1",
  presentation: "popup",
  media: IMAGE,
  link: "",
  isActive: true,
  showOnLoad: true,
  ...over,
});

describe("What's New link", () => {
  it("takes an app route, an https link or nothing", () => {
    expect(isValidWhatsNewLink("/rewards")).toBe(true);
    expect(isValidWhatsNewLink("https://solid.xyz/post")).toBe(true);
    expect(isValidWhatsNewLink("")).toBe(true);
    expect(isValidWhatsNewLink("  ")).toBe(true);
  });

  it("refuses links the backend refuses", () => {
    for (const link of [
      "http://solid.xyz",
      "//evil.test",
      "/\\evil.test",
      "rewards",
      "javascript:alert(1)",
    ]) {
      expect(isValidWhatsNewLink(link)).toBe(false);
    }
  });
});

describe("What's New list", () => {
  it("labels each format", () => {
    expect(whatsNewBadge(popup({ steps: [STEP, STEP, STEP] }))).toBe(
      "Steps · 3"
    );
    expect(
      whatsNewBadge(
        popup({ format: "single", presentation: "popup", media: IMAGE })
      )
    ).toBe("Image · Popup");
    expect(
      whatsNewBadge(
        popup({ format: "single", presentation: "drawer", media: VIDEO })
      )
    ).toBe("Video · Drawer");
  });

  it("names old carousels after step 1", () => {
    expect(whatsNewDisplayName(popup({ steps: [STEP] }))).toBe(
      "Euro cards are here"
    );
    expect(
      whatsNewDisplayName(popup({ name: "Swap v1", format: "single" }))
    ).toBe("Swap v1");
    expect(whatsNewDisplayName(popup({}))).toBe("No title");
  });

  it("shows a video's poster, an image, or step 1's image", () => {
    expect(
      whatsNewThumbnail(popup({ format: "single", media: VIDEO }))
    ).toBe(VIDEO.posterUrl);
    expect(
      whatsNewThumbnail(popup({ format: "single", media: IMAGE }))
    ).toBe(IMAGE.url);
    expect(whatsNewThumbnail(popup({ steps: [STEP] }))).toBe(STEP.imageUrl);
  });
});

describe("media guidelines", () => {
  it("says nothing about media that follows them", () => {
    expect(
      mediaWarnings(
        { type: "image", width: 1080, height: 1350, sizeBytes: 400_000 },
        "drawer"
      )
    ).toEqual([]);
    expect(
      mediaWarnings(
        {
          type: "video",
          width: 1080,
          height: 1920,
          durationSec: 20,
          sizeBytes: 6_000_000,
        },
        "popup"
      )
    ).toEqual([]);
  });

  it("warns when the ratio doesn't suit how it shows", () => {
    // 9:16 is fine as a popup but too tall for a drawer.
    const tall = { type: "image" as const, width: 1080, height: 1920 };
    expect(mediaWarnings(tall, "popup")).toEqual([]);
    expect(mediaWarnings(tall, "drawer")).toHaveLength(1);
    // Landscape is outside both.
    const wide = { type: "image" as const, width: 1920, height: 1080 };
    expect(mediaWarnings(wide, "popup")[0]).toContain("short and wide");
  });

  it("warns about size, length and soft media without blocking", () => {
    const warnings = mediaWarnings(
      {
        type: "video",
        width: 720,
        height: 900,
        durationSec: 75,
        sizeBytes: 12 * 1024 * 1024,
      },
      "popup"
    );
    expect(warnings).toHaveLength(3);
    expect(
      mediaWarnings(
        { type: "image", width: 1080, height: 1350, sizeBytes: 2_000_000 },
        "popup"
      )
    ).toHaveLength(1);
  });
});

describe("single form", () => {
  it("is ready with a name, media, alt text and a valid link", () => {
    expect(singleFormErrors(form())).toEqual([]);
    expect(singleFormErrors(form({ media: VIDEO, link: "/swap" }))).toEqual(
      []
    );
  });

  it("lists what's missing", () => {
    expect(
      singleFormErrors(form({ name: " ", media: null, link: "swap" }))
    ).toEqual([
      "Add an internal name.",
      "Upload an image or a video.",
      "The link must start with / or https://",
    ]);
    expect(
      singleFormErrors(
        form({ media: { ...VIDEO, posterUrl: undefined, alt: " " } })
      )
    ).toEqual(["The video needs a poster.", "Add alt text."]);
  });

  it("sends an image without video-only fields", () => {
    expect(singlePayload(form({ name: " Euro ", link: " /card " }))).toEqual({
      format: "single",
      name: "Euro",
      presentation: "popup",
      media: IMAGE,
      link: "/card",
      isActive: true,
      showOnLoad: true,
    });
  });

  it("sends a video with its poster, rounded length and sound flag", () => {
    expect(
      singlePayload(form({ media: VIDEO, presentation: "drawer" })).media
    ).toEqual({ ...VIDEO, durationSec: 12.3 });
  });
});

describe("single media size", () => {
  const phone = { width: 390, height: 844 };

  it("leaves 16pt either side of a popup on a phone", () => {
    expect(singleMediaSize(phone, IMAGE, "popup")).toEqual({
      width: 358,
      height: 447.5,
    });
  });

  it("caps a popup at 440 wide on desktop", () => {
    const size = singleMediaSize({ width: 1280, height: 800 }, IMAGE, "popup");
    expect(size.width).toBe(440);
  });

  it("scales a tall popup down to 85% of the screen", () => {
    const size = singleMediaSize(
      phone,
      { width: 1080, height: 2400 },
      "popup"
    );
    expect(size.height).toBeCloseTo(844 * 0.85);
  });

  it("draws a drawer full width", () => {
    expect(singleMediaSize(phone, IMAGE, "drawer").width).toBe(390);
  });
});
