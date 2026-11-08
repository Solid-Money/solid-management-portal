"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadTaskFile } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import { Avatar, personName } from "@/components/tasks/task-format";
import { mentionQuery, mentionsInText } from "@/lib/task-format";
import { caretCoordinates } from "@/lib/textarea-caret";
import type { TaskBodyInput, TaskPerson, TaskUpload } from "@/types/tasks";

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/heic,application/pdf";
/** The @mention list: w-72, and six rows at most. */
const MENTION_LIST_WIDTH = 288;
const MENTION_LIST_HEIGHT = 6 * 38 + 8;

/** Where the @mention list opens, inside the composer box. */
type MentionAnchor = { left: number } & ({ top: number } | { bottom: number });

interface PendingFile {
  localId: string;
  name: string;
  preview: string | null;
  upload: TaskUpload | null;
  failed: boolean;
}

export interface ComposerValue {
  body: string;
  mentions: string[];
  attachmentIds: string[];
  /** An image is still uploading: hold the send. */
  uploading: boolean;
}

/**
 * Text with @mentions and pasted images: updates, replies, a task's
 * description and a new task. `@` opens a list of admins; picking one writes
 * `@Name` into the text and remembers who it was. Paste, drop or pick an
 * image and it uploads straight away, so sending is instant. ⌘/Ctrl+Enter
 * sends.
 */
