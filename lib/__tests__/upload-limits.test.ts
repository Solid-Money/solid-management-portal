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
  jpegProgressive: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  webpLossy: "image/webp",
  webpAlpha: "image/webp",
  webpAnimated: "image/webp",
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

  it("refuses a JPEG with empty frame and scan headers or no scan data", () => {
    expect(
      detectImageType(bytes([0xff, 0xd8, 0xff, 0xc0, 0, 2, 0xff, 0xda, 0, 2, 0xff, 0xd9]))
    ).toBeNull();
    // A real frame and scan header, but the EOI follows the scan header at once.
    const jpeg = fixtureBytes("jpeg");
    let sos = 2;
    while (!(jpeg[sos] === 0xff && jpeg[sos + 1] === 0xda)) {
      sos += 2 + ((jpeg[sos + 2] << 8) | jpeg[sos + 3]);
    }
    const scanEnd = sos + 2 + ((jpeg[sos + 2] << 8) | jpeg[sos + 3]);
    expect(detectImageType(bytes(jpeg.subarray(0, scanEnd), [0xff, 0xd9]))).toBeNull();
    // The first EOI ends the image: a second one after it adds no scan data.
    expect(
      detectImageType(bytes(jpeg.subarray(0, scanEnd), [0xff, 0xd9, 0xff, 0xd9]))
    ).toBeNull();
    expect(
      detectImageType(bytes(jpeg.subarray(0, scanEnd), [0xff, 0xd9, 0x00, 0xff, 0xd9]))
    ).toBeNull();
    // A restart marker alone is not scan data.
    expect(
      detectImageType(bytes(jpeg.subarray(0, scanEnd), [0xff, 0xd0, 0xff, 0xd9]))
    ).toBeNull();
    // A valid JPEG with trailing bytes after its EOI is still accepted.
    expect(detectImageType(bytes(jpeg, [0, 0, 0, 0]))).toBe("image/jpeg");
  });

  it("refuses an AVIF with metadata but no image data", () => {
    const avif = fixtureBytes("avif");
    const view = new DataView(avif.buffer, avif.byteOffset);
    const ftyp = view.getUint32(0);
    const meta = view.getUint32(ftyp);
    expect(detectImageType(avif.subarray(0, ftyp + meta))).toBeNull();
    // The same, with the mdat kept but emptied.
    expect(
      detectImageType(bytes(avif.subarray(0, ftyp + meta), [0, 0, 0, 8], "mdat"))
    ).toBeNull();
  });

  it("refuses an extended WebP whose image chunk is empty or not a bitstream", () => {
    const vp8x = bytes("VP8X", [10, 0, 0, 0], new Array(10).fill(0));
    const riff = (body: Uint8Array) =>
      bytes("RIFF", [(body.length + 4) & 255, ((body.length + 4) >> 8) & 255, 0, 0], "WEBP", body);
    expect(detectImageType(riff(bytes(vp8x, "VP8L", [0, 0, 0, 0])))).toBeNull();
    expect(detectImageType(riff(bytes(vp8x, "VP8L", [6, 0, 0, 0], [0, 1, 2, 3, 4, 5])))).toBeNull();
    expect(detectImageType(riff(bytes(vp8x, "VP8L", [6, 0, 0, 0], [0x2f, 1, 2, 3, 4, 5])))).toBe(
      "image/webp"
    );
  });

  it("refuses an animated WebP whose later frame is malformed", () => {
    const anim = fixtureBytes("webpAnimated");
    const view = new DataView(anim.buffer, anim.byteOffset);
    // Find the second ANMF frame and corrupt the bitstream header of its image.
    let at = 12;
    const frames: number[] = [];
    while (at + 8 <= anim.length) {
      const type = String.fromCharCode(...anim.subarray(at, at + 4));
      const size = view.getUint32(at + 4, true);
      if (type === "ANMF") frames.push(at);
      at += 8 + size + (size % 2);
    }
    expect(frames.length).toBeGreaterThanOrEqual(2);
    const broken = new Uint8Array(anim);
    // ANMF data: 16-byte frame header, then the image chunk (8-byte header).
    const imageData = frames[1] + 8 + 16 + 8;
    broken[imageData] ^= 0xff;
    broken[imageData + 3] ^= 0xff;
    expect(detectImageType(anim)).toBe("image/webp");
    expect(detectImageType(broken)).toBeNull();
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
