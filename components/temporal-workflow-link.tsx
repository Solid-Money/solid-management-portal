"use client";

import { Workflow } from "lucide-react";

import { CopyButton } from "@/components/ui/copy-button";
import { temporalWorkflowUrl } from "@/lib/temporal";
import { cn } from "@/lib/utils";

interface TemporalWorkflowLinkProps {
  workflowId?: string | null;
  className?: string;
}

/**
 * A Temporal workflow, as something you can act on: open it in the dashboard,
 * or copy the id.
 *
 * Both, because they answer different questions. The link goes straight to the
 * workflow's latest run — what you want when chasing one stuck deposit. The id
 * is what you want to paste into Temporal's search, into a Slack thread, or
 * into a `temporal workflow show` command.
 *
 * With no namespace configured there is nothing to link to, so it degrades to
 * a copyable id rather than an anchor that goes nowhere.
 *
 * A dash is a real answer, not a gap: most card deposits never touch Temporal
 * (the in-app borrow-and-deposit flow is one client-signed transaction, and
 * Rain's collateral webhook records its deposit inline), so the tooltip says so
 * rather than leaving support wondering whether the link is broken.
 */
export default function TemporalWorkflowLink({
  workflowId,
  className,
}: TemporalWorkflowLinkProps) {
  if (!workflowId) {
    return (
      <span
        className="text-gray-400"
        title="No Temporal workflow — this deposit was not processed by one"
      >
        —
      </span>
    );
  }

  const url = temporalWorkflowUrl(workflowId);

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline"
          title={`Open ${workflowId} in Temporal`}
        >
          <Workflow className="h-3 w-3" />
          Temporal
        </a>
      ) : (
        <span
          className="truncate font-mono text-[10px] text-gray-500"
          title={workflowId}
        >
          {workflowId.length > 22 ? `${workflowId.slice(0, 22)}…` : workflowId}
        </span>
      )}
      <CopyButton value={workflowId} label="Workflow ID" />
    </span>
  );
}
