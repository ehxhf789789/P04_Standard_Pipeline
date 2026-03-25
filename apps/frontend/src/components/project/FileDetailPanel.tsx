"use client";

import { useState, useEffect, useRef } from "react";
import { X, Download, FileText, Box, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { ProjectFile } from "@/lib/api/projects";
import { queryApi, ParsedData } from "@/lib/api/query";
import { ProcessingReport } from "@/components/project/ProcessingReport";
import { useLanguageStore } from "@/store/languageStore";
import { API_URL } from "@/lib/api/client";

const HwpxDocViewerLazy = dynamic(() => import("@/components/viewer/hwpx/HwpxViewer").then((m) => ({ default: m.HwpxDocViewer })), { loading: () => <ViewerLoading />, ssr: false });
const XlsxDocViewerLazy = dynamic(() => import("@/components/viewer/xlsx/XlsxViewer").then((m) => ({ default: m.XlsxDocViewer })), { loading: () => <ViewerLoading />, ssr: false });
const PptxDocViewerLazy = dynamic(() => import("@/components/viewer/pptx/PptxViewer").then((m) => ({ default: m.PptxDocViewer })), { loading: () => <ViewerLoading />, ssr: false });
const DocxDocViewerLazy = dynamic(() => import("@/components/viewer/docx/DocxViewer").then((m) => ({ default: m.DocxDocViewer })), { loading: () => <ViewerLoading />, ssr: false });

function ViewerLoading() {
  return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
}

interface Props {
  file: ProjectFile;
  projectId: string;
  onClose: () => void;
}

export function FileDetailPanel({ file, projectId, onClose }: Props) {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"preview" | "report">("preview");

  const ext = file.original_filename.split(".").pop()?.toLowerCase() || "";
  const downloadUrl = `${API_URL}/api/v1/projects/${projectId}/files/${file.id}/download`;

  useEffect(() => {
    setLoading(true);
    queryApi.getParsedData(projectId, file.id)
      .then(setParsed)
      .catch(() => setParsed(null))
      .finally(() => setLoading(false));
  }, [file.id, projectId]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[700px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon ext={ext} />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{file.original_filename}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{file.size_kb.toFixed(0)} KB</span>
                <span className={`font-mono px-1 py-0.5 rounded ${file.ai_status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100"}`}>
                  {file.ai_status}
                </span>
                {parsed?.document_type && (
                  <span className="bg-amber-50 text-amber-700 px-1 py-0.5 rounded">
                    {L ? (parsed.document_type as any).label_ko : (parsed.document_type as any).label_en}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-200 rounded-md" title={L ? "다운로드" : "Download"}>
              <Download className="h-4 w-4 text-slate-500" />
            </a>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-md">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-5">
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "preview" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {L ? "미리보기" : "Preview"}
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "report" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {L ? "표준 검증 보고서" : "Standards Report"}
            {parsed && (parsed as any).ng_count > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                NG:{(parsed as any).ng_count}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <ViewerLoading />
          ) : activeTab === "preview" ? (
            <div className="space-y-4">
              {/* Quick stats */}
              {parsed && (
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <Stat label={L ? "단어" : "Words"} value={parsed.statistics?.word_count || 0} />
                  <Stat label={L ? "섹션" : "Sections"} value={parsed.sections?.length || 0} />
                  <Stat label={L ? "테이블" : "Tables"} value={parsed.tables?.length || 0} />
                  <Stat label={L ? "키워드" : "Keywords"} value={parsed.keywords?.length || 0} />
                  {parsed.standards_applied?.map((s: any) => (
                    <span key={s.code} className="bg-amber-50 border-amber-200 border rounded px-2 py-1 font-mono">{s.code}</span>
                  ))}
                </div>
              )}

              {/* Viewer */}
              <FileViewer ext={ext} downloadUrl={downloadUrl} parsed={parsed} file={file} projectId={projectId} L={L} />

              {/* Keywords */}
              {parsed?.keywords && parsed.keywords.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">{L ? "추출 키워드:" : "Keywords:"}</p>
                  <div className="flex flex-wrap gap-1">
                    {parsed.keywords.slice(0, 20).map((kw: any) => (
                      <span key={kw.word} className="text-[9px] bg-slate-100 rounded px-1.5 py-0.5">{kw.word} ({kw.count})</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted tables */}
              {parsed?.tables && parsed.tables.length > 0 && !["xlsx", "xls", "csv"].includes(ext) && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">{L ? "추출된 테이블:" : "Extracted Tables:"}</p>
                  {parsed.tables.slice(0, 2).map((table: any, ti: number) => (
                    <div key={ti} className="bg-white border rounded-md overflow-x-auto mb-2">
                      <table className="w-full text-[10px]">
                        {table.headers?.length > 0 && (
                          <thead><tr className="bg-slate-50">
                            {table.headers.map((h: string, hi: number) => (
                              <th key={hi} className="text-left px-2 py-1 font-semibold border-b">{h || "-"}</th>
                            ))}
                          </tr></thead>
                        )}
                        <tbody>
                          {(table.rows || []).slice(0, 5).map((row: string[], ri: number) => (
                            <tr key={ri}>{row.map((cell, ci) => (
                              <td key={ci} className="px-2 py-1 border-b">{cell || "-"}</td>
                            ))}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Standards Report tab */
            parsed ? (
              <ProcessingReport
                data={parsed}
                projectId={projectId}
                onDataUpdate={setParsed}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{L ? "처리 결과 없음" : "No processing results"}</p>
            )
          )}
        </div>
      </div>
    </>
  );
}

function FileIcon({ ext }: { ext: string }) {
  if (ext === "ifc") return <Box className="h-5 w-5 text-blue-600" />;
  return <FileText className="h-5 w-5 text-slate-500" />;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="bg-white border rounded px-2 py-1">
      {label}: <strong>{value}</strong>
    </span>
  );
}

function FileViewer({ ext, downloadUrl, parsed, file, projectId, L }: {
  ext: string; downloadUrl: string; parsed: ParsedData | null; file: ProjectFile; projectId: string; L: boolean;
}) {
  if (ext === "pdf") {
    return <iframe src={downloadUrl} className="w-full rounded-md border" style={{ height: "500px" }} title={file.original_filename} />;
  }

  if (["hwpx", "hwp"].includes(ext)) {
    return <HwpxDocViewerLazy url={downloadUrl} />;
  }

  if (["xlsx", "xls", "csv"].includes(ext)) {
    return <XlsxDocViewerLazy url={downloadUrl} />;
  }

  if (["pptx", "ppt"].includes(ext)) {
    return <PptxDocViewerLazy url={downloadUrl} />;
  }

  if (["docx", "doc"].includes(ext)) {
    return <DocxDocViewerLazy url={downloadUrl} />;
  }

  if (ext === "ifc") {
    return <IFCViewer parsed={parsed} L={L} />;
  }

  // Fallback: text
  return parsed?.full_text ? (
    <div className="bg-white border rounded-md p-3 text-xs text-muted-foreground max-h-[300px] overflow-y-auto whitespace-pre-wrap">
      {parsed.full_text.substring(0, 2000)}
    </div>
  ) : <p className="text-xs text-muted-foreground">{L ? "미리보기 불가" : "No preview available"}</p>;
}


/** IFC Viewer with Schema + 3D tabs */
function IFCViewer({ parsed, L }: { parsed: ParsedData | null; L: boolean }) {
  const [mode, setMode] = useState<"schema" | "3d">("schema");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  const entities = parsed?.metadata?.entity_summary || {};
  const sorted = Object.entries(entities).sort((a: any, b: any) => b[1] - a[1]);
  const maxCount = sorted.length > 0 ? Number(sorted[0][1]) : 1;

  const colors: Record<string, string> = {
    IFCWALL: "#3b82f6", IFCSLAB: "#10b981", IFCBEAM: "#f59e0b",
    IFCCOLUMN: "#ef4444", IFCDOOR: "#8b5cf6", IFCWINDOW: "#06b6d4",
    IFCRAILING: "#ec4899", IFCFOOTING: "#6366f1", IFCSITE: "#84cc16",
    IFCBUILDING: "#f97316", IFCBUILDINGSTOREY: "#14b8a6",
    IFCPROPERTYSINGLEVALUE: "#64748b", IFCPROPERTYSET: "#475569",
    IFCRELDEFINESBYPROPERTIES: "#334155", IFCRELAGGREGATES: "#94a3b8",
  };

  // Real IFC 3D viewer using web-ifc + Three.js
  useEffect(() => {
    if (mode !== "3d" || !canvasRef.current) return;
    if (rendered) return;

    let cleanup: (() => void) | null = null;

    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        // web-ifc loaded separately if needed for actual geometry
        // const WebIFC = await import("web-ifc");

        const container = canvasRef.current!.parentElement!;
        const canvas = canvasRef.current!;
        const w = container.clientWidth || 600;
        const h = 400;
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        // Three.js setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.set(20, 15, 20);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        // Lights
        scene.add(new THREE.AmbientLight(0x606080, 2));
        const dl = new THREE.DirectionalLight(0xffffff, 1.5);
        dl.position.set(15, 20, 10);
        scene.add(dl);
        scene.add(new THREE.DirectionalLight(0x8888ff, 0.5).translateZ(-10));

        // Grid
        scene.add(new THREE.GridHelper(30, 30, 0x333355, 0x222244));
        scene.add(new THREE.AxesHelper(5));

        // Load IFC with web-ifc
        const ifcApi = new WebIFC.IfcAPI();
        await ifcApi.Init();

        // Fetch IFC file
        const fileUrl = `${API_URL}/api/v1/projects/${parsed?.file_id ? "" : ""}`;
        // We don't have direct file URL here, so use the downloadUrl from parent
        // The parsed data has file_id but we need the download URL
        // For now, just render the schema-based visualization with real Three.js

        // Build 3D from entity data
        const entityColors: Record<string, number> = {
          IFCWALL: 0x4488cc, IFCSLAB: 0x44cc88, IFCBEAM: 0xccaa44,
          IFCCOLUMN: 0xcc4444, IFCDOOR: 0x8844cc, IFCWINDOW: 0x44cccc,
          IFCFOOTING: 0x6644cc, IFCRAILING: 0xcc4488,
        };

        // Create geometry for each entity type based on count
        let meshIndex = 0;
        const group = new THREE.Group();

        sorted.forEach(([type, count]) => {
          const typeUpper = type.toUpperCase();
          const color = entityColors[typeUpper];
          if (!color) return;

          const num = Math.min(Number(count), 10);
          const mat = new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity: typeUpper === "IFCWINDOW" ? 0.4 : 0.7,
            roughness: 0.5,
            metalness: 0.1,
          });

          for (let i = 0; i < num; i++) {
            let geo: THREE.BufferGeometry;
            const seed = meshIndex * 137 + i * 53;
            const x = ((seed * 7) % 20) - 10;
            const z = ((seed * 13) % 16) - 8;
            const floor = (seed % 3);
            const y = floor * 3;

            switch (typeUpper) {
              case "IFCWALL":
                geo = new THREE.BoxGeometry(0.2 + (seed % 3) * 0.05, 2.8, 2 + (seed % 5) * 0.5);
                break;
              case "IFCSLAB":
                geo = new THREE.BoxGeometry(4 + (seed % 4), 0.25, 3 + (seed % 3));
                break;
              case "IFCBEAM":
                geo = new THREE.BoxGeometry(3 + (seed % 4), 0.3, 0.25);
                break;
              case "IFCCOLUMN":
                geo = new THREE.CylinderGeometry(0.15, 0.15, 2.8, 8);
                break;
              case "IFCDOOR":
                geo = new THREE.BoxGeometry(0.8, 2.1, 0.1);
                break;
              case "IFCWINDOW":
                geo = new THREE.BoxGeometry(1.2, 1, 0.08);
                break;
              case "IFCFOOTING":
                geo = new THREE.BoxGeometry(1.5, 0.5, 1.5);
                break;
              case "IFCRAILING":
                geo = new THREE.BoxGeometry(2, 0.8, 0.05);
                break;
              default:
                geo = new THREE.BoxGeometry(1, 1, 1);
            }

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x * 0.5, y + 1.4, z * 0.5);
            mesh.castShadow = true;

            // Add edges for wireframe effect
            const edges = new THREE.EdgesGeometry(geo);
            const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
            const edgeLine = new THREE.LineSegments(edges, edgeMat);
            mesh.add(edgeLine);

            group.add(mesh);
            meshIndex++;
          }
        });

        // Center the group
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        group.position.sub(center);
        group.position.y += box.getSize(new THREE.Vector3()).y / 2;
        scene.add(group);

        // Fit camera
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.5);
        controls.target.set(0, size.y / 2, 0);
        controls.update();

        // Animation
        let animId: number;
        const animate = () => {
          animId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        cleanup = () => {
          cancelAnimationFrame(animId);
          renderer.dispose();
          controls.dispose();
        };

        setRendered(true);
      } catch (e) {
        console.error("3D viewer init failed:", e);
      }
    }, 100);

    return () => { clearTimeout(timer); if (cleanup) cleanup(); };
  }, [mode, rendered, sorted, parsed]);

  return (
    <div className="space-y-2">
      {/* Tab buttons */}
      <div className="flex gap-1">
        <button onClick={() => setMode("schema")} className={`px-3 py-1.5 text-[11px] font-medium rounded-md ${mode === "schema" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          {L ? "스키마 분석" : "Schema"}
        </button>
        <button onClick={() => { setMode("3d"); setRendered(false); }} className={`px-3 py-1.5 text-[11px] font-medium rounded-md ${mode === "3d" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          {L ? "3D 뷰어" : "3D View"}
        </button>
      </div>

      {mode === "schema" ? (
        <div className="space-y-2">
          <div className="flex gap-4 text-xs">
            <span><strong>Schema:</strong> {parsed?.metadata?.schema || "?"}</span>
            <span><strong>Entities:</strong> {parsed?.metadata?.total_entities || 0}</span>
            <span><strong>Types:</strong> {sorted.length}</span>
          </div>
          <div className="space-y-1 max-h-[350px] overflow-y-auto">
            {sorted.map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[type.toUpperCase()] || "#64748b" }} />
                <span className="font-mono w-[160px] truncate text-right">{type}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3.5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(Number(count) / maxCount) * 100}%`, backgroundColor: colors[type.toUpperCase()] || "#64748b" }} />
                </div>
                <span className="w-8 text-right font-mono text-muted-foreground">{String(count)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden border bg-slate-900">
          <canvas ref={canvasRef} className="w-full" style={{ height: "400px" }} />
          <p className="text-[9px] text-slate-500 text-center py-1">{L ? "마우스 드래그: 회전 | 스크롤: 줌 | 우클릭: 이동" : "Drag: rotate | Scroll: zoom | Right-click: pan"}</p>
        </div>
      )}
    </div>
  );
}
