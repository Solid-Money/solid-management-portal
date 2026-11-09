"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, mergeAttributes, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import { Placeholder } from "@tiptap/extensions";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import {
  AtSign,
  Bold,
  ChevronDown,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  Quote,
  Strikethrough,
  Table2,
  Underline,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { uploadTaskFile } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import { Avatar, BotAvatar, personName } from "@/components/tasks/task-format";
import { CLAUDE_MENTION_ID, bodyToHtml, fileSize, imageUrls, withImageSources } from "@/lib/task-rich";
import { visibleBounds } from "@/lib/textarea-caret";
import type { TaskAttachment, TaskBodyFormat, TaskBodyInput, TaskPerson, TaskUpload } from "@/types/tasks";

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
/** The @mention list: w-72, and six rows at most. */
const MENTION_LIST_WIDTH = 288;
const MENTION_LIST_HEIGHT = 6 * 38 + 8;

interface PendingFile {
  localId: string;
  name: string;
  size: number;
  upload: TaskUpload | null;
  failed: boolean;
}

export interface ComposerValue {
  body: string;
  format: TaskBodyFormat;
  mentions: string[];
  attachmentIds: string[];
  /** A file is still uploading: hold the send. */
  uploading: boolean;
}

/** An image in the text names its file by storage key; the link is only for showing it. */
const TaskImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      key: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-key"),
        renderHTML: (attributes) => (attributes.key ? { "data-key": attributes.key } : {}),
      },
    };
  },
});

/** Pasted pictures from other sites can't be kept (only uploaded ones): leave them out. */
function withoutForeignImages(html: string): string {
  return html.replace(/<img\b(?![^>]*\bdata-key=)[^>]*>/gi, "");
}

/**
 * Excel, Word and Sheets put a picture of the selection on the clipboard
 * next to its HTML. When the HTML still has text or a table once foreign
 * images are gone, that is what was copied, not the picture.
 */
function hasRichContent(html: string): boolean {
  if (!html.trim() || typeof DOMParser === "undefined") return false;
  const doc = new DOMParser().parseFromString(withoutForeignImages(html), "text/html");
  return Boolean(doc.body.textContent?.trim() || doc.body.querySelector("table, img"));
}

/** The people mentioned in the text, by email. */
function mentionedIn(editor: Editor): string[] {
  const found = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === "mention" && typeof node.attrs.id === "string") found.add(node.attrs.id);
  });
  // Claude isn't a person: tagging it asks, nobody is emailed.
  found.delete(CLAUDE_MENTION_ID);
  return [...found];
}

/** Claude, first in the @ list where it can be asked. */
const CLAUDE_ENTRY: TaskPerson = { email: CLAUDE_MENTION_ID, name: "Claude" };

function claudeMatches(needle: string): boolean {
  return !needle || "claude".startsWith(needle) || "ai".startsWith(needle);
}

/** The keys of the images still in the text. */
function imagesIn(editor: Editor): Set<string> {
  const keys = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === "image" && typeof node.attrs.key === "string") keys.add(node.attrs.key);
  });
  return keys;
}

type MentionState = SuggestionProps<TaskPerson, { id: string; label: string }>;

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the text's selection: the click acts on it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800",
      )}
    >
      {children}
    </button>
  );
}

const SIZES = [
  { label: "Normal text", level: 0, className: "text-sm" },
  { label: "Large", level: 3, className: "text-base font-semibold" },
  { label: "Larger", level: 2, className: "text-lg font-semibold" },
  { label: "Huge", level: 1, className: "text-xl font-bold" },
] as const;