export default function TaskComposer({
  people,
  placeholder = "Write an update… @ to mention, paste an image",
  submitLabel = "Post update",
  initial,
  allowAttachments = true,
  autoFocus = false,
  minRows = 3,
  hideSubmit = false,
  onSubmit,
  onCancel,
  onChange,
  className,
}: {
  people: TaskPerson[];
  placeholder?: string;
  submitLabel?: string;
  initial?: { body: string; mentions: string[] };
  allowAttachments?: boolean;
  autoFocus?: boolean;
  minRows?: number;
  /** For a form that sends the text with its own button (new task). */
  hideSubmit?: boolean;
  onSubmit?: (input: Required<TaskBodyInput>) => Promise<unknown>;
  onCancel?: () => void;
  onChange?: (value: ComposerValue) => void;
  className?: string;
}) {
  const [text, setText] = useState(initial?.body ?? "");
  const [picked, setPicked] = useState<string[]>(initial?.mentions ?? []);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState<{ text: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState<MentionAnchor | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  // Only mentions whose @Name is still in the text count.
  const mentions = useMemo(() => mentionsInText(text, picked, people), [picked, text, people]);
  const uploading = files.some((f) => !f.upload && !f.failed);
  const attachmentIds = files.flatMap((f) => (f.upload ? [f.upload.id] : []));

  useEffect(() => {
    onChange?.({ body: text, mentions, attachmentIds, uploading });
    // attachmentIds is derived from files; a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, mentions, files, uploading]);

  useEffect(() => {
    if (autoFocus) textarea.current?.focus();
  }, [autoFocus]);

  // Revoke object URLs when the composer goes away.
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const matches = useMemo(() => {
    if (!query) return [];
    const needle = query.text.toLowerCase();
    return people
      .filter((p) => {
        const name = personName(p.email, people).toLowerCase();
        return (
          !needle ||
          name.split(" ").some((part) => part.startsWith(needle)) ||
          name.startsWith(needle) ||
          p.email.startsWith(needle)
        );
      })
      .slice(0, 6);
  }, [query, people]);

  // Right under the line being typed on, at the @; above it when there is no
  // room below in the window.
  const placeList = (start: number): MentionAnchor | null => {
    const el = textarea.current;
    const box = el?.parentElement;
    if (!el || !box) return null;
    const caret = caretCoordinates(el, start);
    const lineTop = el.offsetTop + caret.top - el.scrollTop;
    const left = Math.max(
      8,
      Math.min(el.offsetLeft + caret.left - 12, box.clientWidth - MENTION_LIST_WIDTH - 8),
    );
    const boxTop = box.getBoundingClientRect().top;
    const roomBelow = window.innerHeight - (boxTop + lineTop + caret.height);
    const roomAbove = boxTop + lineTop;
    if (roomBelow < MENTION_LIST_HEIGHT && roomAbove > roomBelow)
      return { left, bottom: box.clientHeight - lineTop + 4 };
    return { left, top: lineTop + caret.height + 4 };
  };

  const readQuery = (value: string, caret: number) => {
    const next = mentionQuery(value, caret);
    setQuery(next);
    setAnchor(next ? placeList(next.start) : null);
    setActive(0);
  };

  const pick = (person: TaskPerson) => {
    if (!query) return;
    const el = textarea.current;
    const caret = el?.selectionStart ?? text.length;
    const name = personName(person.email, people);
    const next = `${text.slice(0, query.start)}@${name} ${text.slice(caret)}`;
    setText(next);
    setPicked((current) => (current.includes(person.email) ? current : [...current, person.email]));
    setQuery(null);
    const at = query.start + name.length + 2;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at, at);
    });
  };

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (!allowAttachments || !incoming.length) return;
      const room = MAX_FILES - files.length;
      if (room <= 0) {
        toast.error(`Up to ${MAX_FILES} files per message`);
        return;
      }
      for (const file of incoming.slice(0, room)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name || "That file"} is over 20 MB`);
          continue;
        }
        const localId = crypto.randomUUID();
        const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
        if (preview) previews.current.push(preview);
        setFiles((current) => [
          ...current,
          { localId, name: file.name || "image.png", preview, upload: null, failed: false },
        ]);
        uploadTaskFile(file)
          .then((upload) =>
            setFiles((current) => current.map((f) => (f.localId === localId ? { ...f, upload } : f))),
          )
          .catch(() =>
            setFiles((current) =>
              current.map((f) => (f.localId === localId ? { ...f, failed: true } : f)),
            ),
          );
      }
    },
    [allowAttachments, files.length],
  );

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(event.clipboardData.files);
    if (!pasted.length || !allowAttachments) return;
    event.preventDefault();
    addFiles(pasted);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!allowAttachments) return;
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const canSend = (text.trim().length > 0 || attachmentIds.length > 0) && !uploading && !sending;

  const send = async () => {
    if (!onSubmit || !canSend) return;
    setSending(true);
    try {
      await onSubmit({ body: text.trim(), mentions, attachmentIds });
      setText("");
      setPicked([]);
      setFiles([]);
    } catch {
      // The API layer shows the error; keep the text so nothing is lost.
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (query && matches.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((i) => (i + 1) % matches.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pick(matches[active]!);
        return;
      }
    }
    if (event.key === "Escape") {
      if (query) {
        event.preventDefault();
        event.stopPropagation();
        setQuery(null);
      } else if (onCancel) {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div
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
      onDrop={onDrop}
    >
      <textarea
        ref={textarea}
        value={text}
        rows={minRows}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value);
          readQuery(event.target.value, event.target.selectionStart);
        }}
        onClick={(event) => readQuery(text, event.currentTarget.selectionStart)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className="block w-full resize-y rounded-lg bg-transparent px-3 py-2.5 text-sm leading-relaxed text-gray-900 outline-none placeholder:text-gray-400"
      />

      {query && matches.length > 0 && (
        <div
          className="absolute z-30 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={anchor ?? { left: 12, top: "100%" }}
        >
          {matches.map((person, index) => (
            <button
              key={person.email}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                pick(person);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm",
                index === active ? "bg-indigo-50" : "hover:bg-gray-50",
              )}
            >
              <Avatar email={person.email} people={people} size={22} />
              <span className="min-w-0 max-w-[60%] shrink-0 truncate whitespace-nowrap font-medium text-gray-900">
                {personName(person.email, people)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{person.email}</span>
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {files.map((file) => (
            <div
              key={file.localId}
              className={cn(
                "relative flex h-16 items-center overflow-hidden rounded-md border bg-gray-50",
                file.failed ? "border-red-300" : "border-gray-200",
              )}
            >
              {file.preview ? (
                // A local preview (object URL): next/image cannot optimise it.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.preview} alt={file.name} className="h-16 w-auto max-w-40 object-cover" />
              ) : (
                <span className="max-w-40 truncate px-3 text-xs text-gray-600">{file.name}</span>
              )}
              {!file.upload && !file.failed && (
                <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                  <Loader2 className="size-4 animate-spin text-indigo-600" />
                </span>
              )}
              {file.failed && (
                <span className="absolute inset-x-0 bottom-0 bg-red-600 px-1 text-center text-[10px] font-medium text-white">
                  Upload failed
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFiles((current) => current.filter((f) => f.localId !== file.localId))}
                className="absolute right-0.5 top-0.5 cursor-pointer rounded-full bg-gray-900/70 p-0.5 text-white hover:bg-gray-900"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(allowAttachments || !hideSubmit || onCancel) && (
        <div className="flex items-center gap-2 border-t border-gray-100 px-2 py-1.5">
          {allowAttachments && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-gray-500"
                onClick={() => picker.current?.click()}
              >
                <ImagePlus /> Image
              </Button>
              <input
                ref={picker}
                type="file"
                accept={ACCEPT}
                multiple
                hidden
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </>
          )}
          <span className="hidden text-[11px] text-gray-400 sm:inline">
            {hideSubmit ? "@ to mention" : "⌘↵ to send"}
          </span>
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
                disabled={!canSend}
                onClick={() => void send()}
              >
                {sending && <Loader2 className="animate-spin" />}
                {submitLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
