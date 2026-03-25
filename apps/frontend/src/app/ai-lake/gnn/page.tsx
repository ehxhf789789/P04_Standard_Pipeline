"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, Search, X, Move } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import apiClient from "@/lib/api/client";

interface GNode { id: string; label: string; type: string; x: number; y: number; vx: number; vy: number; }
interface GEdge { source: string; target: string; relation: string; }

const typeColors: Record<string, string> = { document: "#3b82f6", keyword: "#10b981", bsdd_class: "#f59e0b" };
const TYPE_KEYS = ["document", "keyword", "bsdd_class"] as const;

export default function GNNPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(TYPE_KEYS));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"matrix" | "force">("force");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const rawData = useRef<any>(null);

  // Mutable refs for RAF loop — avoids re-creating the loop on state changes
  const selectedRef = useRef<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const dragRef = useRef<GNode | null>(null);
  const isDraggingRef = useRef(false);

  selectedRef.current = selectedNodeId;

  useEffect(() => {
    apiClient.get("/query/ai-data/knowledge-graph").then(({ data }) => {
      rawData.current = data;
      const n: GNode[] = data.nodes.map((node: any) => ({
        ...node,
        x: 450 + (Math.random() - 0.5) * 600,
        y: 300 + (Math.random() - 0.5) * 400,
        vx: 0, vy: 0,
      }));
      setNodes(n);
      setEdges(data.edges);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Stable filtered arrays
  const typeFilterKey = useMemo(() => [...typeFilter].sort().join(","), [typeFilter]);
  const filteredNodes = useMemo(() =>
    nodes.filter((n) => typeFilter.has(n.type) && (!searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()))),
    [nodes, typeFilterKey, searchQuery]
  );
  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(() =>
    edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)),
    [edges, filteredNodeIds]
  );

  // Pre-compute connected set for selected node
  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const s = new Set<string>();
    filteredEdges.forEach((e) => {
      if (e.source === selectedNodeId) s.add(e.target);
      if (e.target === selectedNodeId) s.add(e.source);
    });
    return s;
  }, [selectedNodeId, filteredEdges]);

  const connectedEdges = useMemo(() =>
    selectedNodeId ? filteredEdges.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId) : [],
    [selectedNodeId, filteredEdges]
  );

  const selectedNode = useMemo(() => selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) || null : null, [selectedNodeId, nodes]);

  // ===== Force-directed RAF loop — ONE stable loop, reads refs =====
  useEffect(() => {
    if (viewMode !== "force" || filteredNodes.length === 0 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;

    // Capture current snapshot for this loop
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

      // Physics
      const alpha = Math.max(0, 1 - iter / 250);
      if (alpha > 0.01) {
        for (let i = 0; i < loopNodes.length; i++) {
          for (let j = i + 1; j < loopNodes.length; j++) {
            const a = loopNodes[i], b = loopNodes[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const f = 500 / (dist * dist) * alpha;
            a.vx -= (dx / dist) * f; a.vy -= (dy / dist) * f;
            b.vx += (dx / dist) * f; b.vy += (dy / dist) * f;
          }
        }
        loopEdges.forEach((e) => {
          const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
          if (!s || !t) return;
          const dx = t.x - s.x, dy = t.y - s.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const f = (dist - 80) * 0.006 * alpha;
          s.vx += (dx / dist) * f; s.vy += (dy / dist) * f;
          t.vx -= (dx / dist) * f; t.vy -= (dy / dist) * f;
        });
        loopNodes.forEach((n) => {
          if (n === drag) return;
          n.vx = (n.vx + (w / 2 - n.x) * 0.0004) * 0.85;
          n.vy = (n.vy + (h / 2 - n.y) * 0.0004) * 0.85;
          n.x = Math.max(30, Math.min(w - 30, n.x + n.vx));
          n.y = Math.max(30, Math.min(h - 30, n.y + n.vy));
        });
        iter++;
      }

      // Render
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);

      loopEdges.forEach((e) => {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
        if (!s || !t) return;
        const isHL = sel && (s.id === sel || t.id === sel);
        const isHov = hov && (s.id === hov || t.id === hov);
        ctx.strokeStyle = isHL ? "rgba(255,255,255,0.6)" : isHov ? "rgba(255,255,255,0.35)" : "rgba(100,116,139,0.15)";
        ctx.lineWidth = isHL ? 2 : isHov ? 1.2 : 0.5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
        if (isHL || isHov) {
          ctx.fillStyle = "rgba(148,163,184,0.8)"; ctx.font = "7px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(e.relation, (s.x + t.x) / 2, (s.y + t.y) / 2 - 4);
        }
      });

      loopNodes.forEach((n) => {
        const color = typeColors[n.type] || "#64748b";
        const r = n.type === "document" ? 10 : 6;
        const isSel = sel === n.id;
        const isHov = hov === n.id;
        const isConn = sel ? connectedIds.has(n.id) : false;

        if (isSel || isHov) {
          ctx.beginPath(); ctx.arc(n.x, n.y, r + 7, 0, Math.PI * 2);
          ctx.fillStyle = color + "30"; ctx.fill();
          ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = (sel && !isSel && !isConn) ? color + "30" : color;
        ctx.fill();
        if (isSel || isConn || isHov || !sel) {
          ctx.fillStyle = "#cbd5e1";
          ctx.font = n.type === "document" ? "bold 9px sans-serif" : "7px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(n.label.substring(0, 20), n.x, n.y + r + 12);
        }
      });

      animRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [filteredNodes, filteredEdges, viewMode]); // stable deps via useMemo

  // ===== Matrix — static render, no RAF loop =====
  useEffect(() => {
    if (viewMode !== "matrix" || !canvasRef.current || filteredNodes.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, w, h);

    const fNodes = filteredNodes.slice(0, 40);
    const n = fNodes.length;
    if (n === 0) return;
    const cellSize = Math.min((w - 130) / n, (h - 130) / n, 18);
    const ox = 110, oy = 90;
    const idxMap = new Map(fNodes.map((nd, i) => [nd.id, i]));
    const adj = Array.from({ length: n }, () => new Array(n).fill(0));
    filteredEdges.forEach((e) => {
      const si = idxMap.get(e.source), ti = idxMap.get(e.target);
      if (si !== undefined && ti !== undefined) { adj[si][ti] = 1; adj[ti][si] = 1; }
    });

    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = ox + j * cellSize, y = oy + i * cellSize;
      ctx.fillStyle = adj[i][j] ? (typeColors[fNodes[j].type] || "#64748b") + "80" : i === j ? "#1e293b" : "#0f172a";
      ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
      if (selectedNodeId && (fNodes[i].id === selectedNodeId || fNodes[j].id === selectedNodeId) && adj[i][j]) {
        ctx.strokeStyle = "#ffffff40"; ctx.strokeRect(x, y, cellSize - 1, cellSize - 1);
      }
    }

    ctx.fillStyle = "#94a3b8"; ctx.font = "7px monospace"; ctx.textAlign = "right";
    fNodes.forEach((nd, i) => ctx.fillText(nd.label.substring(0, 14), ox - 4, oy + i * cellSize + cellSize * 0.7));
    ctx.save();
    fNodes.forEach((nd, i) => { ctx.save(); ctx.translate(ox + i * cellSize + cellSize * 0.7, oy - 4); ctx.rotate(-Math.PI / 4); ctx.textAlign = "left"; ctx.fillStyle = "#94a3b8"; ctx.font = "7px monospace"; ctx.fillText(nd.label.substring(0, 14), 0, 0); ctx.restore(); });
    ctx.restore();
    ctx.fillStyle = "#94a3b8"; ctx.font = "12px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(L ? `인접 행렬 (${n}×${n})` : `Adjacency Matrix (${n}×${n})`, 10, 20);
    ctx.font = "10px monospace";
    ctx.fillText(`Nodes: ${rawData.current?.node_count || 0}, Edges: ${rawData.current?.edge_count || 0}`, 10, 36);
    [["#3b82f6", "Document"], ["#10b981", "Keyword"], ["#f59e0b", "bSDD"]].forEach(([c, l], i) => {
      ctx.fillStyle = c; ctx.fillRect(w - 150, 15 + i * 14, 8, 8);
      ctx.fillStyle = "#94a3b8"; ctx.font = "9px sans-serif"; ctx.fillText(l, w - 138, 22 + i * 14);
    });
  }, [filteredNodes, filteredEdges, selectedNodeId, viewMode, L]);

  // ===== Mouse — use refs, minimal setState =====
  const handleCanvasMouseEvent = useCallback((e: React.MouseEvent<HTMLCanvasElement>, type: "click" | "down" | "move" | "up") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    const hitTest = () => filteredNodes.find((n) => Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) < (n.type === "document" ? 14 : 10)) || null;

    if (type === "click") {
      if (isDraggingRef.current) return;
      const node = hitTest();
      setSelectedNodeId(node?.id || null);
    } else if (type === "down") {
      if (viewMode !== "force") return;
      const node = hitTest();
      if (node) { dragRef.current = node; isDraggingRef.current = false; }
    } else if (type === "move") {
      if (dragRef.current && viewMode === "force") {
        isDraggingRef.current = true;
        dragRef.current.x = mx; dragRef.current.y = my;
        dragRef.current.vx = 0; dragRef.current.vy = 0;
      } else {
        const node = hitTest();
        hoveredRef.current = node?.id || null;
        canvas.style.cursor = node ? "pointer" : "default";
      }
    } else { // up
      dragRef.current = null;
      setTimeout(() => { isDraggingRef.current = false; }, 50);
    }
  }, [filteredNodes, viewMode]);

  const toggleType = useCallback((type: string) => {
    setTypeFilter((prev) => { const next = new Set(prev); if (next.has(type)) next.delete(type); else next.add(type); return next; });
  }, []);

  const handleExportJSON = useCallback(() => {
    const data = { nodes: filteredNodes.map(({ id, label, type }) => ({ id, label, type })), edges: filteredEdges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "gnn_graph.json"; a.click();
  }, [filteredNodes, filteredEdges]);

  const handleExportCSV = useCallback(() => {
    const rows = ["source,target,relation", ...filteredEdges.map((e) => `"${e.source}","${e.target}","${e.relation}"`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "gnn_edges.csv"; a.click();
  }, [filteredEdges]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/ai-lake" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> AI Data Lake
          </Link>
          <h1 className="text-2xl font-bold">{L ? "GNN 그래프 구조" : "GNN Graph Structures"}</h1>
          <p className="text-sm text-muted-foreground">{filteredNodes.length} {L ? "노드" : "nodes"}, {filteredEdges.length} {L ? "엣지" : "edges"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportJSON} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"><Download className="h-3.5 w-3.5" /> JSON</button>
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700"><Download className="h-3.5 w-3.5" /> CSV</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex rounded-md border overflow-hidden">
          <button onClick={() => setViewMode("force")} className={`px-3 py-1 text-[11px] font-medium ${viewMode === "force" ? "bg-slate-800 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"}`}><Move className="h-3 w-3 inline mr-1" />{L ? "힘-방향" : "Force"}</button>
          <button onClick={() => setViewMode("matrix")} className={`px-3 py-1 text-[11px] font-medium ${viewMode === "matrix" ? "bg-slate-800 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"}`}>{L ? "행렬" : "Matrix"}</button>
        </div>
        <div className="h-5 w-px bg-border" />
        {TYPE_KEYS.map((type) => (
          <button key={type} onClick={() => toggleType(type)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${typeFilter.has(type) ? "border-current shadow-sm" : "border-slate-200 dark:border-slate-700 opacity-40"}`}
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
        <canvas ref={canvasRef} width={900} height={550} className="w-full"
          onClick={(e) => handleCanvasMouseEvent(e, "click")}
          onMouseDown={(e) => handleCanvasMouseEvent(e, "down")}
          onMouseMove={(e) => handleCanvasMouseEvent(e, "move")}
          onMouseUp={(e) => handleCanvasMouseEvent(e, "up")}
          onMouseLeave={(e) => handleCanvasMouseEvent(e, "up")}
        />
      </div>

      {selectedNode && <SelectedNodePanel node={selectedNode} edges={connectedEdges} nodes={nodes} L={L} onSelect={setSelectedNodeId} onClose={() => setSelectedNodeId(null)} />}

      <StatsGrid rawData={rawData.current} L={L} />
      <p className="text-[10px] text-muted-foreground text-center">
        {viewMode === "force" ? (L ? "클릭: 연결 확인 | 드래그: 위치 조정" : "Click: connections | Drag: reposition") : (L ? "클릭: 행렬 하이라이트" : "Click: highlight in matrix")}
      </p>
    </div>
  );
}

// ===== Memoized sub-components =====
const SelectedNodePanel = memo(function SelectedNodePanel({ node, edges, nodes, L, onSelect, onClose }: {
  node: GNode; edges: GEdge[]; nodes: GNode[]; L: boolean; onSelect: (id: string) => void; onClose: () => void;
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

const StatsGrid = memo(function StatsGrid({ rawData, L }: { rawData: any; L: boolean }) {
  const nc = rawData?.node_count || 0;
  const ec = rawData?.edge_count || 0;
  const density = nc > 1 ? ((ec / (nc * (nc - 1) / 2)) * 100).toFixed(1) : "0";
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: L ? "전체 노드" : "Total Nodes", value: nc },
        { label: L ? "전체 엣지" : "Total Edges", value: ec },
        { label: L ? "노드 유형" : "Node Types", value: 3, sub: "Document, Keyword, bSDD" },
        { label: L ? "밀도" : "Density", value: `${density}%` },
      ].map((s) => (
        <div key={s.label} className="rounded-lg border bg-white dark:bg-slate-900 p-3">
          <p className="text-[10px] text-muted-foreground">{s.label}</p>
          <p className="text-lg font-bold">{s.value}</p>
          {s.sub && <p className="text-[9px] text-muted-foreground">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
});
