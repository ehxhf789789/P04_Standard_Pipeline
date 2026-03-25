"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, X, Download, Search } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import apiClient from "@/lib/api/client";

interface Node { id: string; label: string; type: string; x: number; y: number; vx: number; vy: number; phase?: string; }
interface Edge { source: string; target: string; relation: string; }

const typeColors: Record<string, string> = { document: "#3b82f6", keyword: "#10b981", bsdd_class: "#f59e0b" };
const TYPE_KEYS = ["document", "keyword", "bsdd_class"] as const;

export default function KnowledgeGraphPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(TYPE_KEYS));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Mutable refs for RAF — no re-creating the loop
  const selectedRef = useRef<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const dragRef = useRef<Node | null>(null);
  const isDraggingRef = useRef(false);
  selectedRef.current = selectedNodeId;

  useEffect(() => {
    apiClient.get("/query/ai-data/knowledge-graph").then(({ data }) => {
      const n = data.nodes.map((node: any) => ({
        ...node, x: 450 + (Math.random() - 0.5) * 600, y: 250 + (Math.random() - 0.5) * 350, vx: 0, vy: 0,
      }));
      setNodes(n);
      setEdges(data.edges);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Stable memoized filters
  const typeFilterKey = useMemo(() => [...typeFilter].sort().join(","), [typeFilter]);
  const filteredNodes = useMemo(() =>
    nodes.filter((n) => typeFilter.has(n.type) && (!searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()))),
    [nodes, typeFilterKey, searchQuery]
  );
  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(() => edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)), [edges, filteredNodeIds]);

  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const s = new Set<string>();
    filteredEdges.forEach((e) => { if (e.source === selectedNodeId) s.add(e.target); if (e.target === selectedNodeId) s.add(e.source); });
    return s;
  }, [selectedNodeId, filteredEdges]);

  const connectedEdges = useMemo(() => selectedNodeId ? filteredEdges.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId) : [], [selectedNodeId, filteredEdges]);
  const selectedNode = useMemo(() => selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) || null : null, [selectedNodeId, nodes]);

  // ===== Single stable RAF loop =====
  useEffect(() => {
    if (filteredNodes.length === 0 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const loopNodes = filteredNodes;
    const loopEdges = filteredEdges;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    let iter = 0;
    let running = true;

    const tick = () => {
      if (!running) return;
      const sel = selectedRef.current;
      const hov = hoveredRef.current;
      const drag = dragRef.current;

      const alpha = Math.max(0, 1 - iter / 200);
      if (alpha > 0.01) {
        for (let i = 0; i < loopNodes.length; i++) {
          for (let j = i + 1; j < loopNodes.length; j++) {
            const a = loopNodes[i], b = loopNodes[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const f = 600 / (dist * dist) * alpha;
            a.vx -= (dx / dist) * f; a.vy -= (dy / dist) * f;
            b.vx += (dx / dist) * f; b.vy += (dy / dist) * f;
          }
        }
        loopEdges.forEach((e) => {
          const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
          if (!s || !t) return;
          const dx = t.x - s.x, dy = t.y - s.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const f = (dist - 70) * 0.008 * alpha;
          s.vx += (dx / dist) * f; s.vy += (dy / dist) * f;
          t.vx -= (dx / dist) * f; t.vy -= (dy / dist) * f;
        });
        loopNodes.forEach((n) => {
          if (n === drag) return;
          n.vx = (n.vx + (w / 2 - n.x) * 0.0005) * 0.85;
          n.vy = (n.vy + (h / 2 - n.y) * 0.0005) * 0.85;
          n.x = Math.max(30, Math.min(w - 30, n.x + n.vx));
          n.y = Math.max(30, Math.min(h - 30, n.y + n.vy));
        });
        iter++;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, w, h);

      loopEdges.forEach((e) => {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
        if (!s || !t) return;
        const isHL = sel && (s.id === sel || t.id === sel);
        const isHov = hov && (s.id === hov || t.id === hov);
        ctx.strokeStyle = isHL ? "rgba(255,255,255,0.5)" : isHov ? "rgba(255,255,255,0.3)" : "rgba(100,116,139,0.2)";
        ctx.lineWidth = isHL ? 1.5 : isHov ? 1 : 0.5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
        if (isHL || isHov) {
          ctx.fillStyle = "rgba(148,163,184,0.7)"; ctx.font = "7px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(e.relation, (s.x + t.x) / 2, (s.y + t.y) / 2 - 4);
        }
      });

      loopNodes.forEach((n) => {
        const color = typeColors[n.type] || "#64748b";
        const r = n.type === "document" ? 9 : 5;
        const isSel = sel === n.id;
        const isHov = hov === n.id;
        const isConn = sel ? connectedIds.has(n.id) : false;

        if (isSel) { ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2); ctx.fillStyle = color + "40"; ctx.fill(); }
        if (isHov && !isSel) { ctx.beginPath(); ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2); ctx.fillStyle = color + "25"; ctx.fill(); }
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = (sel && !isSel && !isConn) ? color + "30" : color;
        ctx.fill();
        if (isSel || isConn || isHov || !sel) {
          ctx.fillStyle = "#cbd5e1"; ctx.font = n.type === "document" ? "bold 9px sans-serif" : "7px sans-serif";
          ctx.textAlign = "center"; ctx.fillText(n.label.substring(0, 18), n.x, n.y + r + 11);
        }
      });

      animRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [filteredNodes, filteredEdges]); // stable deps

  // Mouse
  const handleCanvasEvent = useCallback((e: React.MouseEvent<HTMLCanvasElement>, type: "click" | "down" | "move" | "up") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = () => filteredNodes.find((n) => Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) < (n.type === "document" ? 12 : 8)) || null;

    if (type === "click") { if (!isDraggingRef.current) { const nd = hit(); setSelectedNodeId(nd?.id || null); } }
    else if (type === "down") { const nd = hit(); if (nd) { dragRef.current = nd; isDraggingRef.current = false; } }
    else if (type === "move") {
      if (dragRef.current) { isDraggingRef.current = true; dragRef.current.x = mx; dragRef.current.y = my; dragRef.current.vx = 0; dragRef.current.vy = 0; }
      else { hoveredRef.current = hit()?.id || null; canvas.style.cursor = hoveredRef.current ? "pointer" : "default"; }
    } else { dragRef.current = null; setTimeout(() => { isDraggingRef.current = false; }, 50); }
  }, [filteredNodes]);

  const toggleType = useCallback((type: string) => {
    setTypeFilter((prev) => { const next = new Set(prev); if (next.has(type)) next.delete(type); else next.add(type); return next; });
  }, []);

  const handleExportJSON = useCallback(() => {
    const data = { nodes: filteredNodes.map(({ id, label, type }) => ({ id, label, type })), edges: filteredEdges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "knowledge_graph.json"; a.click();
  }, [filteredNodes, filteredEdges]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/ai-lake" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"><ArrowLeft className="h-3 w-3" /> AI Data Lake</Link>
          <h1 className="text-2xl font-bold">{L ? "지식 그래프" : "Knowledge Graph"}</h1>
          <p className="text-sm text-muted-foreground">{filteredNodes.length} {L ? "노드" : "nodes"}, {filteredEdges.length} {L ? "엣지" : "edges"}</p>
        </div>
        <button onClick={handleExportJSON} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"><Download className="h-3.5 w-3.5" /> JSON</button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {TYPE_KEYS.map((type) => (
          <button key={type} onClick={() => toggleType(type)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border ${typeFilter.has(type) ? "border-current" : "border-slate-200 dark:border-slate-700 opacity-40"}`}
            style={{ color: typeColors[type] }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: typeColors[type] }} />
            {type === "document" ? (L ? "문서" : "Doc") : type === "keyword" ? (L ? "키워드" : "KW") : "bSDD"}
          </button>
        ))}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border rounded-md px-2 py-1 flex-1 max-w-[200px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={L ? "검색..." : "Search..."} className="text-xs bg-transparent border-0 focus:outline-none flex-1" />
          {searchQuery && <button onClick={() => setSearchQuery("")}><X className="h-3 w-3 text-muted-foreground" /></button>}
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <canvas ref={canvasRef} width={900} height={500} className="w-full cursor-pointer"
          onClick={(e) => handleCanvasEvent(e, "click")}
          onMouseDown={(e) => handleCanvasEvent(e, "down")}
          onMouseMove={(e) => handleCanvasEvent(e, "move")}
          onMouseUp={(e) => handleCanvasEvent(e, "up")}
          onMouseLeave={(e) => handleCanvasEvent(e, "up")} />
      </div>

      {selectedNode && <SelectedPanel node={selectedNode} edges={connectedEdges} nodes={nodes} L={L} onSelect={setSelectedNodeId} onClose={() => setSelectedNodeId(null)} />}
      <p className="text-[10px] text-muted-foreground text-center">{L ? "클릭: 연결 확인 | 드래그: 위치 조정" : "Click: connections | Drag: reposition"}</p>
    </div>
  );
}

const SelectedPanel = memo(function SelectedPanel({ node, edges, nodes, L, onSelect, onClose }: {
  node: Node; edges: Edge[]; nodes: Node[]; L: boolean; onSelect: (id: string) => void; onClose: () => void;
}) {
  return (
    <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: typeColors[node.type] }} />
          <span className="font-semibold text-sm">{node.label}</span>
          <span className="text-[10px] text-muted-foreground bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{node.type}</span>
        </div>
        <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{edges.length} {L ? "연결" : "connections"}</p>
      <div className="flex flex-wrap gap-1">
        {edges.map((e, i) => {
          const otherId = e.source === node.id ? e.target : e.source;
          const other = nodes.find((n) => n.id === otherId);
          return other ? (
            <span key={i} className="text-[10px] bg-slate-50 dark:bg-slate-800 border rounded px-2 py-0.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => onSelect(other.id)}>
              <span className="text-muted-foreground">{e.relation} →</span> {other.label}
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
});
