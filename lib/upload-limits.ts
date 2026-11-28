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

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * PNG: the signature, then chunks that each fit in the file: IHDR (13
 * bytes) first, at least one IDAT, and an empty IEND closing it.
 */
function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return false;
  let at = 8;
  let sawData = false;
  while (at + 12 <= bytes.length) {
    const length = u32(bytes, at);
    const type = ascii(bytes, at + 4, 4);
    const end = at + 12 + length;
    if (length > 0x7fffffff || end > bytes.length) return false;
    if (at === 8 && (type !== "IHDR" || length !== 13)) return false;
    if (type === "IDAT") sawData = true;
    if (type === "IEND") return sawData && length === 0;
    at = end;
  }
  return false;
}

/**
 * JPEG: SOI, then marker segments that each fit in the file, a frame header
 * (SOFn) before the first scan, and an EOI after the scan data.
 */
function isJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let at = 2;
  let sawFrame = false;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return false;
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2; // markers with no length
      continue;
    }
    if (marker === 0xd9) return false; // EOI before any scan
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    if (length < 2 || at + 2 + length > bytes.length) return false;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      sawFrame = true;
    }
    if (marker === 0xda) {
      if (!sawFrame) return false;
      // Entropy-coded data runs to the EOI (bytes after it are tolerated).
      for (let i = bytes.length - 2; i >= at + 2 + length; i--) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return true;
      }
      return false;
    }
    at += 2 + length;
  }
  return false;
}

/**
 * GIF: header and screen descriptor, its colour table, then extension and
 * image blocks whose sub-blocks fit in the file, at least one image, and
 * the trailer.
 */
function isGif(bytes: Uint8Array): boolean {
  if (bytes.length < 14 || !/^GIF8[79]a$/.test(ascii(bytes, 0, 6))) return false;
  const tableSize = (flags: number) => (flags & 0x80 ? 3 * (1 << ((flags & 7) + 1)) : 0);
  /** Past a run of sub-blocks starting at `from`, or -1 if it overruns. */
  const skipSubBlocks = (from: number): number => {
    let i = from;
    while (i < bytes.length) {
      const size = bytes[i];
      i += 1;
      if (size === 0) return i;
      i += size;
    }
    return -1;
  };
  let at = 13 + tableSize(bytes[10]);
  let images = 0;
  while (at < bytes.length) {
    const block = bytes[at];
    if (block === 0x3b) return images > 0;
    if (block === 0x21) {
      at = skipSubBlocks(at + 2);
    } else if (block === 0x2c) {
      if (at + 11 > bytes.length) return false;
      // Descriptor (10), local colour table, LZW code size (1), then data.
      at = skipSubBlocks(at + 10 + tableSize(bytes[at + 9]) + 1);
      images += 1;
    } else {
      return false;
    }
    if (at < 0) return false;
  }
  return false;
}

/**
 * WebP: a RIFF container no longer than the file, whose first chunk fits in
 * it and is a VP8 frame (start code), a VP8L stream (signature) or a VP8X
 * header followed by image data.
 */
function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return false;
  }
  const riffEnd = 8 + u32(bytes, 4, true);
  if (riffEnd < 20 || riffEnd > bytes.length) return false;
  const chunk = (at: number) => ({ type: ascii(bytes, at, 4), size: u32(bytes, at + 4, true) });
  const first = chunk(12);
  if (20 + first.size > riffEnd) return false;
  if (first.type === "VP8 ") {
    return first.size >= 10 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a;
  }
  if (first.type === "VP8L") return first.size >= 5 && bytes[20] === 0x2f;
  if (first.type !== "VP8X" || first.size !== 10) return false;
  // Extended: walk the chunks after VP8X (each padded to an even size).
  let at = 30;
  while (at + 8 <= riffEnd) {
    const { type, size } = chunk(at);
    if (at + 8 + size > riffEnd) return false;
    if (type === "VP8 " || type === "VP8L" || type === "ANMF") return true;
    at += 8 + size + (size % 2);
  }
  return false;
}

/**
 * AVIF (ISO BMFF): top-level boxes that exactly fill the file, starting with
 * an ftyp naming avif/avis and holding a meta box. Padding boxes (free,
 * skip) and others may sit anywhere after ftyp.
 */
function isAvif(bytes: Uint8Array): boolean {
  let at = 0;
  let sawMeta = false;
  while (at + 8 <= bytes.length) {
    let size = u32(bytes, at);
    const type = ascii(bytes, at + 4, 4);
    let header = 8;
    if (size === 1) {
      if (at + 16 > bytes.length) return false;
      size = u32(bytes, at + 8) * 2 ** 32 + u32(bytes, at + 12);
      header = 16;
    } else if (size === 0) {
      size = bytes.length - at; // runs to the end of the file
    }
    if (size < header || at + size > bytes.length) return false;
    if (at === 0) {
      if (type !== "ftyp" || size < 16) return false;
      const brands = [ascii(bytes, 8, 4)];
      for (let b = 16; b + 4 <= size; b += 4) brands.push(ascii(bytes, b, 4));
      if (!brands.some((brand) => brand === "avif" || brand === "avis")) return false;
    } else if (type === "meta") {
      sawMeta = true;
    }
    at += size;
  }
  return at === bytes.length && sawMeta;
}

/**
 * Where a `<!DOCTYPE …>` starting at 0 ends, or -1: the first `>` outside
 * quotes and outside an internal subset `[…]` (whose comments are skipped).
 * Entities are never resolved; this only finds the end.
 */
function doctypeEnd(text: string): number {
  let quote: string | null = null;
  let inSubset = false;
  for (let i = "<!DOCTYPE".length; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (inSubset && text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end < 0) return -1;
      i = end + 2;
    } else if (c === "[") {
      inSubset = true;
    } else if (c === "]") {
      inSubset = false;
    } else if (c === ">" && !inSubset) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * SVG: text whose root element is <svg>. Before it only an XML declaration,
 * processing instructions, comments, a doctype (with or without an internal
 * subset) and whitespace may appear.
 */
function isSvg(bytes: Uint8Array): boolean {
  let text = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 64 * 1024))
    .replace(/^\uFEFF/, "");
  for (;;) {
    text = text.trimStart();
    let end = -1;
    if (text.startsWith("<?")) {
      end = text.indexOf("?>");
      if (end >= 0) end += 2;
    } else if (text.startsWith("<!--")) {
      end = text.indexOf("-->");
      if (end >= 0) end += 3;
    } else if (/^<!DOCTYPE/i.test(text)) {
      end = doctypeEnd(text);
    } else {
      break;
    }
    if (end < 0) return false;
    text = text.slice(end);
  }
  return /^<svg[\s>/]/.test(text);
}

/**
 * The image type `bytes` actually hold, read from the file's own structure,
 * or null when it is none of {@link UPLOAD_IMAGE_TYPES}. The browser's
 * declared type only reflects the file name, so the route stores what this
 * finds. Each format's framing (chunks, segments, blocks, boxes) is walked
 * and bounds-checked to the end of the file, so a bare or truncated header is
 * refused; the compressed pixel data itself is not decoded.
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
