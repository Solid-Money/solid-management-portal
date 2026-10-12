"use client";

import { useState } from "react";
import { EyeOff, FileText, Languages, MoreHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { dateTime, languageName } from "@/components/support/support-format";
import type { SupportAgentMessage, SupportAttachment } from "@/types/support";

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Files open in a new tab from their short-lived signed link. */
function Attachments({ files, dark }: { files: SupportAttachment[]; dark: boolean }) {
  if (!files.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((file) =>
        file.status === "redacted" ? (
          <span key={file.key} className="text-xs italic opacity-70">
            File removed
          </span>
        ) : !file.url ? (
          <span key={file.key} className="text-xs italic opacity-70">
            {file.status === "pending" ? "Checking file…" : "File unavailable"}
          </span>
        ) : file.mime.startsWith("image/") ? (
          <a key={file.key} href={file.url} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived link to the support service */}
            <img
              src={file.url}
              alt={file.fileName ?? "Image from the customer"}
              className="max-h-48 max-w-[16rem] rounded-md border border-black/10 object-cover"
            />
          </a>
        ) : (
          <a
            key={file.key}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
              dark ? "border-white/30 text-white" : "border-gray-200 bg-white text-gray-700",
            )}
          >
            <FileText className="h-4 w-4" />
            <span className="max-w-[12rem] truncate">{file.fileName ?? "Document"}</span>
            <span className="opacity-70">{formatSize(file.size)}</span>
          </a>
        ),
      )}
    </div>
  );
}

export default function MessageBubble({
  message,
  onRedact,
}: {
  message: SupportAgentMessage;
  onRedact: (message: SupportAgentMessage, mode: "message" | "text") => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const type = message.author.type;

  // Timeline lines the service writes (assignments, snoozes, auto-resolve).
  if (type === "system") {
    return (
      <div className="my-2 text-center text-xs text-gray-400">
        {message.body} · {dateTime(message.createdAt)}
      </div>
    );
  }

  const internal = message.visibility === "internal";
  const fromCustomer = type === "user" || type === "guest";
  const fromAgent = type === "agent";
  const dark = fromAgent && !internal;
  // Agents read English: the translation when there is one, the original a click away.
  const hasTranslation = Boolean(message.english);
  const delivered = message.delivered;
  const text =
    message.redacted
      ? null
      : fromAgent && delivered && showOriginal
        ? delivered.text
        : hasTranslation && !showOriginal
          ? message.english
          : message.body;

  return (
    <div className={cn("group my-2 flex", fromAgent && !internal ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[78%] rounded-lg px-3 py-2 text-sm",
          internal && "w-full max-w-none border border-amber-200 bg-amber-50 text-amber-950",
          !internal && fromCustomer && "bg-gray-100 text-gray-900",
          !internal && type === "ai" && "border border-indigo-100 bg-indigo-50 text-gray-900",
          dark && "bg-indigo-600 text-white",
        )}
      >
        <div className={cn("mb-0.5 flex items-center gap-1.5 text-xs", dark ? "text-indigo-100" : "text-gray-500")}>
          {type === "ai" && <Sparkles className="h-3 w-3" />}
          <span className="font-medium">
            {internal ? `Note · ${message.author.name ?? "Agent"}` : (message.author.name ?? (fromCustomer ? "Customer" : "Agent"))}
          </span>
          <span>{dateTime(message.createdAt)}</span>
          {message.context && !internal && (
            <span className="rounded bg-black/5 px-1">from {message.context.kind.replace(/_/g, " ")}</span>
          )}
          {!message.redacted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={cn("ml-auto opacity-0 group-hover:opacity-100", dark && "text-white hover:bg-indigo-500")}
                  aria-label="Message actions"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onRedact(message, "text")}>
                  Mask words…
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-700"
                  onSelect={() => onRedact(message, "message")}
                >
                  Redact message…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {message.redacted ? (
          <p className="flex items-center gap-1.5 italic opacity-70">
            <EyeOff className="h-3.5 w-3.5" /> Removed by an agent
          </p>
        ) : (
          text && <p className="whitespace-pre-wrap break-words">{text}</p>
        )}
        <Attachments files={message.attachments} dark={dark} />
        {!message.redacted && (hasTranslation || (fromAgent && delivered)) && (
          <button
            type="button"
            onClick={() => setShowOriginal((value) => !value)}
            className={cn(
              "mt-1 flex items-center gap-1 text-xs underline-offset-2 hover:underline",
              dark ? "text-indigo-100" : "text-gray-500",
            )}
          >
            <Languages className="h-3 w-3" />
            {fromAgent && delivered
              ? showOriginal
                ? "Show what you wrote"
                : `Sent in ${languageName(delivered.lang) ?? "their language"}: show it`
              : showOriginal
                ? "Show English"
                : `Show original (${languageName(message.lang) ?? message.lang})`}
          </button>
        )}
      </div>
    </div>
  );
}
