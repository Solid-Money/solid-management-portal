/**
 * What `/api/upload` stores: shared by the route and the browser helper, so
 * neither drifts from the other. Kept apart from `lib/upload.ts`, which pulls
 * in the Firebase client the route must not load.
 */

/** Image types `/api/upload` stores. */
export const UPLOAD_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
];

/** Vercel caps a route body at about 4.5 MB; stay under it. */
export const UPLOAD_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/**
 * The image type `bytes` actually hold, read from the file's own header, or
 * null when it is none of {@link UPLOAD_IMAGE_TYPES}. The browser's declared
 * type only reflects the file name, so the route stores what this finds.
 */
export function detectImageType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(bytes, 0, 6))) {
    return "image/gif";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    // The major brand, then the compatible brands, up to the box's end.
    const boxSize =
      ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
    const end = Math.min(bytes.length, Math.max(boxSize, 16));
    const brands = [ascii(bytes, 8, 4)];
    for (let at = 16; at + 4 <= end; at += 4) brands.push(ascii(bytes, at, 4));
    if (brands.some((brand) => brand === "avif" || brand === "avis")) return "image/avif";
    return null;
  }
  // SVG is text: an XML prolog, comments or a doctype, then an <svg> root.
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 4096))
    .replace(/^﻿/, "")
    .trimStart();
  if (head.startsWith("<") && /<svg[\s>]/i.test(head)) return "image/svg+xml";
  return null;
}
