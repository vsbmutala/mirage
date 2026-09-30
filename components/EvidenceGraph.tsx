"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  BookOpen,
  Briefcase,
  FolderGit2,
  Globe,
  GraduationCap,
  Tags,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Evidence, EvidenceGraph as Graph, GraphNode } from "@/types/evidence";

const NODE_STYLE: Record<GraphNode["type"], { icon: typeof User; cls: string }> = {
  person: { icon: User, cls: "border-accent bg-accent-subtle text-accent" },
  university: { icon: GraduationCap, cls: "border-border bg-card" },
  organization: { icon: Briefcase, cls: "border-border bg-card" },
  publication: { icon: BookOpen, cls: "border-border bg-card" },
  github: { icon: FolderGit2, cls: "border-border bg-card" },
  orcid: { icon: BookOpen, cls: "border-border bg-card" },
  website: { icon: Globe, cls: "border-border bg-card" },
  topic: { icon: Tags, cls: "border-border bg-card" },
};

type FlowData = { node: GraphNode };
type FlowNode = Node<FlowData>;

function MpeerNode({ data, selected }: NodeProps<FlowNode>) {
  const style = NODE_STYLE[data.node.type];
  const Icon = style.icon;
  const isPerson = data.node.type === "person";
  return (
    <div
      className={cn(
        "flex max-w-55 items-center gap-2 rounded-lg border px-3 py-2 text-left shadow-sm transition-shadow",
        style.cls,
        isPerson && "font-semibold",
        selected && "ring-2 ring-accent"
      )}
    >
      {!isPerson && <Handle type="target" position={Position.Left} className="!bg-muted/50" />}
      <Icon className="h-4 w-4 shrink-0 text-muted" />
      <span className="truncate text-xs">{data.node.label}</span>
      {isPerson && <Handle type="source" position={Position.Right} className="!bg-accent" />}
    </div>
  );
}

const nodeTypes = { mpeer: MpeerNode };

interface Props {
  graph: Graph;
  evidence: Evidence[];
}

/** Simple deterministic layout: person on the left, targets in a column. */
export function EvidenceGraph({ graph, evidence }: Props) {
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const { nodes, edges } = useMemo(() => {
    const targets = graph.nodes.filter((n) => n.id !== "person");
    const mid = ((targets.length - 1) * 72) / 2;
    const nodes: FlowNode[] = graph.nodes.map((n) => {
      const idx = targets.findIndex((t) => t.id === n.id);
      const isPerson = n.id === "person";
      return {
        id: n.id,
        type: "mpeer",
        position: isPerson
          ? { x: 0, y: Math.max(0, mid) }
          : { x: 420, y: idx * 72 },
        data: { node: n },
      };
    });
    const edges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.relation.replace(/_/g, " "),
      labelStyle: { fontSize: 9, fill: "#5c6370" },
      labelBgStyle: { fill: "#fafafa", fillOpacity: 0.9 },
      style: { stroke: "#c6c9d1", strokeWidth: 1.2 },
      animated: false,
    }));
    return { nodes, edges };
  }, [graph]);

  const selectedEvidence = useMemo(() => {
    if (!selected?.evidenceIds?.length) return [];
    return evidence.filter((e) => selected.evidenceIds!.includes(e.id));
  }, [selected, evidence]);

  if (graph.nodes.length <= 1) {
    return (
      <p className="text-sm text-muted">
        Not enough evidence was collected to build a graph.
      </p>
    );
  }

  return (
    <div>
      <div className="h-105 w-full overflow-hidden rounded-lg border border-border bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, n) => setSelected((n.data as FlowData).node)}
          onPaneClick={() => setSelected(null)}
          nodesConnectable={false}
        >
          <Background gap={20} size={1} color="#e4e6eb" />
          <Controls showInteractive={false} className="!shadow-sm" />
        </ReactFlow>
      </div>

      {selected && (
        <div className="anim-fade-up mt-4 rounded-lg border border-border bg-card px-4 py-3.5">
          <p className="text-sm font-semibold text-foreground">
            {selected.label}
            <span className="ml-2 text-xs font-normal uppercase tracking-wide text-muted">
              {selected.type}
            </span>
          </p>
          {selected.url && (
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs font-medium text-accent hover:text-accent/80"
            >
              {selected.url}
            </a>
          )}
          {selectedEvidence.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {selectedEvidence.map((e) => (
                <li key={e.id} className="text-xs leading-5 text-muted">
                  {e.evidence_text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted">
              No linked evidence records for this node.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