function Toolbar({
  editor,
  allowAttachments,
  onImage,
  onFile,
}: {
  editor: Editor;
  allowAttachments: boolean;
  onImage: () => void;
  onFile: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      level: SIZES.find((size) => size.level && e.isActive("heading", { level: size.level }))?.level ?? 0,
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      table: e.isActive("table"),
    }),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const chain = () => editor.chain().focus();
  const size = SIZES.find((s) => s.level === state.level) ?? SIZES[0];

  const applyLink = () => {
    const value = href.trim();
    if (!value) chain().extendMarkRange("link").unsetLink().run();
    else {
      const url = /^(https?:\/\/|mailto:|\/)/i.test(value) ? value : `https://${value}`;
      chain().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 px-1.5 py-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded px-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
            aria-label="Text size"
          >
            {size.label}
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40" onCloseAutoFocus={(event) => event.preventDefault()}>
          {SIZES.map((option) => (
            <DropdownMenuItem
              key={option.level}
              onSelect={() =>
                option.level
                  ? chain().setHeading({ level: option.level }).run()
                  : chain().setParagraph().run()
              }
              className={option.className}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <ToolButton label="Bold (⌘B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold className="size-3.5" />
      </ToolButton>
      <ToolButton label="Italic (⌘I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic className="size-3.5" />
      </ToolButton>
      <ToolButton label="Underline (⌘U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline className="size-3.5" />
      </ToolButton>
      <ToolButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="size-3.5" />
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <ToolButton label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List className="size-3.5" />
      </ToolButton>
      <ToolButton label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="size-3.5" />
      </ToolButton>
      <ToolButton label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote className="size-3.5" />
      </ToolButton>
      <Popover
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open);
          if (open) setHref(state.href);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Link"
            aria-label="Link"
            aria-pressed={state.link}
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              "inline-flex size-7 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900",
              state.link && "bg-indigo-50 text-indigo-700",
            )}
          >
            <Link2 className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2" onOpenAutoFocus={(event) => event.preventDefault()}>
          <form
            className="flex gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <input
              autoFocus
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="Paste a link"
              className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 px-2 text-sm outline-none focus:border-indigo-400"
            />
            <Button type="submit" size="sm" className="h-8 bg-indigo-600 text-white hover:bg-indigo-700">
              {href.trim() ? "Save" : "Remove"}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Table"
            aria-label="Table"
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              "inline-flex size-7 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900",
              state.table && "bg-indigo-50 text-indigo-700",
            )}
          >
            <Table2 className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48" onCloseAutoFocus={(event) => event.preventDefault()}>
          <DropdownMenuItem onSelect={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            Insert a table
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!state.table} onSelect={() => chain().addRowAfter().run()}>
            Add a row
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!state.table} onSelect={() => chain().addColumnAfter().run()}>
            Add a column
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!state.table} onSelect={() => chain().deleteRow().run()}>
            Delete the row
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!state.table} onSelect={() => chain().deleteColumn().run()}>
            Delete the column
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={!state.table} onSelect={() => chain().deleteTable().run()}>
            Delete the table
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      {allowAttachments && (
        <>
          <ToolButton label="Image" onClick={onImage}>
            <ImagePlus className="size-3.5" />
          </ToolButton>
          <ToolButton label="Attach a file" onClick={onFile}>
            <Paperclip className="size-3.5" />
          </ToolButton>
        </>
      )}
      <ToolButton label="Mention someone" onClick={() => chain().insertContent(" @").run()}>
        <AtSign className="size-3.5" />
      </ToolButton>
    </div>
  );
}

/**
 * Rich text with @mentions, tables, inline images and files: updates,
 * replies, a task's description, a new task and Team feed posts. Text sizes,
 * bold, lists, links and tables from the toolbar (or pasted from monday,
 * Google Docs or Notion, tables included). Pasted or dropped images go into
 * the text; any other file is attached below it. Everything uploads straight
 * away, so sending is instant. ⌘/Ctrl+Enter sends.
 */
