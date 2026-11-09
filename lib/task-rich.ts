import DOMPurify from "dompurify";
import type { TaskAttachment, TaskBodyFormat } from "@/types/tasks";

/**
 * Rich task text is HTML from the editor, cleaned again by the server to a
 * small set: text sizes (h1–h3), bold, italic, underline, strikethrough,
 * code, quotes, lists, links, tables, @mentions and inline images that name
 * an attached image by its storage key (`data-key`, never a `src`). Plain
 * text, and what Solid AI and the radar write, stays `text`.
 */

const TAGS = [
  "p", "br", "h1", "h2", "h3", "strong", "em", "u", "s", "code", "pre",
  "blockquote", "ul", "ol", "li", "a", "hr", "table", "thead", "tbody",
  "tr", "th", "td", "img", "span",
];
const ATTRS = ["href", "target", "rel", "colspan", "rowspan", "data-key", "data-type", "data-id", "data-label", "alt", "start", "src"];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Plain text (with Solid AI's `**bold**` and `[label](link)`) as editor HTML,
 * so an old description opens in the editor looking as it did.
 */
export function textToHtml(text: string): string {
  if (!text.trim()) return "";
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const inline = escapeHtml(block)
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|\/)[^)\s]*)\)/g, '<a href="$2">$1</a>')
        .replace(/\n/g, "<br>");
      return `<p>${inline}</p>`;
    })
    .join("");
}

/** The editor's HTML for a body, whichever way it was written. */
export function bodyToHtml(body: string, format: TaskBodyFormat | undefined): string {
  return format === "html" ? body : textToHtml(body);
}

/** Signed links for inline images: by key, from the files attached to the same text. */
export function imageUrls(attachments: TaskAttachment[]): Map<string, string> {
  return new Map(
    attachments.flatMap((file) => (file.url && file.mime.startsWith("image/") ? [[file.key, file.url]] : [])),
  );
}

/** The keys of the images shown inside the text: not listed again as files. */
export function inlineKeys(html: string): Set<string> {
  return new Set([...html.matchAll(/data-key="([^"]+)"/g)].map((match) => match[1]!));
}

let hooked = false;

/**
 * The server already cleaned it; this is the second lock, in the browser.
 * Inline images get their signed link from the attachments (an image with a
 * key that isn't attached shows nothing), and links to other sites open in
 * a new tab.
 */
export function renderableHtml(html: string, urls: Map<string, string>): string {
  if (typeof window === "undefined") return "";
  if (!hooked) {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        const href = node.getAttribute("href") ?? "";
        if (/^(https?:|mailto:)/i.test(href)) {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        } else if (!href.startsWith("/") || /^\/[/\\]/.test(href)) {
          node.removeAttribute("href");
        }
      }
    });
    hooked = true;
  }
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TAGS,
    ALLOWED_ATTR: ATTRS,
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const img of Array.from(clean.querySelectorAll("img"))) {
    const url = urls.get(img.getAttribute("data-key") ?? "");
    if (url) {
      img.setAttribute("src", url);
      img.setAttribute("loading", "lazy");
    } else img.remove();
  }
  const box = document.createElement("div");
  box.appendChild(clean);
  return box.innerHTML;
}

/** The editor's HTML with links for its inline images, so they show while editing. */
export function withImageSources(html: string, urls: Map<string, string>): string {
  if (typeof window === "undefined" || !html.includes("data-key")) return html;
  const box = document.createElement("div");
  box.innerHTML = DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOW_DATA_ATTR: false });
  for (const img of Array.from(box.querySelectorAll("img"))) {
    const url = urls.get(img.getAttribute("data-key") ?? "");
    if (url) img.setAttribute("src", url);
  }
  return box.innerHTML;
}

/** Bytes as "820 KB" / "4.2 MB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
