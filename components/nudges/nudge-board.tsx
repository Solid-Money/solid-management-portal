"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { EDGE_COLORS, NudgeFlowCanvas } from "@/components/nudges/nudge-flow-canvas";
import type { NudgeChannel } from "@/components/nudges/nudge-node";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { edgeDash, groupIntoSections, type NudgeSection } from "@/lib/nudges";
import { cn } from "@/lib/utils";
import {
  NUDGE_EDGE_KINDS,
  type NudgeBoard as NudgeBoardData,
  type NudgeEdgeKind,
} from "@/types/nudges";

const EDGE_LEGEND: Record<NudgeEdgeKind, string> = {
  then: "then (next step)",
  stops: "stops",
  replaces: "replaces",
  suppresses: "suppresses",
  excludes: "excludes",
};

interface NudgeBoardProps {
  board: NudgeBoardData;
  channel: NudgeChannel;
  onSelect: (key: string) => void;
}

/**
 * Every nudge as a graph, one collapsible section per group of linked nudges.
 * A section's canvas is only mounted while it is open: a dozen live React
 * Flow canvases at once would make the page crawl.
 */
export function NudgeBoard({ board, channel, onSelect }: NudgeBoardProps) {
  const [showArchived, setShowArchived] = useState(false);
  const nudges = useMemo(
    () =>
      showArchived
        ? board.nudges
        : board.nudges.filter((n) => n.status !== "archived"),
    [board.nudges, showArchived]
  );
  const sections = useMemo(
    () => groupIntoSections(nudges, board.catalog.flows),
    [nudges, board.catalog.flows]
  );
  const archivedCount = board.nudges.length - nudges.length;
  const channelCount = nudges.filter((n) =>
    channel === "push" ? n.push : n.email
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {nudges.length} nudges in {sections.length} section
          {sections.length === 1 ? "" : "s"} · {channelCount} with{" "}
          {channel === "push" ? "a push" : "an email"}. Click a nudge to open
          it.
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="nudges-show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          <Label htmlFor="nudges-show-archived" className="text-sm text-gray-600">
            Show archived
            {!showArchived && archivedCount > 0 ? ` (${archivedCount})` : ""}
          </Label>
        </div>
      </div>

      <EdgeLegend />

      {sections.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No nudges to show.
        </p>
      ) : (
        sections.map((section) => (
          <NudgeSectionPanel
            key={section.id}
            section={section}
            defaultOpen={sections.length === 1}
            board={board}
            nudges={nudges}
            channel={channel}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

function NudgeSectionPanel({
  section,
  defaultOpen,
  board,
  nudges,
  channel,
  onSelect,
}: {
  section: NudgeSection;
  defaultOpen: boolean;
  board: NudgeBoardData;
  nudges: NudgeBoardData["nudges"];
  channel: NudgeChannel;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-gray-200 bg-white"
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-gray-400 transition-transform",
              open && "rotate-90"
            )}
          />
          <span className="truncate font-medium text-gray-900">
            {section.title}
          </span>
          <span className="shrink-0 text-xs text-gray-500">
            {section.keys.length} nudge{section.keys.length === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {section.counts.live ? (
            <Badge variant="success">{section.counts.live} live</Badge>
          ) : null}
          {section.counts.paused ? (
            <Badge variant="warning">{section.counts.paused} paused</Badge>
          ) : null}
          {section.counts.draft ? (
            <Badge variant="info">{section.counts.draft} draft</Badge>
          ) : null}
          {section.counts.archived ? (
            <Badge variant="muted">{section.counts.archived} archived</Badge>
          ) : null}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        {open ? (
          <NudgeFlowCanvas
            nudges={nudges}
            keys={section.keys}
            standalone={section.standalone}
            channel={channel}
            collapsedAt={board.catalog.limits.pushBodyCollapsed}
            onSelect={onSelect}
          />
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function EdgeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
      {NUDGE_EDGE_KINDS.map((kind) => (
        <span key={kind} className="flex items-center gap-1.5">
          <svg width="28" height="8" aria-hidden>
            <line
              x1="0"
              y1="4"
              x2="28"
              y2="4"
              stroke={EDGE_COLORS[kind]}
              strokeWidth="2"
              strokeDasharray={edgeDash(kind)}
            />
          </svg>
          {EDGE_LEGEND[kind]}
        </span>
      ))}
    </div>
  );
}
