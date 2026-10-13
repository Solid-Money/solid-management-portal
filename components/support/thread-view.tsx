"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSupportConversation } from "@/hooks/use-support";
import { getSupportOlderMessages, markSupportRead } from "@/lib/support-api";
import CaseActions from "@/components/support/case-actions";
import Composer, { type ComposerHandle } from "@/components/support/composer";
import DraftCard from "@/components/support/draft-card";
import MessageBubble from "@/components/support/message-bubble";
import RedactDialog from "@/components/support/redact-dialog";
import {
  COMPLAINT_LABELS,
  StatusBadge,
  dateTime,
  intentLabel,
  languageName,
} from "@/components/support/support-format";
import type { SupportAgentMessage } from "@/types/support";

export default function ThreadView({
  conversationId,
  me,
  agents,
}: {
  conversationId: string;
  me: string;
  agents: string[];
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useSupportConversation(conversationId);
  const [older, setOlder] = useState<SupportAgentMessage[]>([]);
  const [olderMore, setOlderMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [redacting, setRedacting] = useState<{ message: SupportAgentMessage; mode: "message" | "text" } | null>(null);
  const composer = useRef<ComposerHandle>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lastSeen = useRef<number>(0);

  const messages = useMemo(() => {
    const latest = data?.messages ?? [];
    const seen = new Set(latest.map((m) => m.id));
    return [...older.filter((m) => !seen.has(m.id)), ...latest];
  }, [older, data?.messages]);

  const hasOlder = olderMore ?? data?.hasOlder ?? false;
  const casesById = useMemo(() => new Map((data?.cases ?? []).map((c) => [c.id, c])), [data?.cases]);
  const current = data?.currentCaseId ? casesById.get(data.currentCaseId) : undefined;
  const lastSeq = data?.messages.at(-1)?.seq ?? 0;

  // Scroll to the newest message when the thread opens or grows.
  useEffect(() => {
    if (lastSeq > lastSeen.current) {
      bottom.current?.scrollIntoView({ block: "end" });
      lastSeen.current = lastSeq;
    }
  }, [lastSeq]);

  // Opening the thread reads it, for every agent.
  useEffect(() => {
    if (!data || lastSeq <= data.conversation.lastReadSeqAgent) return;
    markSupportRead(conversationId, lastSeq)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["support", "queue"] });
      })
      .catch(() => undefined);
  }, [conversationId, data, lastSeq, queryClient]);

  const loadOlder = async () => {
    const first = messages[0]?.seq;
    if (!first) return;
    setLoadingOlder(true);
    try {
      const page = await getSupportOlderMessages(conversationId, first);
      setOlder((current) => [...page.messages, ...current]);
      setOlderMore(page.hasOlder);
    } finally {
      setLoadingOlder(false);
    }
  };

  if (isLoading) {
    return (
      <section className="flex items-center justify-center rounded-lg bg-white shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </section>
    );
  }
  if (isError || !data) {
    return (
      <section className="flex items-center justify-center rounded-lg bg-white p-6 text-sm text-red-600 shadow-sm">
        Could not load this conversation.
      </section>
    );
  }

  const { conversation } = data;
  const name = conversation.userLabel ?? (conversation.userId ? `User ${conversation.userId.slice(-6)}` : "Guest");
  const foreign = conversation.language && !conversation.language.startsWith("en");

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-white shadow-sm">
      <header className="space-y-2 border-b border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">{name}</h2>
          {conversation.userId && (
            <Link
              href={`/users/${conversation.userId}`}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
              User page <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {foreign && <Badge variant="outline">Writes in {languageName(conversation.language)}</Badge>}
          {current && (
            <>
              <span className="text-sm text-gray-400">·</span>
              <span className="text-sm text-gray-700">Case #{current.number}</span>
              <StatusBadge status={current.status} />
              {current.urgent && <Badge variant="danger">Urgent</Badge>}
              {current.complaint && (
                <Badge variant="danger">
                  {COMPLAINT_LABELS[current.complaint.type]} · notice {dateTime(current.complaint.noticeReceivedAt)}
                </Badge>
              )}
              {current.intent && <Badge variant="muted">{intentLabel(current.intent)}</Badge>}
            </>
          )}
        </div>
        {current?.escalation && current.status === "escalated" && (
          <p className={current.escalation.overdue ? "text-xs text-red-600" : "text-xs text-amber-700"}>
            Waiting on {current.escalation.target.replace(/_/g, " ")}: {current.escalation.reason}
            {current.escalation.externalRef ? ` (ref ${current.escalation.externalRef})` : ""} · follow up by{" "}
            {dateTime(current.escalation.followUpAt)}
          </p>
        )}
        {current?.snoozeUntil && current.status === "snoozed" && (
          <p className="text-xs text-gray-500">Snoozed until {dateTime(current.snoozeUntil)}</p>
        )}
        {current?.status === "snoozed" && !current.snoozeUntil && (
          <p className="text-xs text-gray-500">Snoozed until the customer replies</p>
        )}
        {current && <CaseActions supportCase={current} agents={agents} me={me} conversationId={conversationId} />}
      </header>

      {current?.handoffSummary && current.status !== "resolved" && (
        <div className="flex gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="whitespace-pre-wrap">
            <span className="font-semibold">Handoff summary: </span>
            {current.handoffSummary}
          </p>
        </div>
      )}
      {!data.translation.available && foreign && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
          <AlertTriangle className="h-3.5 w-3.5" /> Translation is not set up here: messages show as written.
        </div>
      )}

      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {hasOlder && (
          <div className="mb-2 flex justify-center">
            <Button variant="ghost" size="xs" onClick={() => void loadOlder()} disabled={loadingOlder}>
              {loadingOlder ? <Loader2 className="animate-spin" /> : null}
              Load earlier messages
            </Button>
          </div>
        )}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newCase = message.caseId && message.caseId !== previous?.caseId;
          const supportCase = message.caseId ? casesById.get(message.caseId) : undefined;
          return (
            <Fragment key={message.id}>
              {newCase && supportCase && (
                <div className="my-3 flex items-center gap-2 text-xs text-gray-400">
                  <span className="h-px flex-1 bg-gray-200" />
                  Case #{supportCase.number} · {dateTime(supportCase.createdAt)}
                  {supportCase.csat ? ` · rated ${supportCase.csat.score}/5` : ""}
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
              )}
              <MessageBubble message={message} onRedact={(m, mode) => setRedacting({ message: m, mode })} />
            </Fragment>
          );
        })}
        <div ref={bottom} />
      </div>

      {data.draft && (
        <DraftCard
          draft={data.draft}
          conversationId={conversationId}
          onEdit={(text, runId) => composer.current?.load(text, runId)}
        />
      )}

      <Composer
        key={conversationId}
        ref={composer}
        conversationId={conversationId}
        customerLanguage={conversation.language}
        translationAvailable={data.translation.available}
        agents={agents}
        me={me}
      />

      <RedactDialog
        key={redacting ? `${redacting.message.id}-${redacting.mode}` : "closed"}
        target={redacting}
        conversationId={conversationId}
        onClose={() => setRedacting(null)}
      />
    </section>
  );
}
