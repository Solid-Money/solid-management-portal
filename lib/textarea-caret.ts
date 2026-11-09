/**
 * Where a character of a textarea sits on screen, measured with a hidden copy
 * of the textarea (same font, width, padding and wrapping). Coordinates are
 * relative to the textarea's border box, ignoring its scroll.
 */
const COPIED = [
  "direction",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-style",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-style",
  "font-variant",
  "font-weight",
  "font-stretch",
  "font-size",
  "line-height",
  "font-family",
  "text-align",
  "text-transform",
  "text-indent",
  "letter-spacing",
  "word-spacing",
  "tab-size",
];

export function caretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; height: number } {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  for (const property of COPIED)
    mirror.style.setProperty(property, computed.getPropertyValue(property));
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.overflow = "hidden";
  // The width text wraps in: the textarea's inner width, without a scrollbar
  // it may have (clientWidth leaves it out), plus its borders.
  const borders =
    (parseFloat(computed.borderLeftWidth) || 0) +
    (parseFloat(computed.borderRightWidth) || 0);
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${textarea.clientWidth + borders}px`;
  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement("span");
  // Something to measure even at the very end of the text.
  marker.textContent = textarea.value.slice(position) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const fontSize = parseFloat(computed.fontSize) || 14;
  const height = parseFloat(computed.lineHeight) || fontSize * 1.5;
  const coordinates = {
    top: marker.offsetTop + (parseFloat(computed.borderTopWidth) || 0),
    left: marker.offsetLeft + (parseFloat(computed.borderLeftWidth) || 0),
    height,
  };
  mirror.remove();
  return coordinates;
}

/**
 * The part of the window an element can be seen in: the window, cut down by
 * every ancestor that clips or scrolls (a drawer, a dialog body).
 */
export function visibleBounds(element: HTMLElement): {
  top: number;
  bottom: number;
} {
  let top = 0;
  let bottom = window.innerHeight;
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = window.getComputedStyle(node).overflowY;
    if (
      overflow === "auto" ||
      overflow === "scroll" ||
      overflow === "hidden" ||
      overflow === "clip"
    ) {
      const rect = node.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
  }
  return { top, bottom };
}
