"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Info,
  RotateCcw,
} from "lucide-react";
import { outputsApi, KnowledgeGraphData, GraphNode } from "@/lib/api/outputs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function KnowledgeGraphPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<string, NodePosition>>(new Map());

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const data = await outputsApi.getKnowledgeGraph(projectId);
        setGraphData(data);
      } catch (e) {
        console.error("Failed to load knowledge graph:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGraph();
  }, [projectId]);

  // Initialize positions and run simulation
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const positions = new Map<string, NodePosition>();
    const nodeCount = graphData.nodes.length;
    const spreadRadius = Math.min(width, height) * 0.4;

    // Initialize with spread positions
    graphData.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodeCount;
      const r = spreadRadius * (0.5 + Math.random() * 0.5);
      positions.set(node.id, {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
        vx: 0,
        vy: 0,
      });
    });

    positionsRef.current = positions;
    setIsSimulating(true);

    // Force simulation
    let iteration = 0;
    const maxIterations = 150;

    const simulate = () => {
      if (iteration >= maxIterations) {
        setIsSimulating(false);
        render();
        return;
      }

      const alpha = Math.max(0.1, 1 - iteration / maxIterations);

      // Apply forces
      graphData.nodes.forEach((node1, i) => {
        const pos1 = positions.get(node1.id)!;

        // Repulsion from other nodes
        graphData.nodes.forEach((node2, j) => {
          if (i >= j) return;
          const pos2 = positions.get(node2.id)!;
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = 100;

          if (dist < minDist * 2) {
            const force = (5000 * alpha) / (dist * dist);
            pos1.vx += (dx / dist) * force;
            pos1.vy += (dy / dist) * force;
            pos2.vx -= (dx / dist) * force;
            pos2.vy -= (dy / dist) * force;
          }
        });

        // Center gravity
        pos1.vx += (centerX - pos1.x) * 0.01 * alpha;
        pos1.vy += (centerY - pos1.y) * 0.01 * alpha;
      });

      // Edge attraction
      graphData.edges.slice(0, 100).forEach((edge) => {
        const pos1 = positions.get(edge.source);
        const pos2 = positions.get(edge.target);
        if (!pos1 || !pos2) return;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 150) * 0.005 * alpha;

        pos1.vx += (dx / dist) * force;
        pos1.vy += (dy / dist) * force;
        pos2.vx -= (dx / dist) * force;
        pos2.vy -= (dy / dist) * force;
      });

      // Apply velocities with damping
      positions.forEach((pos) => {
        pos.vx *= 0.8;
        pos.vy *= 0.8;
        pos.x += pos.vx;
        pos.y += pos.vy;
        pos.x = Math.max(80, Math.min(width - 80, pos.x));
        pos.y = Math.max(80, Math.min(height - 80, pos.y));
      });

      iteration++;
      render();
      requestAnimationFrame(simulate);
    };

    simulate();
  }, [graphData]);

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const positions = positionsRef.current;

    // Clear
    ctx.fillStyle = "#fafbfc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.5 / zoom;
    for (let x = 0; x < canvas.width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Edges (limit for performance)
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 0.8 / zoom;
    graphData.edges.slice(0, 150).forEach((edge) => {
      const p1 = positions.get(edge.source);
      const p2 = positions.get(edge.target);
      if (!p1 || !p2) return;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    // Nodes
    const colors: Record<string, string> = {
      IfcWall: "#3b82f6",
      IfcSlab: "#10b981",
      IfcBeam: "#f59e0b",
      IfcColumn: "#ef4444",
      IfcDoor: "#8b5cf6",
      IfcWindow: "#06b6d4",
      IfcRailing: "#ec4899",
      IfcFooting: "#6366f1",
    };

    graphData.nodes.forEach((node) => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const isSelected = selectedNode?.id === node.id;
      const r = isSelected ? 14 : 10;

      // Shadow
      ctx.beginPath();
      ctx.arc(pos.x + 2, pos.y + 2, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fill();

      // Node
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#1d4ed8" : colors[node.type] || "#6366f1";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();

      // Label
      if (zoom > 0.6) {
        ctx.fillStyle = "#1f2937";
        ctx.font = `${Math.max(9, 11 / zoom)}px system-ui`;
        ctx.textAlign = "center";
        const label = node.label.length > 18 ? node.label.slice(0, 16) + "..." : node.label;
        ctx.fillText(label, pos.x, pos.y + r + 14 / zoom);
      }
    });

    ctx.restore();
  }, [graphData, selectedNode, zoom, offset]);

  useEffect(() => {
    if (!isSimulating) render();
  }, [render, zoom, offset, selectedNode, isSimulating]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Scale mouse coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.3, Math.min(4, zoom * delta));

    // Zoom towards mouse position
    const scale = newZoom / zoom;
    setOffset({
      x: mouseX - (mouseX - offset.x) * scale,
      y: mouseY - (mouseY - offset.y) * scale,
    });
    setZoom(newZoom);
  }, [zoom, offset]);

  // Drag to pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      setIsDragging(true);
      setDragStart({
        x: (e.clientX - rect.left) * scaleX - offset.x,
        y: (e.clientY - rect.top) * scaleY - offset.y,
      });
    }
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      setOffset({
        x: (e.clientX - rect.left) * scaleX - dragStart.x,
        y: (e.clientY - rect.top) * scaleY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // Click to select node
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !graphData || isDragging) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Scale mouse coordinates from displayed size to canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e.clientX - rect.left) * scaleX - offset.x) / zoom;
    const y = ((e.clientY - rect.top) * scaleY - offset.y) / zoom;

    for (const node of graphData.nodes) {
      const pos = positionsRef.current.get(node.id);
      if (!pos) continue;
      if (Math.hypot(x - pos.x, y - pos.y) < 18) {
        setSelectedNode(node);
        return;
      }
    }
    setSelectedNode(null);
  }, [graphData, zoom, offset, isDragging]);

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href={`/projects/${projectId}/outputs`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Outputs
          </Link>
          <h1 className="text-3xl font-bold">Knowledge Graph</h1>
          <p className="text-muted-foreground">BIM element relationships</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {graphData && (
        <div className="flex gap-4">
          <Badge variant="secondary">{graphData.statistics.nodes} Nodes</Badge>
          <Badge variant="secondary">{graphData.statistics.edges} Edges</Badge>
          {isSimulating && <Badge variant="outline">Calculating layout...</Badge>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3" ref={containerRef}>
          <Card className={isFullscreen ? "rounded-none h-screen" : ""}>
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <span className="text-sm text-muted-foreground">Scroll to zoom, drag to pan</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(0.3, z * 0.8))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-14 text-center text-sm">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(4, z * 1.25))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <canvas
              ref={canvasRef}
              width={1000}
              height={700}
              className="block mx-auto"
              style={{
                cursor: isDragging ? "grabbing" : "grab",
                width: "100%",
                maxWidth: "1000px",
                height: "auto",
                aspectRatio: "1000 / 700",
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleClick}
            />
          </Card>
        </div>

        {!isFullscreen && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{selectedNode ? "Node Details" : "Select a Node"}</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedNode ? (
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">ID</span>
                      <p className="font-mono text-xs break-all">{selectedNode.id}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Label</span>
                      <p className="font-medium">{selectedNode.label}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Type</span>
                      <Badge variant="outline" className="mt-1">{selectedNode.type}</Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Click on a node to view details</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p><strong>Scroll:</strong> Zoom</p>
                <p><strong>Drag:</strong> Pan</p>
                <p><strong>Click:</strong> Select node</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