export default function TaskComposer({
  people,
  placeholder = "Write an update… @ to mention, paste an image or a table",
  submitLabel = "Post update",
  initial,
  allowAttachments = true,
  autoFocus = false,
  minRows = 3,
  hideSubmit = false,
  askClaude = false,
  onSubmit,
  onCancel,
  onChange,
  className,
}: {
  people: TaskPerson[];
  placeholder?: string;
  submitLabel?: string;
  /** What's there already (editing): its images come from `attachments`. */
  initial?: { body: string; format?: TaskBodyFormat; mentions: string[]; attachments?: TaskAttachment[] };
  allowAttachments?: boolean;
  autoFocus?: boolean;
  minRows?: number;
  /** For a form that sends the text with its own button (new task). */
  hideSubmit?: boolean;
  /** Offer @Claude in the @ list: it answers updates and replies on a task. */
  askClaude?: boolean;
  onSubmit?: (input: Required<TaskBodyInput>) => Promise<unknown>;
  onCancel?: () => void;
  onChange?: (value: ComposerValue) => void;
  className?: string;
}) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [images, setImages] = useState<Array<{ key: string; id: string }>>([]);
  const [imagesUploading, setImagesUploading] = useState(0);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [active, setActive] = useState(0);
  const [, setVersion] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const imagePicker = useRef<HTMLInputElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  // The editor's handlers read the latest props and state through these
  // refs; they're set after each commit (below), not during render.
  const peopleRef = useRef(people);
  const claudeRef = useRef(askClaude);
  const mentionKeys = useRef<(props: SuggestionKeyDownProps) => boolean>(() => false);
  const sendRef = useRef<() => void>(() => undefined);
  const cancelRef = useRef(onCancel);
  const addRef = useRef<(incoming: File[], inline: boolean) => void>(() => undefined);
  /** The @mention list is showing: Escape closes it, not the edit. */
  const listOpen = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
        codeBlock: false,
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        renderHTML: ({ options, node }) => [
          "span",
          mergeAttributes(
            { "data-type": "mention", "data-id": node.attrs.id, "data-label": node.attrs.label },
            options.HTMLAttributes,
          ),
          `@${node.attrs.label ?? node.attrs.id}`,
        ],
        suggestion: {
          items: ({ query }) => {
            const needle = query.toLowerCase();
            const list = peopleRef.current;
            const claude = claudeRef.current && claudeMatches(needle) ? [CLAUDE_ENTRY] : [];
            const others = list
              .filter((person) => {
                const name = personName(person.email, list).toLowerCase();
                return (
                  !needle ||
                  name.split(" ").some((part) => part.startsWith(needle)) ||
                  name.startsWith(needle) ||
                  person.email.startsWith(needle)
                );
              })
              .slice(0, 6);
            return [...claude, ...others];
          },
          command: ({ editor: e, range, props }) => {
            e.chain()
              .focus()
              .insertContentAt(range, [
                { type: "mention", attrs: props },
                { type: "text", text: " " },
              ])
              .run();
          },
          render: () => ({
            onStart: (props) => {
              setActive(0);
              setMention(props as unknown as MentionState);
            },
            onUpdate: (props) => setMention(props as unknown as MentionState),
            onKeyDown: (props) => mentionKeys.current(props),
            onExit: () => setMention(null),
          }),
        },
      }),
    ],
    content: initial
      ? withImageSources(bodyToHtml(initial.body, initial.format), imageUrls(initial.attachments ?? []))
      : "",
    editorProps: {
      attributes: {
        class: "task-rich max-w-none px-3 py-2.5 text-sm leading-relaxed text-gray-900 outline-none",
        style: `min-height: ${Math.max(2, minRows) * 1.6 + 1.25}rem`,
      },
      transformPastedHTML: withoutForeignImages,
      handlePaste: (_view, event) => {
        const pasted = Array.from(event.clipboardData?.files ?? []);
        if (!pasted.length || !allowAttachments) return false;
        if (hasRichContent(event.clipboardData?.getData("text/html") ?? "")) return false;
        event.preventDefault();
        addRef.current(pasted, true);
        return true;
      },
      handleDrop: (_view, event) => {
        const dropped = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (!dropped.length || !allowAttachments) return false;
        event.preventDefault();
        setDragging(false);
        addRef.current(dropped, true);
        return true;
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          sendRef.current();
          return true;
        }
        if (event.key === "Escape" && cancelRef.current && !listOpen.current) {
          event.preventDefault();
          event.stopPropagation();
          cancelRef.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: () => setVersion((v) => v + 1),
  });

  const uploading = imagesUploading > 0 || files.some((f) => !f.upload && !f.failed);
  const inlineNow = editor ? imagesIn(editor) : new Set<string>();
  const attachmentIds = [
    ...images.filter((image) => inlineNow.has(image.key)).map((image) => image.id),
    ...files.flatMap((f) => (f.upload ? [f.upload.id] : [])),
  ];
  const empty = !editor || (editor.isEmpty && !inlineNow.size);
  const html = editor && !empty ? editor.getHTML() : "";
  const mentions = editor ? mentionedIn(editor) : [];

  useEffect(() => {
    onChange?.({ body: html, format: "html", mentions, attachmentIds, uploading });
    // The arrays are derived each render; html and the counts say what changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, mentions.join(), attachmentIds.join(), uploading]);

  const addFiles = useCallback(
    (incoming: File[], inline: boolean) => {
      if (!allowAttachments || !incoming.length || !editor) return;
      const room = MAX_FILES - files.length - images.length;
      if (room <= 0) {
        toast.error(`Up to ${MAX_FILES} files per message`);
        return;
      }
      for (const file of incoming.slice(0, room)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name || "That file"} is over 20 MB`);
          continue;
        }
        if (inline && IMAGE_TYPES.includes(file.type)) {
          setImagesUploading((n) => n + 1);
          uploadTaskFile(file)
            .then((upload) => {
              if (!upload.url || !upload.mime.startsWith("image/")) throw new Error("not an image");
              setImages((current) => [...current, { key: upload.key, id: upload.id }]);
              editor
                .chain()
                .focus()
                .insertContent({ type: "image", attrs: { src: upload.url, alt: upload.fileName ?? "", key: upload.key } })
                .run();
            })
            .catch(() => toast.error(`${file.name || "The image"} couldn't be uploaded`))
            .finally(() => setImagesUploading((n) => n - 1));
          continue;
        }
        const localId = crypto.randomUUID();
        setFiles((current) => [
          ...current,
          { localId, name: file.name || "file", size: file.size, upload: null, failed: false },
        ]);
        uploadTaskFile(file)
          .then((upload) =>
            setFiles((current) => current.map((f) => (f.localId === localId ? { ...f, upload } : f))),
          )
          .catch(() =>
            setFiles((current) => current.map((f) => (f.localId === localId ? { ...f, failed: true } : f))),
          );
      }
    },
    [allowAttachments, editor, files.length, images.length],
  );

  const canSend = !empty || attachmentIds.length > 0;
  const send = async () => {
    if (!onSubmit || !canSend || uploading || sending || !editor) return;
    setSending(true);
    try {
      await onSubmit({ body: html, format: "html", mentions, attachmentIds });
      editor.commands.clearContent(true);
      setFiles([]);
      setImages([]);
    } catch {
      // The API layer shows the error; keep the text so nothing is lost.
    } finally {
      setSending(false);
    }
  };

  // The @mention list: arrows move, Enter or Tab picks, Escape closes.
  const mentionLabel = (person: TaskPerson) =>
    person.email === CLAUDE_MENTION_ID ? "Claude" : personName(person.email, people);
  const matches = mention?.items ?? [];
  const handleMentionKeys = ({ event }: SuggestionKeyDownProps) => {
    if (!mention || !matches.length) return false;
    if (event.key === "ArrowDown") {
      setActive((i) => (i + 1) % matches.length);
      return true;
    }
    if (event.key === "ArrowUp") {
      setActive((i) => (i - 1 + matches.length) % matches.length);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      const person = matches[Math.min(active, matches.length - 1)]!;
      mention.command({ id: person.email, label: mentionLabel(person) });
      return true;
    }
    if (event.key === "Escape") {
      setMention(null);
      return true;
    }
    return false;
  };

  // After each commit, so a render React throws away never reaches them.
  useLayoutEffect(() => {
    peopleRef.current = people;
    claudeRef.current = askClaude;
    cancelRef.current = onCancel;
    addRef.current = addFiles;
    sendRef.current = () => void send();
    listOpen.current = Boolean(mention && matches.length);
    mentionKeys.current = handleMentionKeys;
  });

  // Under the @, inside the composer; above it when the window has no room below.
  const listStyle = useMemo(() => {
    const rect = mention?.clientRect?.();
    const host = box.current;
    if (!rect || !host) return null;
    const frame = host.getBoundingClientRect();
    const width = Math.min(MENTION_LIST_WIDTH, frame.width - 16);
    const left = Math.max(8, Math.min(rect.left - frame.left - 12, frame.width - width - 8));
    const view = visibleBounds(host);
    const below = view.bottom - rect.bottom;
    if (below < MENTION_LIST_HEIGHT && rect.top - view.top > below)
      return { left, width, bottom: frame.bottom - rect.top + 4 };
    return { left, width, top: rect.bottom - frame.top + 4 };
  }, [mention]);

  return (
    <div
      ref={box}
      className={cn(
        "relative rounded-lg border border-gray-200 bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100",
        dragging && "border-indigo-400 bg-indigo-50/40",
        className,
      )}
      onDragOver={(event) => {
        if (!allowAttachments || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        // Dropped on the files row or toolbar, not in the text (the editor
        // handles those and marks the drop as handled).
        if (event.nativeEvent.defaultPrevented) return;
        if (!allowAttachments || !event.dataTransfer.files.length) return;
        event.preventDefault();
        setDragging(false);
        addFiles(Array.from(event.dataTransfer.files), false);
      }}
    >
      {editor && (
        <Toolbar
          editor={editor}
          allowAttachments={allowAttachments}
          onImage={() => imagePicker.current?.click()}
          onFile={() => filePicker.current?.click()}
        />
      )}
      <EditorContent editor={editor} />
      {!editor && <div className="px-3 py-2.5 text-sm text-gray-400">{placeholder}</div>}

      {mention && matches.length > 0 && listStyle && (
        <div
          className="absolute z-30 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={listStyle}
        >
          {matches.map((person, index) => (
            <button
              key={person.email}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                mention.command({ id: person.email, label: mentionLabel(person) });
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm",
                index === active ? "bg-indigo-50" : "hover:bg-gray-50",
              )}
            >
              {person.email === CLAUDE_MENTION_ID ? (
                <BotAvatar size={22} />
              ) : (
                <Avatar email={person.email} people={people} size={22} />
              )}
              <span className="min-w-0 max-w-[60%] shrink-0 truncate whitespace-nowrap font-medium text-gray-900">
                {mentionLabel(person)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-gray-400">
                {person.email === CLAUDE_MENTION_ID ? "AI · looks into this task" : person.email}
              </span>
            </button>
          ))}
        </div>
      )}

      {(files.length > 0 || imagesUploading > 0) && (
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {imagesUploading > 0 && (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-500">
              <Loader2 className="size-3.5 animate-spin text-indigo-600" /> Uploading image…
            </span>
          )}
          {files.map((file) => (
            <div
              key={file.localId}
              className={cn(
                "relative flex h-9 max-w-60 items-center gap-1.5 rounded-md border bg-gray-50 pl-2.5 pr-7 text-xs",
                file.failed ? "border-red-300 text-red-700" : "border-gray-200 text-gray-700",
              )}
            >
              {!file.upload && !file.failed ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-indigo-600" />
              ) : (
                <Paperclip className="size-3.5 shrink-0 text-gray-400" />
              )}
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-gray-400">{file.failed ? "failed" : fileSize(file.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFiles((current) => current.filter((f) => f.localId !== file.localId))}
                className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={imagePicker}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []), true);
          event.target.value = "";
        }}
      />
      <input
        ref={filePicker}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []), false);
          event.target.value = "";
        }}
      />

      {(!hideSubmit || onCancel) && (
        <div className="flex items-center gap-2 border-t border-gray-100 px-2 py-1.5">
          <span className="hidden text-[11px] text-gray-400 sm:inline">⌘↵ to send</span>
          <div className="ml-auto flex items-center gap-1.5">
            {onCancel && (
              <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {!hideSubmit && (
              <Button
                type="button"
                size="xs"
                className="bg-indigo-600 text-white hover:bg-indigo-700"
                disabled={!canSend || uploading || sending}
                onClick={() => void send()}
              >
                {(sending || uploading) && <Loader2 className="animate-spin" />}
                {submitLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
