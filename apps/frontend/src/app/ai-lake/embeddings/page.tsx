"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import apiClient from "@/lib/api/client";

export default function EmbeddingsPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    apiClient.get("/query/ai-data/keywords")
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Draw keyword cloud / scatter
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    // Simulate 2D embedding projection
    const keywords = data.keywords.slice(0, 60);
    const maxCount = keywords[0]?.count || 1;

    keywords.forEach((kw: any, i: number) => {
      const angle = (i / keywords.length) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 100 + Math.random() * 150 + (1 - kw.count / maxCount) * 100;
      const x = w / 2 + Math.cos(angle) * radius;
      const y = h / 2 + Math.sin(angle) * radius;
      const size = 4 + (kw.count / maxCount) * 12;

      // Point
      const hue = (i * 137.5) % 360;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.7)`;
      ctx.fill();

      // Label
      ctx.fillStyle = `hsla(${hue}, 50%, 80%, 0.9)`;
      ctx.font = `${Math.max(8, size - 2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(kw.word, x, y + size + 10);
    });

    // Title
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${data.total_unique} unique keywords, ${data.documents.length} documents`, 10, 20);
    ctx.fillText(L ? "2D 시맨틱 투영 (키워드 빈도 기반)" : "2D Semantic Projection (keyword frequency)", 10, 36);
  }, [data, L]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <Link href="/ai-lake" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> AI Data Lake
        </Link>
        <h1 className="text-2xl font-bold">{L ? "벡터 임베딩" : "Vector Embeddings"}</h1>
        <p className="text-sm text-muted-foreground">
          {data?.total_unique || 0} {L ? "키워드" : "keywords"} / {data?.documents?.length || 0} {L ? "문서" : "documents"}
        </p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <canvas ref={canvasRef} width={900} height={450} className="w-full" />
      </div>

      {/* Document sources */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold text-sm mb-2">{L ? "소스 문서" : "Source Documents"}</h3>
        <div className="space-y-1">
          {data?.documents?.map((doc: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-xs py-1">
              <span className="font-medium flex-1 truncate">{doc.filename}</span>
              <span className="text-muted-foreground">{doc.phase || "unassigned"}</span>
              <span className="text-muted-foreground">{doc.word_count} words</span>
              <span className="text-muted-foreground">{doc.keyword_count} keywords</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top keywords */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold text-sm mb-2">{L ? "상위 키워드" : "Top Keywords"}</h3>
        <div className="flex flex-wrap gap-1.5">
          {data?.keywords?.slice(0, 50).map((kw: any) => (
            <span key={kw.word} className="text-[10px] bg-slate-100 rounded-full px-2 py-0.5">
              {kw.word} <span className="text-muted-foreground">({kw.count})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
