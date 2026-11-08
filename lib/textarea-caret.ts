/**
 * Where a character of a textarea sits on screen, measured with a hidden copy
 * of the textarea (same font, width, padding and wrapping). Coordinates are
 * relative to the textarea's border box, ignoring its scroll.
 */
const COPIED = [
  "direction",
  "box-sizing",
  "width",
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
  for (const property of COPIED) mirror.style.setProperty(property, computed.getPropertyValue(property));
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.overflow = "hidden";
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
