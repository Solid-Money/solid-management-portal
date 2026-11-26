import { describe, expect, it } from "vitest";

import { detectImageType } from "@/lib/upload-limits";

/** Raw bytes, with strings written as UTF-8. */
const bytes = (...parts: (number[] | string)[]): Uint8Array =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === "string" ? [...new TextEncoder().encode(part)] : part
    )
  );

describe("detectImageType", () => {
  it("reads the type from the file's header", () => {
    expect(detectImageType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      "image/png"
    );
    expect(detectImageType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(bytes("GIF89a", [1, 0]))).toBe("image/gif");
    expect(detectImageType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe("image/webp");
    expect(detectImageType(bytes([0, 0, 0, 0x1c], "ftypavif", [0, 0, 0, 0], "mif1miaf"))).toBe(
      "image/avif"
    );
    expect(
      detectImageType(bytes('﻿<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>'))
    ).toBe("image/svg+xml");
  });

  it("refuses anything else, whatever it claims to be", () => {
    expect(detectImageType(bytes("just some text"))).toBeNull();
    expect(detectImageType(bytes("<html><body>hi</body></html>"))).toBeNull();
    expect(detectImageType(bytes([0, 0, 0, 0x18], "ftypmp42", [0, 0, 0, 0]))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});
