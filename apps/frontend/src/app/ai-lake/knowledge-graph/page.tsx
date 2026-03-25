"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ZoomIn, ZoomOut, Filter, X, Download } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import apiClient from "@/lib/api/client";

interface Node { id: string; label: string; type: string; x: number; y: number; vx: number; vy: number; phase?: string; }
interface Edge { source: string; target: string; relation: string; }

const typeColors: Record<string, string> = { document: "#3b82f6", keyword: "#10b981", bsdd_class: "#f59e0b" };

export default function KnowledgeGraphPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(["document", "keyword", "bsdd_class"]));
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragNode, setDragNode] = useState<Node | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    apiClient.get("/query/ai-data/knowledge-graph").then(({ data }) => {
      const n = data.nodes.map((node: any, i: number) => ({
        ...node, x: 450 + (Math.random() - 0.5) * 600, y: 250 + (Math.random() - 0.5) * 350, vx: 0, vy: 0,
      }));
      setNodes(n);
      nodesRef.current = n;
      setEdges(data.edges);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filteredNodes = nodes.filter((n) => typeFilter.has(n.type) && (!searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase())));
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

  // Simulation + render
  useEffect(() => {
    if (nodes.length === 0 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    let iter = 0;

    const tick = () => {
      const alpha = Math.max(0, 1 - iter / 200);
      if (alpha > 0.01) {
        // Repulsion
        for (let i = 0; i < filteredNodes.length; i++) {
          for (let j = i + 1; j < filteredNodes.length; j++) {
            const a = filteredNodes[i], b = filteredNodes[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const f = 600 / (dist * dist) * alpha;
            a.vx -= (dx / dist) * f; a.vy -= (dy / dist) * f;
            b.vx += (dx / dist) * f; b.vy += (dy / dist) * f;
          }
        }
        // Attraction
        filteredEdges.forEach((e) => {
          const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
          if (!s || !t) return;
          const dx = t.x - s.x, dy = t.y - s.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const f = (dist - 70) * 0.008 * alpha;
          s.vx += (dx / dist) * f; s.vy += (dy / dist) * f;
          t.vx -= (dx / dist) * f; t.vy -= (dy / dist) * f;
        });
        // Apply
        filteredNodes.forEach((n) => {
          if (n === dragNode) return;
          n.vx = (n.vx + (w / 2 - n.x) * 0.0005) * 0.85;
          n.vy = (n.vy + (h / 2 - n.y) * 0.0005) * 0.85;
          n.x = Math.max(30, Math.min(w - 30, n.x + n.vx));
          n.y = Math.max(30, Math.min(h - 30, n.y + n.vy));
        });
        iter++;
      }

      // Render
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);
      ctx.save();

      // Edges
      filteredEdges.forEach((e) => {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
        if (!s || !t) return;
        const isHighlight = selectedNode && (s.id === selectedNode.id || t.id === selectedNode.id);
        ctx.strokeStyle = isHighlight ? "rgba(255,255,255,0.5)" : "rgba(100,116,139,0.2)";
        ctx.lineWidth = isHighlight ? 1.5 : 0.5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
      });

      // Nodes
      filteredNodes.forEach((n) => {
        const color = typeColors[n.type] || "#64748b";
        const r = n.type === "document" ? 9 : 5;
        const isSelected = selectedNode?.id === n.id;
        const isConnected = selectedNode && filteredEdges.some((e) => (e.source === selectedNode.id && e.target === n.id) || (e.target === selectedNode.id && e.source === n.id));

        if (isSelected) {
          ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
          ctx.fillStyle = color + "40"; ctx.fill();
        }

        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = (selectedNode && !isSelected && !isConnected) ? color + "30" : color;
        ctx.fill();

        if (isSelected || isConnected || !selectedNode) {
          ctx.fillStyle = "#cbd5e1";
          ctx.font = n.type === "document" ? "bold 9px sans-serif" : "7px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(n.label.substring(0, 18), n.x, n.y + r + 11);
        }
      });

      ctx.restore();
      animRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(animRef.current);
  }, [filteredNodes, filteredEdges, selectedNode, dragNode, zoom]);

  // Mouse interaction
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    const clicked = filteredNodes.find((n) => {
      const r = n.type === "document" ? 12 : 8;
      return Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) < r;
    });
    setSelectedNode(clicked || null);
  }, [filteredNodes]);

  const handleExportJSON = () => {
    const data = { nodes: filteredNodes.map(({ id, label, type }) => ({ id, label, type })), edges: filteredEdges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "knowledge_graph.json"; a.click();
  };

  const toggleType = (type: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const connectedEdges = selectedNode ? filteredEdges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id) : [];

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/ai-lake" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"><ArrowLeft className="h-3 w-3" /> AI Data Lake</Link>
          <h1 className="text-2xl font-bold">{L ? "지식 그래프" : "Knowledge Graph"}</h1>
          <p className="text-sm text-muted-foreground">{filteredNodes.length} {L ? "노드" : "nodes"}, {filteredEdges.length} {L ? "엣지" : "edges"}</p>
        </div>
        <button onClick={handleExportJSON} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">
          <Download className="h-3.5 w-3.5" /> JSON
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {(["document", "keyword", "bsdd_class"] as const).map((type) => (
          <button key={type} onClick={() => toggleType(type)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border ${typeFilter.has(type) ? "border-current" : "border-slate-200 opacity-40"}`}
            style={{ color: typeColors[type] }}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: typeColors[type] }} />
            {type === "document" ? (L ? "문서" : "Document") : type === "keyword" ? (L ? "키워드" : "Keyword") : "bSDD"}
          </button>
        ))}
        <div className="flex items-center gap-1 bg-white border rounded-md px-2 py-1 flex-1 max-w-[200px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={L ? "노드 검색..." : "Search nodes..."} className="text-xs bg-transparent border-0 focus:outline-none flex-1" />
        </div>
      </div>

      {/* Canvas */}
      <div className="rounded-lg border overflow-hidden">
        <canvas ref={canvasRef} width={900} height={500} className="w-full cursor-pointer" onClick={handleCanvasClick} />
      </div>

      {/* Selected node info */}
      {selectedNode && (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: typeColors[selectedNode.type] }} />
              <span className="font-semibold text-sm">{selectedNode.label}</span>
              <span className="text-[10px] text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">{selectedNode.type}</span>
            </div>
            <button onClick={() => setSelectedNode(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{connectedEdges.length} {L ? "연결" : "connections"}</p>
          <div className="flex flex-wrap gap-1">
            {connectedEdges.map((e, i) => {
              const otherId = e.source === selectedNode.id ? e.target : e.source;
              const other = nodes.find((n) => n.id === otherId);
              return other ? (
                <span key={i} className="text-[10px] bg-slate-50 border rounded px-2 py-0.5 cursor-pointer hover:bg-slate-100" onClick={() => setSelectedNode(other)}>
                  <span className="text-muted-foreground">{e.relation} →</span> {other.label}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">{L ? "노드를 클릭하여 연결 관계를 확인하세요" : "Click a node to see its connections"}</p>
    </div>
  );
}
