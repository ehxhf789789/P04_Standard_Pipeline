"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Loader2,
  Box,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  HelpCircle,
  Search,
  Brain,
  BarChart3,
  Cpu,
} from "lucide-react";
import { outputsApi, EmbeddingData } from "@/lib/api/outputs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguageStore } from "@/store/languageStore";

export default function EmbeddingsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { lang } = useLanguageStore();

  const [embeddingData, setEmbeddingData] = useState<EmbeddingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetchEmbeddings = async () => {
      try {
        const data = await outputsApi.getEmbeddings(projectId, undefined, true);
        setEmbeddingData(data);
      } catch (e) {
        console.error("Failed to load embeddings:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmbeddings();
  }, [projectId]);

  useEffect(() => {
    if (!canvasRef.current || !embeddingData || !embeddingData.embeddings?.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const vectors = embeddingData.embeddings;
    if (vectors.length === 0) return;

    const points = vectors.map((v) => {
      const vec = v.vector || [];
      return {
        x: vec[0] || Math.random(),
        y: vec[1] || Math.random(),
        label: v.element_name || v.element_id,
        ifc_class: v.ifc_class,
      };
    });

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const padding = 60;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    ctx.save();
    ctx.scale(zoom, zoom);

    // Grid
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const x = padding + (width / 10) * i;
      const y = padding + (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x / zoom, padding / zoom);
      ctx.lineTo(x / zoom, (canvas.height - padding) / zoom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding / zoom, y / zoom);
      ctx.lineTo((canvas.width - padding) / zoom, y / zoom);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("PC1", canvas.width / 2 / zoom, (canvas.height - 15) / zoom);
    ctx.save();
    ctx.translate(15 / zoom, canvas.height / 2 / zoom);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("PC2", 0, 0);
    ctx.restore();

    const classColors: Record<string, string> = {
      IfcWall: "#3b82f6",
      IfcSlab: "#10b981",
      IfcBeam: "#f59e0b",
      IfcColumn: "#ef4444",
      IfcDoor: "#8b5cf6",
      IfcWindow: "#06b6d4",
      IfcRailing: "#ec4899",
      IfcFooting: "#6366f1",
    };

    // Draw cluster boundaries (convex hull approximation)
    const classClusters: Record<string, { x: number; y: number }[]> = {};
    points.forEach((point) => {
      const px = padding + ((point.x - minX) / rangeX) * width;
      const py = padding + ((point.y - minY) / rangeY) * height;
      if (!classClusters[point.ifc_class]) classClusters[point.ifc_class] = [];
      classClusters[point.ifc_class].push({ x: px, y: py });
    });

    Object.entries(classClusters).forEach(([cls, pts]) => {
      if (pts.length < 3) return;
      const color = classColors[cls] || "#94a3b8";
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const radius = Math.max(30, ...pts.map((p) => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2))) + 15;

      ctx.beginPath();
      ctx.arc(cx / zoom, cy / zoom, radius / zoom, 0, 2 * Math.PI);
      ctx.fillStyle = color + "10";
      ctx.fill();
      ctx.strokeStyle = color + "30";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cluster label
      ctx.fillStyle = color;
      ctx.font = `bold 10px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(cls.replace("Ifc", ""), cx / zoom, (cy - radius - 5) / zoom);
    });

    // Draw points
    points.forEach((point) => {
      const x = padding + ((point.x - minX) / rangeX) * width;
      const y = padding + ((point.y - minY) / rangeY) * height;
      const color = classColors[point.ifc_class] || "#94a3b8";

      // Shadow
      ctx.beginPath();
      ctx.arc(x / zoom, y / zoom, 7, 0, 2 * Math.PI);
      ctx.fillStyle = color + "40";
      ctx.fill();

      // Point
      ctx.beginPath();
      ctx.arc(x / zoom, y / zoom, 5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    ctx.restore();
  }, [embeddingData, zoom]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href={`/projects/${projectId}/outputs`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {lang === "ko" ? "출력물 목록" : "Back to Outputs"}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {lang === "ko" ? "벡터 임베딩 시각화" : "Vector Embedding Visualization"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ko"
              ? "BIM 요소를 384차원 벡터로 변환한 결과를 PCA로 2D 투영하여 유사한 요소가 가까이 위치하도록 시각화합니다"
              : "BIM elements converted to 384-dim vectors, projected to 2D via PCA. Similar elements appear closer together."}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export NPY
        </Button>
      </div>

      {/* What This Shows - Explanation */}
      <div className="rounded-xl border bg-blue-50/50 border-blue-100 p-4">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-blue-900">
              {lang === "ko" ? "이 시각화는 무엇을 보여주나요?" : "What does this visualization show?"}
            </p>
            <p className="text-blue-800/80">
              {lang === "ko"
                ? "각 점은 BIM 모델의 요소(벽, 슬래브, 보, 기둥 등)를 나타냅니다. AI 모델(all-MiniLM-L6-v2)이 각 요소의 이름, 속성, 재료 등의 정보를 384차원 벡터로 변환합니다. 가까이 위치한 점들은 의미적으로 유사한 요소입니다."
                : "Each dot represents a BIM element (wall, slab, beam, column, etc.). The AI model (all-MiniLM-L6-v2) converts each element's name, properties, and materials into a 384-dimensional vector. Points closer together are semantically similar."}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {embeddingData && (
        <div className="flex gap-3">
          <Badge variant="secondary">{embeddingData.embeddings?.length || 0} Vectors</Badge>
          <Badge variant="secondary">{embeddingData.dimension} Dimensions</Badge>
          <Badge variant="outline">Model: {embeddingData.model_name}</Badge>
        </div>
      )}

      {/* Visualization */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-medium">
                {lang === "ko" ? "2D 투영 (PCA)" : "2D Projection (PCA)"}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center text-xs font-mono">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(1)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative overflow-auto bg-slate-50" style={{ height: "500px" }}>
              <canvas ref={canvasRef} width={900} height={500} className="w-full" />
              {(!embeddingData || !embeddingData.embeddings?.length) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Box className="mx-auto h-12 w-12 opacity-30" />
                    <p className="mt-2">{lang === "ko" ? "임베딩 데이터 없음" : "No embedding data available"}</p>
                    <p className="text-sm">{lang === "ko" ? "파이프라인을 실행하여 임베딩을 생성하세요" : "Run the pipeline to generate embeddings"}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {lang === "ko" ? "IFC 요소 유형별 색상" : "Color by IFC Class"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[
                { cls: "IfcWall", color: "#3b82f6", ko: "벽체" },
                { cls: "IfcSlab", color: "#10b981", ko: "슬래브" },
                { cls: "IfcBeam", color: "#f59e0b", ko: "보" },
                { cls: "IfcColumn", color: "#ef4444", ko: "기둥" },
                { cls: "IfcDoor", color: "#8b5cf6", ko: "문" },
                { cls: "IfcWindow", color: "#06b6d4", ko: "창문" },
                { cls: "IfcRailing", color: "#ec4899", ko: "난간" },
                { cls: "IfcFooting", color: "#6366f1", ko: "기초" },
              ].map(({ cls, color, ko }) => (
                <div key={cls} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs">{cls}</span>
                  <span className="text-[10px] text-muted-foreground">({ko})</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Use Cases */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" />
                {lang === "ko" ? "활용 분야" : "Use Cases"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { icon: Search, title: lang === "ko" ? "유사 요소 검색" : "Similarity Search", desc: lang === "ko" ? "벡터 유사도로 비슷한 BIM 요소를 찾습니다" : "Find similar BIM elements by vector similarity" },
                { icon: BarChart3, title: lang === "ko" ? "클러스터링" : "Clustering", desc: lang === "ko" ? "요소를 자동으로 그룹화합니다" : "Automatically group elements" },
                { icon: Cpu, title: "RAG", desc: lang === "ko" ? "LLM 기반 질의응답에 활용합니다" : "Use in LLM-based Q&A systems" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{title}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
