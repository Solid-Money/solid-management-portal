import { describe, expect, it } from "vitest";

import { detectImageType } from "@/lib/upload-limits";

/** Raw bytes, with strings written as UTF-8. */
const bytes = (...parts: (number[] | string)[]): Uint8Array =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === "string" ? [...new TextEncoder().encode(part)] : part
    )
  );

const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u32le = (n: number) => u32be(n).reverse();

const png = bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], u32be(13), "IHDR", new Array(17).fill(0));
const jpeg = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16], "JFIF", [0, 0xff, 0xd9]);
const gif = bytes("GIF89a", [1, 0, 1, 0, 0, 0, 0], [0x2c, 0x3b]);
const webp = bytes("RIFF", u32le(12), "WEBP", "VP8L", [0, 0, 0, 0]);
const avif = bytes(u32be(20), "ftyp", "avif", [0, 0, 0, 0], "mif1", u32be(12), "meta", [0, 0, 0, 0]);

describe("detectImageType", () => {
  it("reads the type from the file's structure", () => {
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(jpeg)).toBe("image/jpeg");
    expect(detectImageType(gif)).toBe("image/gif");
    expect(detectImageType(webp)).toBe("image/webp");
    expect(detectImageType(avif)).toBe("image/avif");
    expect(
      detectImageType(
        bytes(
          '\uFEFF<?xml version="1.0"?>\n<!-- logo -->\n<!DOCTYPE svg>\n<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>\n'
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
    expect(detectImageType(bytes([0, 0, 0, 0x18], "ftypmp42", [0, 0, 0, 0]))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });

  it("refuses a bare signature with no image behind it", () => {
    expect(detectImageType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], "hello world, not a png"))).toBeNull();
    expect(detectImageType(bytes([0xff, 0xd8, 0xff]))).toBeNull();
    expect(detectImageType(bytes("GIF89a", "no trailer here"))).toBeNull();
    expect(detectImageType(bytes("RIFF", u32le(9999), "WEBP", "VP8L", [0, 0, 0, 0]))).toBeNull();
    expect(detectImageType(bytes(u32be(20), "ftyp", "avif", [0, 0, 0, 0], "mif1", "junkjunk"))).toBeNull();
  });
});
