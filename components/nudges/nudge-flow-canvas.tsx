"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import { Loader2 } from "lucide-react";

import "@xyflow/react/dist/style.css";

import {
  NudgeNode,
  type NudgeChannel,
  type NudgeFlowNode,
} from "@/components/nudges/nudge-node";
import {
  NUDGE_NODE_HEIGHT,
  boardEdges,
  edgeDash,
  edgeId,
  elkGraphInput,
} from "@/lib/nudges";
import type { NudgeEdgeKind, NudgeView } from "@/types/nudges";

const elk = new ELK();

const nodeTypes = { nudge: NudgeNode };

/** Frame everything, but never zoom a small group past life size. */
const FIT_VIEW = { padding: 0.15, maxZoom: 1 };

/** Edge colours by kind; the legend under the board uses the same ones. */
export const EDGE_COLORS: Record<NudgeEdgeKind, string> = {
  then: "#4f46e5",
  stops: "#dc2626",
  replaces: "#d97706",
  suppresses: "#6b7280",
  excludes: "#9333ea",
};

interface NudgeFlowCanvasProps {
  nudges: NudgeView[];
  keys: string[];
  standalone: boolean;
  channel: NudgeChannel;
  collapsedAt: number;
  onSelect: (key: string) => void;
}

/**
 * One linked group of nudges, laid out left to right by ELK and drawn by
 * React Flow: zoom, pan, drag, a minimap and fit-to-view. Dragged positions
 * stay until the group's nudges change; nothing about the layout is saved.
 */
export function NudgeFlowCanvas(props: NudgeFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({
  nudges,
  keys,
  standalone,
  channel,
  collapsedAt,
  onSelect,
}: NudgeFlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NudgeFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [laidOut, setLaidOut] = useState(false);
  const [layoutFailed, setLayoutFailed] = useState(false);
  const [fitPending, setFitPending] = useState(false);
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  const sectionNudges = useMemo(() => {
    const inSection = new Set(keys);
    return nudges.filter((n) => inSection.has(n.key));
  }, [nudges, keys]);

  // The layout only depends on which nudges and links there are, so editing
  // copy re-renders a node without moving anything the admin dragged.
  const shapeKey = useMemo(
    () =>
      JSON.stringify(
        sectionNudges.map((n) => [n.key, n.edges.map((e) => [e.to, e.kind])])
      ),
    [sectionNudges]
  );

  // What a node shows, as of the latest render. A layout finishes after an
  // await, by which time the copy may have changed: it reads this, not the
  // nudges it started with.
  const latestData = useRef({ sectionNudges, channel, collapsedAt });
  useEffect(() => {
    latestData.current = { sectionNudges, channel, collapsedAt };
  }, [sectionNudges, channel, collapsedAt]);

  useEffect(() => {
    let cancelled = false;
    const graph = elkGraphInput(sectionNudges, keys, standalone);
    /** Nodes at `positionOf`, each with its latest data. */
    const nodesAt = (
      positionOf: (key: string, index: number) => { x: number; y: number }
    ): NudgeFlowNode[] => {
      const latest = latestData.current;
      const byKey = new Map(latest.sectionNudges.map((n) => [n.key, n]));
      return sectionNudges.map((laidOut, index) => ({
        id: laidOut.key,
        type: "nudge" as const,
        position: positionOf(laidOut.key, index),
        data: {
          nudge: byKey.get(laidOut.key) ?? laidOut,
          channel: latest.channel,
          collapsedAt: latest.collapsedAt,
        },
      }));
    };
    const stacked = (index: number) => ({ x: 0, y: index * (NUDGE_NODE_HEIGHT + 40) });
    elk
      .layout(graph)
      .then((result) => {
        if (cancelled) return;
        const positions = new Map(
          (result.children ?? []).map((child) => [
            child.id,
            { x: child.x ?? 0, y: child.y ?? 0 },
          ])
        );
        setNodes(nodesAt((key, index) => positions.get(key) ?? stacked(index)));
        setLaidOut(true);
        setLayoutFailed(false);
        setFitPending(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLayoutFailed(true);
        setNodes(nodesAt((_, index) => stacked(index)));
        setLaidOut(true);
        setFitPending(true);
      });
    return () => {
      cancelled = true;
    };
    // Re-layout only when the group's shape changes (see shapeKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey, standalone]);

  // Once a fresh layout is on screen and measured, frame all of it.
  useEffect(() => {
    if (!fitPending || !nodesInitialized) return;
    setFitPending(false);
    void fitView(FIT_VIEW);
  }, [fitPending, nodesInitialized, fitView]);

  // New copy, status or channel: update the nodes in place, keep positions.
  useEffect(() => {
    const byKey = new Map(sectionNudges.map((n) => [n.key, n]));
    setNodes((current) =>
      current.map((node) => {
        const nudge = byKey.get(node.id);
        return nudge
          ? { ...node, data: { nudge, channel, collapsedAt } }
          : node;
      })
    );
  }, [sectionNudges, channel, collapsedAt, setNodes]);

  useEffect(() => {
    const seen = new Set<string>();
    setEdges(
      boardEdges(sectionNudges)
        .map((edge) => {
          const color = EDGE_COLORS[edge.kind];
          return {
            id: edgeId(edge.from, edge),
            source: edge.from,
            target: edge.to,
            label:
              edge.label ??
              (edge.kind === "suppresses" && edge.days
                ? `suppresses ${edge.days}d`
                : edge.kind === "then"
                  ? undefined
                  : edge.kind),
            labelStyle: { fontSize: 10, fill: "#374151" },
            labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
            type: "smoothstep",
            animated: false,
            style: {
              stroke: color,
              strokeWidth: 1.5,
              strokeDasharray: edgeDash(edge.kind),
            },
            markerEnd: { type: MarkerType.ArrowClosed, color },
          } satisfies Edge;
        })
        .filter((edge) => {
          if (seen.has(edge.id)) return false;
          seen.add(edge.id);
          return true;
        })
    );
  }, [sectionNudges, setEdges]);

  // Room for the group without dwarfing a small one; zoom and pan do the rest.
  const height = Math.min(
    720,
    Math.max(
      280,
      standalone
        ? 140 + Math.ceil(keys.length / 4) * 210
        : 200 + Math.ceil(keys.length / 3) * 140
    )
  );

  return (
    <div
      className="relative w-full rounded-md border border-gray-200 bg-gray-50"
      style={{ height }}
    >
      {!laidOut ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : null}
      {layoutFailed ? (
        <p className="absolute top-2 left-2 z-10 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Automatic layout failed; nudges are stacked. Drag them apart.
        </p>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelect(node.id)}
        nodesDraggable
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable
        fitView
        fitViewOptions={FIT_VIEW}
        minZoom={0.15}
        maxZoom={1.75}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        {keys.length > 3 ? (
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={2}
            nodeColor={(node) => {
              const status = (node as NudgeFlowNode).data?.nudge?.status;
              return status === "live"
                ? "#10b981"
                : status === "paused"
                  ? "#f59e0b"
                  : status === "draft"
                    ? "#6366f1"
                    : "#9ca3af";
            }}
          />
        ) : null}
      </ReactFlow>
    </div>
  );
}
