"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { parseSectionXml } from "./hwpxParser";
import type { HwpxDocument, HwpxSection, HwpxContentItem, HwpxParagraph, HwpxTextRun, HwpxTable, HwpxImage } from "./types";

interface Props {
  url: string;
}

export function HwpxDocViewer({ url }: Props) {
  const [doc, setDoc] = useState<HwpxDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDocument();
  }, [url]);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);
    try {
      const JSZip = (await import("jszip")).default;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);

      // Extract images
      const images = new Map<string, string>();
      for (const [path, file] of Object.entries(zip.files)) {
        if (file.dir) continue;
        if (path.startsWith("BinData/") || path.startsWith("bindata/")) {
          const data = await file.async("base64");
          const ext = path.split(".").pop()?.toLowerCase() || "png";
          const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml" };
          const mime = mimeMap[ext] || "image/png";
          const id = path.split("/").pop()?.split(".")[0] || path;
          images.set(id, `data:${mime};base64,${data}`);
        }
      }

      // Parse sections
      const sections: HwpxSection[] = [];
      const sectionFiles = Object.keys(zip.files)
        .filter((n) => /Contents\/section\d+\.xml/i.test(n))
        .sort();

      // Fallback: any XML in Contents/
      const xmlFiles = sectionFiles.length > 0 ? sectionFiles : Object.keys(zip.files).filter((n) => n.startsWith("Contents/") && n.endsWith(".xml")).sort();

      for (const filename of xmlFiles) {
        const xml = await zip.files[filename].async("text");
        try {
          const section = parseSectionXml(xml);
          if (section.content.length > 0) sections.push(section);
        } catch (e) {
          console.warn(`Failed to parse ${filename}:`, e);
        }
      }

      // Fallback: PrvText.txt
      if (sections.length === 0) {
        for (const key of ["Preview/PrvText.txt", "preview/PrvText.txt"]) {
          if (zip.files[key]) {
            const text = await zip.files[key].async("text");
            const paras: HwpxContentItem[] = text.split("\n")
              .filter((l) => l.trim())
              .map((l) => ({ type: "paragraph" as const, runs: [{ text: l.trim() }] }));
            sections.push({
              pageWidth: 595, pageHeight: 842,
              marginTop: 56, marginBottom: 56, marginLeft: 56, marginRight: 56,
              content: paras,
            });
            break;
          }
        }
      }

      setDoc({ sections, images });
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-slate-100 rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading HWPX...</span>
      </div>
    );
  }

  if (error || !doc) {
    return <div className="text-sm text-red-600 p-4 bg-red-50 rounded-lg">{error || "Failed to load"}</div>;
  }

  const allContent = doc.sections.flatMap((s) => s.content);
  const pageSection = doc.sections[0] || { pageWidth: 595, pageHeight: 842, marginTop: 56, marginBottom: 56, marginLeft: 56, marginRight: 56 };

  return (
    <div className="rounded-lg border overflow-hidden bg-slate-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-slate-700 text-white px-3 py-1.5 text-xs">
        <span className="font-medium">HWPX Viewer</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} className="p-1 hover:bg-slate-600 rounded"><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="p-1 hover:bg-slate-600 rounded"><ZoomIn className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Document */}
      <div ref={containerRef} className="overflow-auto p-4" style={{ maxHeight: "600px" }}>
        <div
          className="mx-auto bg-white shadow-lg rounded-sm"
          style={{
            width: `${pageSection.pageWidth * zoom}px`,
            minHeight: `${pageSection.pageHeight * zoom}px`,
            padding: `${pageSection.marginTop * zoom}px ${pageSection.marginRight * zoom}px ${pageSection.marginBottom * zoom}px ${pageSection.marginLeft * zoom}px`,
          }}
        >
          <div style={{ zoom }}>
            {allContent.map((item, i) => (
              <RenderItem key={i} item={item} images={doc.images} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// === RENDER COMPONENTS ===

function RenderItem({ item, images }: { item: HwpxContentItem; images: Map<string, string> }) {
  switch (item.type) {
    case "paragraph": return <RenderParagraph para={item} />;
    case "table": return <RenderTable table={item} images={images} />;
    case "image": return <RenderImage img={item} images={images} />;
    default: return null;
  }
}

const RenderParagraph = React.memo(function RenderParagraph({ para }: { para: HwpxParagraph }) {
  if (para.runs.length === 0 && !para.bulletText) {
    return <div style={{ minHeight: "1em" }} />;
  }

  const style: React.CSSProperties = {
    textAlign: (para.alignment as React.CSSProperties["textAlign"]) || "left",
    lineHeight: para.lineSpacing ? `${Math.max(para.lineSpacing / 100, 1.2)}` : "1.8",
    marginTop: para.marginTop ? `${para.marginTop}px` : "0",
    marginBottom: para.marginBottom ? `${para.marginBottom}px` : "2px",
    paddingLeft: para.indent ? `${para.indent}px` : undefined,
    textJustify: para.alignment === "justify" ? "inter-word" : undefined,
  };

  if (para.pageBreak) {
    style.pageBreakBefore = "always";
    style.borderTop = "1px dashed #ccc";
    style.marginTop = "16px";
    style.paddingTop = "16px";
  }

  return (
    <p style={style}>
      {para.bulletText && <span style={{ marginRight: "8px" }}>{para.bulletText}</span>}
      {para.runs.map((run, i) => (
        <RenderRun key={i} run={run} />
      ))}
    </p>
  );
});

const RenderRun = React.memo(function RenderRun({ run }: { run: HwpxTextRun }) {
  const style: React.CSSProperties = {
    fontWeight: run.bold ? "bold" : undefined,
    fontStyle: run.italic ? "italic" : undefined,
    textDecoration: [
      run.underline ? "underline" : "",
      run.strikethrough ? "line-through" : "",
    ].filter(Boolean).join(" ") || undefined,
    fontSize: run.fontSize ? `${run.fontSize}pt` : undefined,
    fontFamily: run.fontFamily || undefined,
    color: run.color || undefined,
    backgroundColor: run.backgroundColor || undefined,
    verticalAlign: run.superscript ? "super" : run.subscript ? "sub" : undefined,
  };

  const hasStyle = Object.values(style).some(Boolean);
  return hasStyle ? <span style={style}>{run.text}</span> : <>{run.text}</>;
});

const RenderTable = React.memo(function RenderTable({ table, images }: { table: HwpxTable; images: Map<string, string> }) {
  return (
    <div style={{ margin: "8px 0", overflowX: "auto" }}>
      {table.caption && <div style={{ fontSize: "9px", color: "#666", marginBottom: "4px" }}>{table.caption}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
        {table.colWidths && (
          <colgroup>
            {table.colWidths.map((w, i) => (
              <col key={i} style={{ width: `${w}px` }} />
            ))}
          </colgroup>
        )}
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {row.cells.map((cell, ci) => (
                <td
                  key={ci}
                  colSpan={cell.colspan || 1}
                  rowSpan={cell.rowspan || 1}
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 6px",
                    verticalAlign: cell.verticalAlign || "top",
                    backgroundColor: cell.backgroundColor || undefined,
                  }}
                >
                  {cell.content.map((p, pi) => (
                    <RenderParagraph key={pi} para={p} />
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

function RenderImage({ img, images }: { img: HwpxImage; images: Map<string, string> }) {
  const src = images.get(img.src) || img.src;
  if (!src || src === img.src) return null; // No resolved image

  return (
    <div style={{ textAlign: img.alignment || "center", margin: "8px 0" }}>
      <img
        src={src}
        alt={img.caption || ""}
        style={{
          maxWidth: "100%",
          width: img.width ? `${img.width}px` : "auto",
          height: img.height ? `${img.height}px` : "auto",
        }}
      />
      {img.caption && <div style={{ fontSize: "9px", color: "#666", marginTop: "4px" }}>{img.caption}</div>}
    </div>
  );
}
