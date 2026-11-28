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

/** Image types a push can carry: phones don't render SVG in notifications. */
export const PUSH_IMAGE_TYPES = UPLOAD_IMAGE_TYPES.filter((t) => t !== "image/svg+xml");

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
      // Frame header: precision, height, width, components, then 3 bytes per
      // component. A width of 0 or no components is no image.
      const components = bytes[at + 9];
      const width = (bytes[at + 7] << 8) | bytes[at + 8];
      if (length < 8 || components < 1 || length !== 8 + 3 * components || width === 0) {
        return false;
      }
      sawFrame = true;
    }
    if (marker === 0xda) {
      if (!sawFrame) return false;
      // Scan header: component count, 2 bytes per component, then 3 bytes.
      const components = bytes[at + 4];
      if (length < 6 || components < 1 || length !== 6 + 2 * components) return false;
      // Walk the entropy-coded data forward to the first EOI, which ends the
      // image (bytes after it are tolerated). There must be data before it.
      // Inside the data, FF 00 is a stuffed byte and FF D0-D7 a restart;
      // other markers (e.g. a progressive JPEG's next DHT/SOS) are segments.
      let i = at + 2 + length;
      let sawData = false;
      while (i < bytes.length) {
        if (bytes[i] !== 0xff) {
          sawData = true;
          i += 1;
          continue;
        }
        if (i + 1 >= bytes.length) return false;
        const next = bytes[i + 1];
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          sawData = true;
          i += 2;
        } else if (next === 0xff) {
          i += 1; // fill byte
        } else if (next === 0xd9) {
          return sawData;
        } else {
          if (i + 4 > bytes.length) return false;
          const segment = (bytes[i + 2] << 8) | bytes[i + 3];
          if (segment < 2 || i + 2 + segment > bytes.length) return false;
          i += 2 + segment;
        }
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
 * WebP: a RIFF container no longer than the file, holding image data. A
 * simple file is one VP8 (lossy) or VP8L (lossless) chunk. An extended file
 * starts with VP8X and carries that chunk later, or ANMF frames that each
 * wrap one. Every image chunk must fit in the RIFF and start with its
 * bitstream header: the VP8 frame start code or the VP8L signature byte.
 */
function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return false;
  }
  const riffEnd = 8 + u32(bytes, 4, true);
  if (riffEnd < 20 || riffEnd > bytes.length) return false;

  /** Whether a VP8/VP8L chunk's data at `data` (of `size` bytes) is one. */
  const isBitstream = (type: string, data: number, size: number): boolean => {
    if (type === "VP8 ") {
      return (
        size >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a
      );
    }
    if (type === "VP8L") return size >= 5 && bytes[data] === 0x2f;
    return false;
  };
  /**
   * Walk the chunks from `from` to `end` (each padded to an even size) and
   * report whether an image chunk among them is valid; `frames` also looks
   * inside ANMF frames (whose data is a 16-byte header, then chunks).
   */
  const hasImage = (from: number, end: number, frames: boolean): boolean => {
    let at = from;
    let sawFrame = false;
    while (at + 8 <= end) {
      const type = ascii(bytes, at, 4);
      const size = u32(bytes, at + 4, true);
      const data = at + 8;
      if (data + size > end) return false;
      if (type === "VP8 " || type === "VP8L") return isBitstream(type, data, size);
      if (frames && type === "ANMF") {
        // Every frame must hold a valid image, not just the first.
        if (size < 24 || !hasImage(data + 16, data + size, false)) return false;
        sawFrame = true;
      }
      at = data + size + (size % 2);
    }
    return sawFrame;
  };

  const first = ascii(bytes, 12, 4);
  const firstSize = u32(bytes, 16, true);
  if (20 + firstSize > riffEnd) return false;
  if (first === "VP8 " || first === "VP8L") return isBitstream(first, 20, firstSize);
  if (first !== "VP8X" || firstSize !== 10) return false;
  return hasImage(30, riffEnd, true);
}

/**
 * AVIF (ISO BMFF): top-level boxes that exactly fill the file, starting with
 * an ftyp naming avif/avis, with a meta box and image data: a non-empty mdat,
 * or an idat inside meta. Padding boxes (free, skip) and others may sit
 * anywhere after ftyp.
 */
function isAvif(bytes: Uint8Array): boolean {
  /** The box at `at` (bounded by `end`): its type, header and total size. */
  const box = (at: number, end: number) => {
    if (at + 8 > end) return null;
    let size = u32(bytes, at);
    let header = 8;
    if (size === 1) {
      if (at + 16 > end) return null;
      size = u32(bytes, at + 8) * 2 ** 32 + u32(bytes, at + 12);
      header = 16;
    } else if (size === 0) {
      size = end - at; // runs to the end of its parent
    }
    if (size < header || at + size > end) return null;
    return { type: ascii(bytes, at + 4, 4), header, size };
  };

  let at = 0;
  let sawMeta = false;
  let sawData = false;
  while (at < bytes.length) {
    const b = box(at, bytes.length);
    if (!b) return false;
    if (at === 0) {
      if (b.type !== "ftyp" || b.size < 16) return false;
      const brands = [ascii(bytes, 8, 4)];
      for (let i = 16; i + 4 <= b.size; i += 4) brands.push(ascii(bytes, i, 4));
      if (!brands.some((brand) => brand === "avif" || brand === "avis")) return false;
    } else if (b.type === "meta") {
      sawMeta = true;
      // meta is a full box: 4 bytes of version and flags, then its children.
      const end = at + b.size;
      let child = at + b.header + 4;
      while (child < end) {
        const c = box(child, end);
        if (!c) return false;
        if (c.type === "idat" && c.size > c.header) sawData = true;
        child += c.size;
      }
    } else if (b.type === "mdat" && b.size > b.header) {
      sawData = true;
    }
    at += b.size;
  }
  return sawMeta && sawData;
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
