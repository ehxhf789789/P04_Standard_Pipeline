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
} from "lucide-react";
import { outputsApi, EmbeddingData } from "@/lib/api/outputs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function EmbeddingsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [embeddingData, setEmbeddingData] = useState<EmbeddingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
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

  // Render 2D visualization using t-SNE-like projection
  useEffect(() => {
    if (!canvasRef.current || !embeddingData || !embeddingData.embeddings?.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Simple 2D projection using first 2 principal components
    const vectors = embeddingData.embeddings;
    if (vectors.length === 0) return;

    // Calculate bounds for normalization
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

    // Draw points
    const padding = 50;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    ctx.save();
    ctx.scale(zoom, zoom);

    // Draw grid
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

    // Color by IFC class
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

    // Draw points
    points.forEach((point) => {
      const x = padding + ((point.x - minX) / rangeX) * width;
      const y = padding + ((point.y - minY) / rangeY) * height;

      const color = classColors[point.ifc_class] || "#94a3b8";

      ctx.beginPath();
      ctx.arc(x / zoom, y / zoom, 6, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
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
            Back to Outputs
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Embeddings Visualization</h1>
          <p className="text-muted-foreground">
            2D projection of BIM element vector representations
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export NPY
        </Button>
      </div>

      {/* Stats */}
      {embeddingData && (
        <div className="flex gap-4">
          <Badge variant="secondary" className="text-sm">
            {embeddingData.embeddings?.length || 0} Vectors
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {embeddingData.dimension} Dimensions
          </Badge>
          <Badge variant="outline" className="text-sm">
            Model: {embeddingData.model_name}
          </Badge>
        </div>
      )}

      {/* Visualization */}
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-medium">2D Projection (PCA)</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center text-sm">{Math.round(zoom * 100)}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setZoom(1)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative overflow-auto bg-slate-50" style={{ height: "500px" }}>
              <canvas
                ref={canvasRef}
                width={800}
                height={500}
                className="w-full"
              />
              {(!embeddingData || !embeddingData.embeddings?.length) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Box className="mx-auto h-12 w-12 opacity-30" />
                    <p className="mt-2">No embedding data available</p>
                    <p className="text-sm">Run the pipeline to generate embeddings</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Color Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { class: "IfcWall", color: "#3b82f6" },
                { class: "IfcSlab", color: "#10b981" },
                { class: "IfcBeam", color: "#f59e0b" },
                { class: "IfcColumn", color: "#ef4444" },
                { class: "IfcDoor", color: "#8b5cf6" },
                { class: "IfcWindow", color: "#06b6d4" },
                { class: "IfcRailing", color: "#ec4899" },
                { class: "IfcFooting", color: "#6366f1" },
              ].map(({ class: cls, color }) => (
                <div key={cls} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs">{cls}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                About Embeddings
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                Embeddings are dense vector representations of BIM elements that capture
                semantic meaning.
              </p>
              <p>
                <strong>Model:</strong> Sentence Transformer (all-MiniLM-L6-v2)
              </p>
              <p>
                <strong>Use Cases:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Similarity search</li>
                <li>Clustering</li>
                <li>RAG retrieval</li>
                <li>ML features</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
