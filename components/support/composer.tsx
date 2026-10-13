"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookText, Languages, Loader2, Send, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import { useSupportMacros } from "@/hooks/use-support";
import {
  newAgentMessageId,
  previewSupportTranslation,
  renderSupportMacro,
  sendSupportReply,
} from "@/lib/support-api";
import { cn } from "@/lib/utils";
import { agentShortName, languageName } from "@/components/support/support-format";

export interface ComposerHandle {
  /** Load text into the reply box (an AI draft to edit, say). */
  load: (text: string, draftRunId?: string) => void;
}

/**
 * Replies and internal notes. Agents write English; when the customer writes
 * another language the composer shows what they will receive, and the reply
 * goes out as exactly that text.
 *
 * Render it with `key={conversationId}`: each conversation starts clean.
 */
const Composer = forwardRef<
  ComposerHandle,
  {
    conversationId: string;
    customerLanguage: string | null;
    translationAvailable: boolean;
    agents: string[];
    me: string;
  }
>(function Composer({ conversationId, customerLanguage, translationAvailable, agents, me }, ref) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [draftRunId, setDraftRunId] = useState<string | undefined>();
  const [mentions, setMentions] = useState<string[]>([]);
  const [sendEnglish, setSendEnglish] = useState(false);
  // The server could not translate on send (the preview was stale or missing).
  const [sendRefused, setSendRefused] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { data: macros } = useSupportMacros();

  useImperativeHandle(ref, () => ({
    load: (value, runId) => {
      setMode("reply");
      setText(value);
      setDraftRunId(runId);
      textarea.current?.focus();
    },
  }));

  const needsTranslation =
    mode === "reply" && !!customerLanguage && !customerLanguage.startsWith("en");
  const settled = useDebounce(text.trim(), 700);
  const preview = useQuery({
    queryKey: ["support", "preview", conversationId, settled],
    queryFn: () => previewSupportTranslation(conversationId, settled),
    enabled: needsTranslation && translationAvailable && settled.length > 0,
    staleTime: Infinity,
    retry: false,
  });
  const previewMatches = preview.data?.text && settled === text.trim();
  const translationFailed =
    needsTranslation &&
    (!translationAvailable || Boolean(preview.data?.error) || preview.isError || sendRefused);

  const send = useMutation({
    mutationFn: () =>
      sendSupportReply(conversationId, {
        clientMessageId: newAgentMessageId(),
        body: text.trim(),
        ...(mode === "note"
          ? { internal: true, ...(mentions.length ? { mentions } : {}) }
          : {}),
        ...(mode === "reply" && previewMatches && preview.data?.token
          ? { translation: { text: preview.data.text!, lang: preview.data.lang, token: preview.data.token } }
          : {}),
        ...(mode === "reply" && sendEnglish ? { sendUntranslated: true } : {}),
        ...(mode === "reply" && draftRunId ? { draftRunId } : {}),
      }),
    onSuccess: () => {
      setText("");
      setDraftRunId(undefined);
      setMentions([]);
      setSendEnglish(false);
      setSendRefused(false);
      void queryClient.invalidateQueries({ queryKey: ["support", "conversation", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["support", "queue"] });
      void queryClient.invalidateQueries({ queryKey: ["support", "counts"] });
    },
    onError: (error) => {
      // A failed translation comes back as a 409: offer English instead.
      if (isAxiosError(error) && error.response?.status === 409 && mode === "reply") {
        setSendRefused(true);
      }
    },
  });

  const insertMacro = async (id: string) => {
    try {
      const { body } = await renderSupportMacro(id, conversationId);
      setText((current) => (current.trim() ? `${current.trimEnd()}\n\n${body}` : body));
      textarea.current?.focus();
    } catch {
      toast.error("Could not insert the saved reply");
    }
  };

  const canSend =
    text.trim().length > 0 &&
    !send.isPending &&
    (mode === "note" || !needsTranslation || sendEnglish || Boolean(previewMatches));

  return (
    <div className="border-t border-gray-200 p-3">
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode("reply")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium",
            mode === "reply" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          Reply
        </button>
        <button
          type="button"
          onClick={() => setMode("note")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium",
            mode === "note" ? "bg-amber-500 text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          <StickyNote className="h-3 w-3" /> Note
        </button>
        {draftRunId && mode === "reply" && (
          <span className="ml-2 text-xs text-indigo-600">Editing Solid AI&apos;s draft</span>
        )}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs">
                <BookText /> Saved replies
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
              {macros?.length ? (
                macros.map((macro) => (
                  <DropdownMenuItem key={macro.id} onSelect={() => void insertMacro(macro.id)}>
                    <span className="truncate">{macro.title}</span>
                    {macro.shortcut && (
                      <span className="ml-auto text-xs text-gray-400">/{macro.shortcut}</span>
                    )}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuLabel className="text-xs font-normal text-gray-500">
                  No saved replies yet. Add them in Support settings.
                </DropdownMenuLabel>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {mode === "note" && agents.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-gray-500">
          Notify on Slack:
          {agents
            .filter((email) => email !== me)
            .map((email) => (
              <button
                key={email}
                type="button"
                onClick={() =>
                  setMentions((current) =>
                    current.includes(email) ? current.filter((e) => e !== email) : [...current, email],
                  )
                }
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  mentions.includes(email)
                    ? "border-amber-500 bg-amber-100 text-amber-900"
                    : "border-gray-200 hover:bg-gray-50",
                )}
              >
                @{agentShortName(email)}
              </button>
            ))}
        </div>
      )}

      <Textarea
        ref={textarea}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSend) {
            event.preventDefault();
            send.mutate();
          }
        }}
        placeholder={
          mode === "note"
            ? "Internal note: only agents see this"
            : needsTranslation
              ? `Write in English; the customer receives ${languageName(customerLanguage)}`
              : "Write a reply"
        }
        rows={4}
        className={cn("resize-y text-sm", mode === "note" && "border-amber-300 bg-amber-50/40")}
      />

      {needsTranslation && text.trim() && (
        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
          <div className="mb-1 flex items-center gap-1 font-medium text-gray-600">
            <Languages className="h-3.5 w-3.5" />
            Customer will see ({languageName(customerLanguage)})
            {(preview.isFetching || settled !== text.trim()) && !translationFailed && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
          </div>
          {translationFailed ? (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {translationAvailable
                  ? `Translation failed${preview.data?.error ? ` (${preview.data.error})` : ""}.`
                  : "Translation is not set up on this environment."}
              </p>
              <label className="flex items-center gap-1.5 text-gray-700">
                <input
                  type="checkbox"
                  checked={sendEnglish}
                  onChange={(event) => setSendEnglish(event.target.checked)}
                />
                Send it in English instead
              </label>
            </div>
          ) : previewMatches ? (
            <p className="whitespace-pre-wrap text-gray-800">{preview.data!.text}</p>
          ) : (
            <p className="text-gray-400">Translating…</p>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">⌘/Ctrl + Enter to send</span>
        <Button
          size="sm"
          onClick={() => send.mutate()}
          disabled={!canSend}
          className={cn(mode === "note" && "bg-amber-500 hover:bg-amber-600")}
        >
          {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          {mode === "note" ? "Add note" : "Send"}
        </Button>
      </div>
    </div>
  );
});

export default Composer;
