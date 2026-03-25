"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import apiClient from "@/lib/api/client";

interface Node { id: string; label: string; type: string; x?: number; y?: number; vx?: number; vy?: number; phase?: string; }
interface Edge { source: string; target: string; relation: string; }

const typeColors: Record<string, string> = {
  document: "#3b82f6",
  keyword: "#10b981",
  bsdd_class: "#f59e0b",
};

export default function KnowledgeGraphPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    apiClient.get("/query/ai-data/knowledge-graph")
      .then(({ data }) => {
        // Initialize positions
        const n = data.nodes.map((node: Node, i: number) => ({
          ...node,
          x: 400 + (Math.random() - 0.5) * 600,
          y: 300 + (Math.random() - 0.5) * 400,
          vx: 0, vy: 0,
        }));
        setNodes(n);
        setEdges(data.edges);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Force-directed layout simulation
  useEffect(() => {
    if (nodes.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    let iteration = 0;
    const maxIterations = 300;

    const simulate = () => {
      if (iteration > maxIterations) {
        render();
        return;
      }

      // Forces
      const alpha = 1 - iteration / maxIterations;

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = (b.x || 0) - (a.x || 0);
          const dy = (b.y || 0) - (a.y || 0);
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 800 / (dist * dist) * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx = (a.vx || 0) - fx;
          a.vy = (a.vy || 0) - fy;
          b.vx = (b.vx || 0) + fx;
          b.vy = (b.vy || 0) + fy;
        }
      }

      // Attraction along edges
      edges.forEach((e) => {
        const source = nodeMap.get(e.source);
        const target = nodeMap.get(e.target);
        if (!source || !target) return;
        const dx = (target.x || 0) - (source.x || 0);
        const dy = (target.y || 0) - (source.y || 0);
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (dist - 80) * 0.01 * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx = (source.vx || 0) + fx;
        source.vy = (source.vy || 0) + fy;
        target.vx = (target.vx || 0) - fx;
        target.vy = (target.vy || 0) - fy;
      });

      // Center gravity
      nodes.forEach((n) => {
        n.vx = ((n.vx || 0) + (w / 2 - (n.x || 0)) * 0.001) * 0.9;
        n.vy = ((n.vy || 0) + (h / 2 - (n.y || 0)) * 0.001) * 0.9;
        n.x = Math.max(20, Math.min(w - 20, (n.x || 0) + (n.vx || 0)));
        n.y = Math.max(20, Math.min(h - 20, (n.y || 0) + (n.vy || 0)));
      });

      iteration++;
      render();
      animRef.current = requestAnimationFrame(simulate);
    };

    const render = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.scale(zoom, zoom);

      // Edges
      ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
      ctx.lineWidth = 0.5;
      edges.forEach((e) => {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) return;
        ctx.beginPath();
        ctx.moveTo((s.x || 0) / zoom, (s.y || 0) / zoom);
        ctx.lineTo((t.x || 0) / zoom, (t.y || 0) / zoom);
        ctx.stroke();
      });

      // Nodes
      nodes.forEach((n) => {
        const color = typeColors[n.type] || "#64748b";
        const r = n.type === "document" ? 8 : 5;
        const x = (n.x || 0) / zoom;
        const y = (n.y || 0) / zoom;

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = color + "30";
        ctx.fill();

        // Node
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        ctx.fillStyle = "#cbd5e1";
        ctx.font = n.type === "document" ? "bold 9px sans-serif" : "8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.label.substring(0, 15), x, y + r + 12);
      });

      ctx.restore();

      // Legend
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      let ly = 20;
      [
        { type: "document", label: L ? "문서" : "Document" },
        { type: "keyword", label: L ? "키워드" : "Keyword" },
        { type: "bsdd_class", label: "bSDD Class" },
      ].forEach(({ type, label }) => {
        ctx.fillStyle = typeColors[type];
        ctx.beginPath();
        ctx.arc(15, ly, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(label, 25, ly + 4);
        ly += 18;
      });

      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.fillText(`${nodes.length} nodes, ${edges.length} edges`, 10, h - 10);
    };

    simulate();
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, zoom, L]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/ai-lake" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> AI Data Lake
          </Link>
          <h1 className="text-2xl font-bold">{L ? "지식 그래프" : "Knowledge Graph"}</h1>
          <p className="text-sm text-muted-foreground">{nodes.length} {L ? "노드" : "nodes"}, {edges.length} {L ? "엣지" : "edges"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} className="p-2 border rounded-md hover:bg-slate-50"><ZoomOut className="h-4 w-4" /></button>
          <span className="text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="p-2 border rounded-md hover:bg-slate-50"><ZoomIn className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <canvas ref={canvasRef} width={900} height={500} className="w-full" />
      </div>
    </div>
  );
}
