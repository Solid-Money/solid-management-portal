import { describe, expect, it } from "vitest";

import { fixtureBytes, IMAGE_FIXTURES } from "@/lib/__tests__/fixtures/images";
import { detectImageType } from "@/lib/upload-limits";

/** Raw bytes, with strings written as UTF-8. */
const bytes = (...parts: (number[] | string | Uint8Array)[]): Uint8Array =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === "string"
        ? [...new TextEncoder().encode(part)]
        : Array.from(part)
    )
  );

const EXPECTED = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  webpLossy: "image/webp",
  avif: "image/avif",
} as const;

const names = Object.keys(IMAGE_FIXTURES) as (keyof typeof IMAGE_FIXTURES)[];

describe("detectImageType", () => {
  it.each(names)("accepts a real %s file", (name) => {
    expect(detectImageType(fixtureBytes(name))).toBe(EXPECTED[name]);
  });

  it.each(names)("refuses a %s file cut short", (name) => {
    const full = fixtureBytes(name);
    for (const keep of [4, 12, 16, Math.floor(full.length / 2), full.length - 1]) {
      expect(detectImageType(full.subarray(0, keep))).toBeNull();
    }
  });

  it("refuses a bare signature with no image behind it", () => {
    expect(detectImageType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
    expect(detectImageType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    expect(detectImageType(bytes("GIF89a", [2, 0, 2, 0, 0, 0, 0], [0x3b]))).toBeNull();
    expect(detectImageType(bytes("RIFF", [12, 0, 0, 0], "WEBP", "VP8L", [0, 0, 0, 0]))).toBeNull();
    // A PNG with its header chunk but no image data.
    const png = fixtureBytes("png");
    expect(detectImageType(bytes(png.subarray(0, 33), png.subarray(png.length - 12)))).toBeNull();
  });

  it("accepts AVIF padding boxes before meta", () => {
    const avif = fixtureBytes("avif");
    const ftypSize = new DataView(avif.buffer, avif.byteOffset).getUint32(0);
    const padded = bytes(
      avif.subarray(0, ftypSize),
      [0, 0, 0, 12],
      "free",
      [0, 0, 0, 0],
      [0, 0, 0, 8],
      "skip",
      avif.subarray(ftypSize)
    );
    expect(detectImageType(padded)).toBe("image/avif");
  });

  it("reads SVG past its prolog, internal doctype subset included", () => {
    expect(
      detectImageType(
        bytes(
          '﻿<?xml version="1.0"?>\n<!-- logo -->\n<!DOCTYPE svg>\n<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>\n'
        )
      )
    ).toBe("image/svg+xml");
    expect(
      detectImageType(
        bytes(
          '<!DOCTYPE svg [ <!ENTITY brand "Solid > all"> <!-- a ] b --> ]>\n<svg xmlns="http://www.w3.org/2000/svg">&brand;</svg>'
        )
      )
    ).toBe("image/svg+xml");
    expect(detectImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(
      "image/svg+xml"
    );
  });

  it("refuses anything else, whatever it claims to be", () => {
    expect(detectImageType(bytes("just some text"))).toBeNull();
    expect(detectImageType(bytes("<html><body><svg></svg></body></html>"))).toBeNull();
    expect(detectImageType(bytes("<!-- <svg> --><html><svg></svg></html>"))).toBeNull();
    expect(detectImageType(bytes("<!DOCTYPE svg [ <!ENTITY x 'y'> <svg>"))).toBeNull();
    expect(detectImageType(bytes([0, 0, 0, 0x18], "ftypmp42", [0, 0, 0, 0]))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});
