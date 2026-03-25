"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, Search, X, Filter } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import apiClient from "@/lib/api/client";

interface KWPoint { word: string; count: number; x: number; y: number; cluster: number; hue: number; size: number; }

const clusterColors = [
  { h: 220, name: "Documents" }, { h: 150, name: "Structural" }, { h: 30, name: "Properties" },
  { h: 280, name: "Classification" }, { h: 0, name: "Materials" }, { h: 60, name: "Spatial" },
];

export default function EmbeddingsPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [rawData, setRawData] = useState<any>(null);
  const [points, setPoints] = useState<KWPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [clusterFilter, setClusterFilter] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5]));
  const [minCount, setMinCount] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Mutable refs for RAF
  const selectedRef = useRef<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  selectedRef.current = selectedWord;

  const maxCount = useMemo(() => Math.max(...points.map((p) => p.count), 1), [points]);

  useEffect(() => {
    apiClient.get("/query/ai-data/keywords").then(({ data }) => {
      setRawData(data);
      const keywords = data.keywords.slice(0, 80);
      const mc = keywords[0]?.count || 1;
      const pts: KWPoint[] = keywords.map((kw: any, i: number) => {
        const angle = (i / keywords.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const radius = 120 + Math.random() * 140 + (1 - kw.count / mc) * 80;
        const cluster = i % clusterColors.length;
        return { word: kw.word, count: kw.count, x: 450 + Math.cos(angle) * radius, y: 250 + Math.sin(angle) * radius, cluster, hue: clusterColors[cluster].h, size: 4 + (kw.count / mc) * 14 };
      });
      setPoints(pts);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const clusterFilterKey = useMemo(() => [...clusterFilter].sort().join(","), [clusterFilter]);
  const filteredPoints = useMemo(() =>
    points.filter((p) => clusterFilter.has(p.cluster) && p.count >= minCount && (!searchQuery || p.word.toLowerCase().includes(searchQuery.toLowerCase()))),
    [points, clusterFilterKey, minCount, searchQuery]
  );

  const selectedPoint = useMemo(() => selectedWord ? points.find((p) => p.word === selectedWord) || null : null, [selectedWord, points]);

  // ===== Single stable RAF loop =====
  useEffect(() => {
    if (!canvasRef.current || filteredPoints.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const pts = filteredPoints;
    let running = true;

    // Pre-compute cluster connections (O(n^2) once, not every frame)
    const connections: [number, number, number][] = []; // [i, j, dist]
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (pts[i].cluster === pts[j].cluster) {
          const dist = Math.sqrt((pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2);
          if (dist < 150) connections.push([i, j, dist]);
        }
      }
    }

    const render = () => {
      if (!running) return;
      const sel = selectedRef.current;
      const hov = hoveredRef.current;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, w, h);

      // Grid dots
      ctx.fillStyle = "#1e293b";
      for (let x = 50; x < w; x += 50) for (let y = 50; y < h; y += 50) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill(); }

      // Connections (pre-computed)
      connections.forEach(([i, j, dist]) => {
        const p = pts[i], q = pts[j];
        ctx.strokeStyle = `hsla(${p.hue}, 50%, 50%, ${0.06 * (1 - dist / 150)})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      });

      // Points
      pts.forEach((p) => {
        const isSel = sel === p.word;
        const isHov = hov === p.word;
        const dimmed = sel && !isSel;

        if (isSel || isHov) {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size + 6, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 60%, 50%, 0.2)`; ctx.fill();
          ctx.strokeStyle = `hsla(${p.hue}, 60%, 60%, 0.6)`; ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = dimmed ? `hsla(${p.hue}, 30%, 40%, 0.3)` : `hsla(${p.hue}, 70%, 60%, 0.8)`;
        ctx.fill();

        if (isSel || isHov || p.size > 10 || !sel) {
          ctx.fillStyle = dimmed ? `hsla(${p.hue}, 30%, 70%, 0.3)` : `hsla(${p.hue}, 50%, 85%, 0.9)`;
          ctx.font = `${Math.max(8, p.size - 1)}px sans-serif`; ctx.textAlign = "center";
          ctx.fillText(p.word, p.x, p.y + p.size + 12);
          if (isSel || isHov) { ctx.fillStyle = "#94a3b8"; ctx.font = "8px monospace"; ctx.fillText(`(${p.count})`, p.x, p.y + p.size + 22); }
        }
      });

      // Title
      ctx.fillStyle = "#94a3b8"; ctx.font = "12px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(`${rawData?.total_unique || 0} keywords, ${rawData?.documents?.length || 0} docs`, 10, 20);

      // Cluster legend
      clusterColors.forEach((c, i) => {
        ctx.fillStyle = `hsl(${c.h}, 70%, 60%)`; ctx.beginPath(); ctx.arc(20, 40 + i * 15, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#94a3b8"; ctx.font = "9px sans-serif"; ctx.textAlign = "left"; ctx.fillText(c.name, 30, 43 + i * 15);
      });

      animRef.current = requestAnimationFrame(render);
    };
    render();
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [filteredPoints, rawData]);

  // Mouse — minimal setState via refs
  const handleCanvasEvent = useCallback((e: React.MouseEvent<HTMLCanvasElement>, type: "click" | "move") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = filteredPoints.find((p) => Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2) < p.size + 5) || null;

    if (type === "click") {
      setSelectedWord(hit?.word || null);
    } else {
      hoveredRef.current = hit?.word || null;
      canvas.style.cursor = hit ? "pointer" : "default";
    }
  }, [filteredPoints]);

  const toggleCluster = useCallback((idx: number) => {
    setClusterFilter((prev) => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
  }, []);

  const handleExport = useCallback(() => {
    const data = { keywords: filteredPoints.map((p) => ({ word: p.word, count: p.count, cluster: p.cluster })), documents: rawData?.documents || [] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "embeddings.json"; a.click();
  }, [filteredPoints, rawData]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/ai-lake" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"><ArrowLeft className="h-3 w-3" /> AI Data Lake</Link>
          <h1 className="text-2xl font-bold">{L ? "벡터 임베딩" : "Vector Embeddings"}</h1>
          <p className="text-sm text-muted-foreground">{rawData?.total_unique || 0} {L ? "키워드" : "keywords"} / {rawData?.documents?.length || 0} {L ? "문서" : "documents"}</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700"><Download className="h-3.5 w-3.5" /> {L ? "내보내기" : "Export"}</button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {clusterColors.map((c, i) => (
          <button key={i} onClick={() => toggleCluster(i)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${clusterFilter.has(i) ? "border-current shadow-sm" : "border-slate-200 dark:border-slate-700 opacity-40"}`}
            style={{ color: `hsl(${c.h}, 70%, 50%)` }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${c.h}, 70%, 50%)` }} />{c.name}
          </button>
        ))}
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border rounded-md px-2 py-1 max-w-[180px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={L ? "검색..." : "Search..."} className="text-xs bg-transparent border-0 focus:outline-none flex-1 w-full" />
          {searchQuery && <button onClick={() => setSearchQuery("")}><X className="h-3 w-3" /></button>}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" /><span>Min:</span>
          <input type="range" min={1} max={maxCount} value={minCount} onChange={(e) => setMinCount(Number(e.target.value))} className="w-20 h-1 accent-violet-500" />
          <span className="font-mono w-6">{minCount}</span>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <canvas ref={canvasRef} width={900} height={500} className="w-full cursor-default"
          onClick={(e) => handleCanvasEvent(e, "click")}
          onMouseMove={(e) => handleCanvasEvent(e, "move")} />
      </div>

      {selectedPoint && <SelectedKeyword point={selectedPoint} points={points} L={L} onSelect={setSelectedWord} onClose={() => setSelectedWord(null)} />}
      <DocList data={rawData} L={L} />
    </div>
  );
}

const SelectedKeyword = memo(function SelectedKeyword({ point, points, L, onSelect, onClose }: { point: KWPoint; points: KWPoint[]; L: boolean; onSelect: (w: string) => void; onClose: () => void; }) {
  const related = useMemo(() => points.filter((p) => p.cluster === point.cluster && p.word !== point.word).slice(0, 15), [point, points]);
  return (
    <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${point.hue}, 70%, 50%)` }} />
          <span className="font-semibold">{point.word}</span>
          <span className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{L ? "빈도" : "Count"}: {point.count}</span>
          <span className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{clusterColors[point.cluster].name}</span>
        </div>
        <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {related.map((p) => (
          <span key={p.word} className="text-[10px] bg-slate-50 dark:bg-slate-800 border rounded px-2 py-0.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => onSelect(p.word)}>{p.word} ({p.count})</span>
        ))}
      </div>
    </div>
  );
});

const DocList = memo(function DocList({ data, L }: { data: any; L: boolean }) {
  if (!data?.documents?.length) return null;
  return (
    <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
      <h3 className="font-semibold text-sm mb-2">{L ? "소스 문서" : "Source Documents"}</h3>
      <div className="space-y-1">
        {data.documents.map((doc: any, i: number) => (
          <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b last:border-0 border-slate-100 dark:border-slate-800">
            <span className="font-medium flex-1 truncate">{doc.filename}</span>
            <span className="text-muted-foreground bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{doc.phase || "unassigned"}</span>
            <span className="text-muted-foreground">{doc.word_count} {L ? "단어" : "words"}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
