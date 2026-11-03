"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { describeApiError } from "@/lib/api";
import { useFollowUpDraft, usePublishNotice } from "@/hooks/use-attention";
import type { AttentionItemView } from "@/types/radar";

const BUTTON = {
  post: "Publish app notice",
  update: "Publish update",
  resolve: "Mark fixed",
} as const;

/**
 * The item's app notice: the draft Solid AI wrote (editable, published with
 * one click), the notice live in the app, and the follow-up note once it is
 * over. Customers see this text, so it is plain words, says money is safe,
 * names no partner, and runs two lines at most; the server checks again.
 */
export function NoticePanel({ item }: { item: AttentionItemView }) {
  const draft =
    item.noticeDraft?.status === "pending" ? item.noticeDraft : null;
  const followUp = useFollowUpDraft();

  const resolvedIncident =
    item.status === "resolved" &&
    (item.level === "incident" || item.category === "incident");
  if (!draft && !item.notice && !resolvedIncident) return null;

  return (
    <div className="mt-4 rounded-lg border border-[#e6e8ee] bg-[#fafbfd] px-4 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
        App notice
      </p>

      {item.notice ? (
        <p className="mt-1.5 text-[12.5px] text-gray-600">
          {item.notice.resolvedAt ? "Marked fixed" : "Live in the app"}:{" "}
          <strong className="text-gray-900">{item.notice.title}</strong> —{" "}
          {item.notice.message}
          <span className="block text-[11.5px] text-gray-400">
            Published {item.notice.publishedAt.slice(11, 16)} UTC by{" "}
            {item.notice.publishedBy.split("@")[0]}
          </span>
        </p>
      ) : null}

      {draft ? (
        <DraftEditor
          key={`${draft.kind}:${draft.createdAt}`}
          item={item}
          draft={draft}
        />
      ) : null}

      {resolvedIncident ? (
        <div className="mt-2">
          <button
            type="button"
            disabled={followUp.isPending}
            onClick={() =>
              followUp.mutate(item.id, {
                onError: (e) => toast.error(describeApiError(e)),
              })
            }
            className="rounded-[7px] border border-[#e6e8ee] bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-800"
          >
            {followUp.data ? "Draft again" : "Post follow-up"}
          </button>
          {followUp.data ? (
            <div className="mt-2 rounded-md border border-[#e6e8ee] bg-white px-3 py-2 text-[12.5px] text-gray-700">
              <strong className="block text-gray-900">
                {followUp.data.title}
              </strong>
              {followUp.data.message}
              <span className="mt-1.5 flex gap-3 text-[12px]">
                <button
                  type="button"
                  className="text-[#3b3bd6] hover:underline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(
                        `${followUp.data!.title}\n\n${followUp.data!.message}`,
                      )
                      .then(() => toast.success("Copied"))
                  }
                >
                  Copy
                </button>
                <Link
                  href="/whats-new"
                  className="text-[#3b3bd6] hover:underline"
                >
                  Open What&apos;s New →
                </Link>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The pending draft, editable, and its one-click button. Keyed on the draft, so a new draft starts fresh. */
function DraftEditor({
  item,
  draft,
}: {
  item: AttentionItemView;
  draft: NonNullable<AttentionItemView["noticeDraft"]>;
}) {
  const [title, setTitle] = useState(draft.title);
  const [message, setMessage] = useState(draft.message);
  const publish = usePublishNotice();
  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-[12px] text-gray-500">
        {draft.source === "ai"
          ? `Drafted by Solid AI (${draft.model ?? "model unknown"})`
          : "From the template"}
        {" · "}customers will read this; edit it if needed.
      </p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        aria-label="Notice title"
        className="rounded-md border border-[#e6e8ee] bg-white px-3 py-1.5 text-[13px] font-medium"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={240}
        rows={2}
        aria-label="Notice message"
        className="rounded-md border border-[#e6e8ee] bg-white px-3 py-1.5 text-[13px]"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11.5px] text-gray-400">
          Plain words · says money is safe · no partner names · two lines
        </span>
        <button
          type="button"
          disabled={publish.isPending || !title.trim() || !message.trim()}
          onClick={() =>
            publish.mutate(
              {
                id: item.id,
                kind: draft.kind,
                title: title.trim(),
                message: message.trim(),
              },
              {
                onSuccess: () =>
                  toast.success(
                    draft.kind === "resolve"
                      ? "Marked fixed in the app"
                      : "Published in the app",
                  ),
                onError: (e) => toast.error(describeApiError(e)),
              },
            )
          }
          className="rounded-[7px] bg-[#dc2626] px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap text-white disabled:opacity-40"
        >
          {BUTTON[draft.kind]}
        </button>
      </div>
    </div>
  );
}
