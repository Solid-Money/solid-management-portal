/** Edits the editor's toolbar makes: pure functions over the text and the selection. */

export interface TextEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Wrap the selection (or a placeholder) in `before` and `after`. */
export function wrapSelection(
  edit: TextEdit,
  before: string,
  after: string,
  placeholder: string,
): TextEdit {
  const { value, selectionStart: start, selectionEnd: end } = edit;
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  return {
    value: next,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + selected.length,
  };
}

/** Prefix every line the selection touches (`## `, `- `, `1. `, `> `). */
export function prefixLines(edit: TextEdit, prefix: string | ((index: number) => string)): TextEdit {
  const { value, selectionStart: start, selectionEnd: end } = edit;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const changed = lines
    .map((line, index) => {
      const add = typeof prefix === "function" ? prefix(index) : prefix;
      const stripped = line.replace(/^(#{1,6} |[-*+] |\d+\. |> )/, "");
      return add + stripped;
    })
    .join("\n");
  const next = value.slice(0, lineStart) + changed + value.slice(lineEnd);
  return { value: next, selectionStart: lineStart, selectionEnd: lineStart + changed.length };
}

/** Insert a block on its own lines at the cursor. */
export function insertBlock(edit: TextEdit, block: string): TextEdit {
  const { value, selectionStart: start, selectionEnd: end } = edit;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = after === "" || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const next = before + lead + block + trail + after;
  const cursor = before.length + lead.length + block.length;
  return { value: next, selectionStart: cursor, selectionEnd: cursor };
}

export const TABLE_TEMPLATE = "| Column | Column |\n| --- | --- |\n| Cell | Cell |";
