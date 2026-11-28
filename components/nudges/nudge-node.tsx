"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Clock, Hammer, Lock, Mail, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NudgeStatus, NudgeView } from "@/types/nudges";

export type NudgeChannel = "push" | "email";

export type NudgeNodeData = {
  nudge: NudgeView;
  channel: NudgeChannel;
  /** Where a collapsed push body is cut. */
  collapsedAt: number;
};

export type NudgeFlowNode = Node<NudgeNodeData, "nudge">;

export const STATUS_VARIANT: Record<
  NudgeStatus,
  "success" | "warning" | "muted" | "info"
> = {
  live: "success",
  paused: "warning",
  draft: "info",
  archived: "muted",
};

/** One nudge on the canvas: what it is, when it fires and what it says. */
function NudgeNodeComponent({ data, selected }: NodeProps<NudgeFlowNode>) {
  const { nudge, channel, collapsedAt } = data;
  const push = nudge.push;
  const email = nudge.email;
  const hasChannel = channel === "push" ? !!push : !!email;
  const channelOff =
    hasChannel && (channel === "push" ? !push?.enabled : !email?.enabled);

  return (
    <div
      className={cn(
        "w-[280px] cursor-pointer rounded-lg border bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md",
        selected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200",
        !hasChannel && "opacity-50",
        nudge.status === "archived" && "opacity-60"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-gray-900">
            {!nudge.managed ? (
              <Lock className="h-3 w-3 shrink-0 text-gray-400" aria-label="Read-only" />
            ) : null}
            <span className="truncate">{nudge.name}</span>
          </p>
          <p className="truncate font-mono text-[10px] text-gray-400">{nudge.key}</p>
        </div>
        <Badge variant={STATUS_VARIANT[nudge.status]}>{nudge.status}</Badge>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Badge variant={nudge.category === "marketing" ? "info" : "muted"}>
          {nudge.category}
        </Badge>
        {!nudge.implemented ? (
          <Badge variant="warning">
            <Hammer />
            not built yet
          </Badge>
        ) : null}
        {channelOff ? <Badge variant="danger">{channel} off</Badge> : null}
      </div>

      <p className="mt-1.5 flex items-center gap-1 truncate text-[11px] text-gray-500">
        <Clock className="h-3 w-3 shrink-0" />
        <span className="truncate">{nudge.trigger.label}</span>
      </p>

      <div className="mt-2 rounded-md bg-gray-50 px-2 py-1.5 text-[11px] leading-snug">
        {channel === "push" ? (
          push ? (
            <>
              <p className="flex items-center gap-1 truncate font-medium text-gray-800">
                <Smartphone className="h-3 w-3 shrink-0 text-gray-400" />
                <span className="truncate">{push.title || "No title"}</span>
              </p>
              <p className="line-clamp-2 text-gray-600">
                {push.body.slice(0, collapsedAt)}
                {push.body.length > collapsedAt ? (
                  <span className="bg-amber-100 text-amber-800">
                    {push.body.slice(collapsedAt)}
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            <p className="text-gray-400">No push</p>
          )
        ) : email ? (
          <p className="flex items-center gap-1 text-gray-700">
            <Mail className="h-3 w-3 shrink-0 text-gray-400" />
            {email.templateId ? (
              <>Brevo template {email.templateId}</>
            ) : (
              <span className="text-amber-700">No Brevo template</span>
            )}
          </p>
        ) : (
          <p className="text-gray-400">No email</p>
        )}
      </div>

      {nudge.stats ? (
        <p className="mt-1.5 text-[10px] text-gray-500">
          30d: {nudge.stats.sent.toLocaleString("en-US")} sent ·{" "}
          {nudge.stats.skipped.toLocaleString("en-US")} skipped
          {nudge.stats.deferred
            ? ` · ${nudge.stats.deferred.toLocaleString("en-US")} deferred`
            : ""}
        </p>
      ) : null}
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </div>
  );
}

export const NudgeNode = memo(NudgeNodeComponent);
