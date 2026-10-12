"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Languages, Pencil, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runSupportCaseAction } from "@/lib/support-api";
import { intentLabel, languageName } from "@/components/support/support-format";
import type { SupportDraft } from "@/types/support";

/**
 * Solid AI's reply waiting for review (shadow mode, or an intent outside the
 * allowlist). Approve sends it as written; Edit loads the English into the
 * composer, where the agent's version goes out translated as usual.
 */
export default function DraftCard({
  draft,
  conversationId,
  onEdit,
}: {
  draft: SupportDraft;
  conversationId: string;
  onEdit: (text: string, runId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [showOriginal, setShowOriginal] = useState(false);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["support", "conversation", conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["support", "queue"] });
    void queryClient.invalidateQueries({ queryKey: ["support", "counts"] });
  };
  const approve = useMutation({
    mutationFn: () => runSupportCaseAction(draft.caseId, { action: "draft/approve" }),
    onSuccess: () => {
      toast.success("Sent Solid AI's reply");
      refresh();
    },
  });
  const discard = useMutation({
    mutationFn: () => runSupportCaseAction(draft.caseId, { action: "draft/discard", body: {} }),
    onSuccess: refresh,
  });

  const translated = Boolean(draft.english) && !(draft.lang ?? "en").startsWith("en");
  const shown = translated && !showOriginal ? draft.english! : draft.body;
  const busy = approve.isPending || discard.isPending;

  return (
    <div className="mx-3 my-2 rounded-lg border border-indigo-200 bg-white p-3 shadow-sm">
      <div className="mb-1.5 flex items-center gap-2 text-xs text-indigo-700">
        <Sparkles className="h-3.5 w-3.5" />
        <span className="font-semibold">Solid AI draft</span>
        <span className="text-gray-500">
          {intentLabel(draft.intent)}
          {draft.confidence !== null ? ` · ${Math.round(draft.confidence * 100)}% confident` : ""}
          {draft.mode === "shadow" ? " · shadow mode" : ""}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-gray-900">{shown}</p>
      {translated && (
        <button
          type="button"
          onClick={() => setShowOriginal((value) => !value)}
          className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:underline"
        >
          <Languages className="h-3 w-3" />
          {showOriginal ? "Show English" : `Show what the customer gets (${languageName(draft.lang)})`}
        </button>
      )}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => approve.mutate()} disabled={busy}>
          <Check /> Approve and send
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onEdit(draft.english ?? draft.body, draft.runId)}
        >
          <Pencil /> Edit
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => discard.mutate()}>
          <X /> Discard
        </Button>
      </div>
    </div>
  );
}
