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

const u32 = (bytes: Uint8Array, at: number, littleEndian = false): number =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    at,
    littleEndian
  );

/** PNG: the signature, then an IHDR chunk of 13 bytes, as every PNG starts. */
function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 33 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a &&
    u32(bytes, 8) === 13 &&
    ascii(bytes, 12, 4) === "IHDR"
  );
}

/** JPEG: SOI, then another marker segment (APPn, DQT, SOF…). */
function isJpeg(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[3] >= 0xc0 &&
    bytes[3] !== 0xff
  );
}

/** GIF: header, the 7-byte screen descriptor, and the closing trailer. */
function isGif(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 14 &&
    /^GIF8[79]a$/.test(ascii(bytes, 0, 6)) &&
    bytes[bytes.length - 1] === 0x3b
  );
}

/** WebP: a RIFF container no longer than the file, holding a VP8 chunk. */
function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 20 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP" &&
    u32(bytes, 4, true) + 8 <= bytes.length &&
    ["VP8 ", "VP8L", "VP8X"].includes(ascii(bytes, 12, 4))
  );
}

/** AVIF: an ftyp box naming avif/avis, followed by a meta box. */
function isAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 24 || ascii(bytes, 4, 4) !== "ftyp") return false;
  const boxSize = u32(bytes, 0);
  if (boxSize < 16 || boxSize + 8 > bytes.length) return false;
  const brands = [ascii(bytes, 8, 4)];
  for (let at = 16; at + 4 <= boxSize; at += 4) brands.push(ascii(bytes, at, 4));
  if (!brands.some((brand) => brand === "avif" || brand === "avis")) return false;
  return ascii(bytes, boxSize + 4, 4) === "meta";
}

/**
 * SVG: text whose root element is <svg>. Before it only an XML declaration,
 * processing instructions, comments, a doctype and whitespace may appear.
 */
function isSvg(bytes: Uint8Array): boolean {
  let text = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 64 * 1024))
    .replace(/^\uFEFF/, "");
  for (;;) {
    text = text.trimStart();
    if (text.startsWith("<?")) {
      const end = text.indexOf("?>");
      if (end < 0) return false;
      text = text.slice(end + 2);
    } else if (text.startsWith("<!--")) {
      const end = text.indexOf("-->");
      if (end < 0) return false;
      text = text.slice(end + 3);
    } else if (/^<!DOCTYPE/i.test(text)) {
      const end = text.indexOf(">");
      if (end < 0) return false;
      text = text.slice(end + 1);
    } else {
      break;
    }
  }
  return /^<svg[\s>/]/.test(text);
}

/**
 * The image type `bytes` actually hold, read from the file's own structure,
 * or null when it is none of {@link UPLOAD_IMAGE_TYPES}. The browser's
 * declared type only reflects the file name, so the route stores what this
 * finds. This checks each format's header and framing, not every pixel: the
 * route is admin-only, and a full decode would need an image library.
 */
export function detectImageType(bytes: Uint8Array): string | null {
  if (isPng(bytes)) return "image/png";
  if (isJpeg(bytes)) return "image/jpeg";
  if (isGif(bytes)) return "image/gif";
  if (isWebp(bytes)) return "image/webp";
  if (isAvif(bytes)) return "image/avif";
  if (isSvg(bytes)) return "image/svg+xml";
  return null;
}
