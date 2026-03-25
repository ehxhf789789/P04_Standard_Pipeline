"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import apiClient from "@/lib/api/client";

export default function GNNPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    apiClient.get("/query/ai-data/knowledge-graph")
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Draw adjacency matrix
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    const nodes = data.nodes.slice(0, 30);
    const edges = data.edges;
    const n = nodes.length;
    if (n === 0) return;

    const cellSize = Math.min((w - 120) / n, (h - 120) / n, 20);
    const offsetX = 100, offsetY = 80;

    // Node index map
    const idxMap = new Map(nodes.map((nd: any, i: number) => [nd.id, i]));

    // Build adjacency matrix
    const adj = Array.from({ length: n }, () => new Array(n).fill(0));
    edges.forEach((e: any) => {
      const si = idxMap.get(e.source);
      const ti = idxMap.get(e.target);
      if (si !== undefined && ti !== undefined) {
        adj[si][ti] = 1;
        adj[ti][si] = 1;
      }
    });

    // Draw matrix
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = offsetX + j * cellSize;
        const y = offsetY + i * cellSize;
        if (adj[i][j]) {
          const nodeType = nodes[j].type;
          const color = nodeType === "document" ? "#3b82f6" : nodeType === "keyword" ? "#10b981" : "#f59e0b";
          ctx.fillStyle = color + "80";
        } else {
          ctx.fillStyle = i === j ? "#1e293b" : "#0f172a";
        }
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
      }
    }

    // Row labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "7px monospace";
    ctx.textAlign = "right";
    nodes.forEach((nd: any, i: number) => {
      ctx.fillText(nd.label.substring(0, 12), offsetX - 4, offsetY + i * cellSize + cellSize * 0.7);
    });

    // Column labels
    ctx.save();
    nodes.forEach((nd: any, i: number) => {
      ctx.save();
      ctx.translate(offsetX + i * cellSize + cellSize * 0.7, offsetY - 4);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = "left";
      ctx.fillStyle = "#94a3b8";
      ctx.font = "7px monospace";
      ctx.fillText(nd.label.substring(0, 12), 0, 0);
      ctx.restore();
    });
    ctx.restore();

    // Title
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(L ? `인접 행렬 (${n}×${n})` : `Adjacency Matrix (${n}×${n})`, 10, 20);
    ctx.font = "10px monospace";
    ctx.fillText(`Nodes: ${data.node_count}, Edges: ${data.edge_count}`, 10, 36);

    // Legend
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(w - 150, 15, 8, 8);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.fillText("Document", w - 138, 22);
    ctx.fillStyle = "#10b981";
    ctx.fillRect(w - 150, 28, 8, 8);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Keyword", w - 138, 35);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(w - 150, 41, 8, 8);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("bSDD", w - 138, 48);

  }, [data, L]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <Link href="/ai-lake" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> AI Data Lake
        </Link>
        <h1 className="text-2xl font-bold">{L ? "GNN 그래프 구조" : "GNN Graph Structures"}</h1>
        <p className="text-sm text-muted-foreground">
          {data?.node_count || 0} {L ? "노드" : "nodes"}, {data?.edge_count || 0} {L ? "엣지" : "edges"}
        </p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <canvas ref={canvasRef} width={800} height={500} className="w-full" />
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold text-sm mb-2">{L ? "GNN 특성 행렬 요약" : "GNN Feature Matrix Summary"}</h3>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 rounded-md p-3">
            <p className="text-muted-foreground">{L ? "노드 수" : "Nodes"}</p>
            <p className="text-lg font-bold">{data?.node_count || 0}</p>
          </div>
          <div className="bg-slate-50 rounded-md p-3">
            <p className="text-muted-foreground">{L ? "엣지 수" : "Edges"}</p>
            <p className="text-lg font-bold">{data?.edge_count || 0}</p>
          </div>
          <div className="bg-slate-50 rounded-md p-3">
            <p className="text-muted-foreground">{L ? "노드 유형" : "Node Types"}</p>
            <p className="text-lg font-bold">3</p>
            <p className="text-[9px] text-muted-foreground">Document, Keyword, bSDD</p>
          </div>
        </div>
      </div>
    </div>
  );
}
