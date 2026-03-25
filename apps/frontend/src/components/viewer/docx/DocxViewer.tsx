"use client";

import React, { useState, useEffect } from "react";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";

interface DocParagraph {
  text: string;
  style?: string;
  alignment?: "left" | "center" | "right" | "justify";
  runs: DocRun[];
  indent?: number;
  spacing?: { before?: number; after?: number; line?: number };
  numbering?: string;
}

interface DocRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  highlight?: string;
}

interface DocTable {
  rows: DocTableRow[];
}

interface DocTableRow {
  cells: DocTableCell[];
}

interface DocTableCell {
  paragraphs: DocParagraph[];
  colspan?: number;
  shading?: string;
}

type DocElement = { type: "paragraph"; data: DocParagraph } | { type: "table"; data: DocTable };

interface Props {
  url: string;
}

export function DocxDocViewer({ url }: Props) {
  const [elements, setElements] = useState<DocElement[]>([]);
  const [images, setImages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.9);

  useEffect(() => {
    loadDocx();
  }, [url]);

  const loadDocx = async () => {
    try {
      const JSZip = (await import("jszip")).default;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);

      // Extract images
      const imgMap = new Map<string, string>();
      for (const [path, file] of Object.entries(zip.files)) {
        if (path.startsWith("word/media/") && !file.dir) {
          const ext = path.split(".").pop()?.toLowerCase() || "png";
          const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif" }[ext] || "image/png";
          const data = await file.async("base64");
          const name = path.split("/").pop() || "";
          imgMap.set(name, `data:${mime};base64,${data}`);
        }
      }
      setImages(imgMap);

      // Parse document.xml
      const docXml = zip.files["word/document.xml"];
      if (!docXml) throw new Error("No document.xml found");

      const xml = await docXml.async("text");
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const body = doc.querySelector("body") || doc.documentElement;

      const parsed: DocElement[] = [];

      // Process all children of body
      for (let i = 0; i < body.children.length; i++) {
        const el = body.children[i];
        const tag = el.localName || el.tagName.split(":").pop() || "";

        if (tag === "p") {
          parsed.push({ type: "paragraph", data: parseParagraph(el) });
        } else if (tag === "tbl") {
          parsed.push({ type: "table", data: parseTable(el) });
        }
      }

      setElements(parsed);
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
        <span className="text-sm text-muted-foreground">Loading DOCX...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-600 p-4 bg-red-50 rounded-lg">{error}</div>;
  }

  return (
    <div className="rounded-lg border overflow-hidden bg-slate-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-indigo-700 text-white px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium">DOCX Viewer</span>
          <span className="text-indigo-200">{elements.length} elements</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} className="p-1 hover:bg-indigo-600 rounded"><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="p-1 hover:bg-indigo-600 rounded"><ZoomIn className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Document */}
      <div className="overflow-auto p-4" style={{ maxHeight: "600px" }}>
        <div
          className="mx-auto bg-white shadow-lg rounded-sm"
          style={{
            width: `${595 * zoom}px`,
            minHeight: `${842 * zoom}px`,
            padding: `${56 * zoom}px`,
          }}
        >
          <div style={{ zoom }}>
            {elements.map((el, i) => {
              if (el.type === "paragraph") return <RenderDocParagraph key={i} para={el.data} />;
              if (el.type === "table") return <RenderDocTable key={i} table={el.data} />;
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// === PARSING ===

function parseParagraph(pEl: Element): DocParagraph {
  const runs: DocRun[] = [];
  let alignment: DocParagraph["alignment"] = "left";
  let indent = 0;
  let numbering = "";
  let style = "";
  let spacingBefore = 0;
  let spacingAfter = 0;

  // Properties
  const pPr = pEl.querySelector("pPr");
  if (pPr) {
    const jc = pPr.querySelector("jc");
    if (jc) {
      const val = jc.getAttribute("w:val") || jc.getAttribute("val") || "";
      const map: Record<string, DocParagraph["alignment"]> = { left: "left", center: "center", right: "right", both: "justify", justify: "justify" };
      alignment = map[val] || "left";
    }

    const pStyle = pPr.querySelector("pStyle");
    if (pStyle) style = pStyle.getAttribute("w:val") || pStyle.getAttribute("val") || "";

    const indEl = pPr.querySelector("ind");
    if (indEl) {
      const left = indEl.getAttribute("w:left") || indEl.getAttribute("left") || "0";
      indent = Math.round(parseInt(left, 10) / 20);
    }

    const spacing = pPr.querySelector("spacing");
    if (spacing) {
      const before = spacing.getAttribute("w:before") || spacing.getAttribute("before");
      const after = spacing.getAttribute("w:after") || spacing.getAttribute("after");
      if (before) spacingBefore = Math.round(parseInt(before, 10) / 20);
      if (after) spacingAfter = Math.round(parseInt(after, 10) / 20);
    }

    const numPr = pPr.querySelector("numPr");
    if (numPr) {
      const ilvl = numPr.querySelector("ilvl");
      const level = ilvl ? parseInt(ilvl.getAttribute("w:val") || ilvl.getAttribute("val") || "0", 10) : 0;
      numbering = level === 0 ? "• " : "  ".repeat(level) + "- ";
    }
  }

  // Runs
  const rElements = pEl.querySelectorAll(":scope > r, :scope > w\\:r");
  rElements.forEach((r) => {
    const tEl = r.querySelector("t");
    if (!tEl?.textContent) return;

    const run: DocRun = { text: tEl.textContent };
    const rPr = r.querySelector("rPr");
    if (rPr) {
      if (rPr.querySelector("b")) run.bold = true;
      if (rPr.querySelector("i")) run.italic = true;
      if (rPr.querySelector("u")) run.underline = true;
      if (rPr.querySelector("strike")) run.strike = true;

      const sz = rPr.querySelector("sz");
      if (sz) {
        const val = sz.getAttribute("w:val") || sz.getAttribute("val") || "24";
        run.fontSize = parseInt(val, 10) / 2;
      }

      const rFonts = rPr.querySelector("rFonts");
      if (rFonts) {
        run.fontFamily = rFonts.getAttribute("w:eastAsia") || rFonts.getAttribute("w:ascii") || rFonts.getAttribute("eastAsia") || rFonts.getAttribute("ascii") || undefined;
      }

      const color = rPr.querySelector("color");
      if (color) {
        const val = color.getAttribute("w:val") || color.getAttribute("val") || "";
        if (val && val !== "auto" && val !== "000000") run.color = `#${val}`;
      }

      const highlight = rPr.querySelector("highlight");
      if (highlight) {
        run.highlight = highlight.getAttribute("w:val") || highlight.getAttribute("val") || undefined;
      }
    }
    runs.push(run);
  });

  // Fallback: direct t tags
  if (runs.length === 0) {
    const tElements = pEl.querySelectorAll("t");
    tElements.forEach((t) => {
      if (t.textContent?.trim()) runs.push({ text: t.textContent });
    });
  }

  const text = runs.map((r) => r.text).join("");

  return { text, runs, alignment, indent, style, numbering, spacing: { before: spacingBefore, after: spacingAfter } };
}

function parseTable(tblEl: Element): DocTable {
  const rows: DocTableRow[] = [];
  const trElements = tblEl.querySelectorAll(":scope > tr, :scope > w\\:tr");

  trElements.forEach((tr) => {
    const cells: DocTableCell[] = [];
    const tcElements = tr.querySelectorAll(":scope > tc, :scope > w\\:tc");

    tcElements.forEach((tc) => {
      const paragraphs: DocParagraph[] = [];
      const pElements = tc.querySelectorAll(":scope > p, :scope > w\\:p");
      pElements.forEach((p) => paragraphs.push(parseParagraph(p)));

      const tcPr = tc.querySelector("tcPr");
      let colspan = 1;
      let shading = "";
      if (tcPr) {
        const gridSpan = tcPr.querySelector("gridSpan");
        if (gridSpan) colspan = parseInt(gridSpan.getAttribute("w:val") || gridSpan.getAttribute("val") || "1", 10);
        const shd = tcPr.querySelector("shd");
        if (shd) {
          const fill = shd.getAttribute("w:fill") || shd.getAttribute("fill") || "";
          if (fill && fill !== "auto") shading = `#${fill}`;
        }
      }

      cells.push({ paragraphs, colspan, shading });
    });

    if (cells.length > 0) rows.push({ cells });
  });

  return { rows };
}

// === RENDERING ===

const RenderDocParagraph = React.memo(function RenderDocParagraph({ para }: { para: DocParagraph }) {
  if (para.runs.length === 0 && !para.numbering) {
    return <div style={{ minHeight: "0.8em" }} />;
  }

  const isHeading = para.style?.startsWith("Heading") || para.style?.includes("heading");
  const headingLevel = isHeading ? parseInt(para.style?.replace(/\D/g, "") || "1", 10) : 0;

  const style: React.CSSProperties = {
    textAlign: para.alignment || "left",
    marginTop: `${(para.spacing?.before || 0) + (isHeading ? 8 : 0)}px`,
    marginBottom: `${(para.spacing?.after || 2)}px`,
    paddingLeft: para.indent ? `${para.indent}px` : undefined,
    lineHeight: 1.6,
    fontSize: isHeading ? `${Math.max(20 - headingLevel * 2, 12)}px` : undefined,
    fontWeight: isHeading ? "bold" : undefined,
    borderBottom: headingLevel === 1 ? "1px solid #e5e7eb" : undefined,
    paddingBottom: headingLevel === 1 ? "4px" : undefined,
  };

  return (
    <p style={style}>
      {para.numbering && <span>{para.numbering}</span>}
      {para.runs.map((run, i) => (
        <RenderDocRun key={i} run={run} />
      ))}
    </p>
  );
});

const RenderDocRun = React.memo(function RenderDocRun({ run }: { run: DocRun }) {
  const style: React.CSSProperties = {
    fontWeight: run.bold ? "bold" : undefined,
    fontStyle: run.italic ? "italic" : undefined,
    textDecoration: [run.underline ? "underline" : "", run.strike ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
    fontSize: run.fontSize ? `${run.fontSize}pt` : undefined,
    fontFamily: run.fontFamily || undefined,
    color: run.color || undefined,
    backgroundColor: run.highlight ? highlightColor(run.highlight) : undefined,
  };

  const hasStyle = Object.values(style).some(Boolean);
  return hasStyle ? <span style={style}>{run.text}</span> : <>{run.text}</>;
});

function RenderDocTable({ table }: { table: DocTable }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0", fontSize: "10px" }}>
      <tbody>
        {table.rows.map((row, ri) => (
          <tr key={ri}>
            {row.cells.map((cell, ci) => (
              <td
                key={ci}
                colSpan={cell.colspan || 1}
                style={{
                  border: "1px solid #ccc",
                  padding: "4px 6px",
                  verticalAlign: "top",
                  backgroundColor: cell.shading || undefined,
                }}
              >
                {cell.paragraphs.map((p, pi) => (
                  <RenderDocParagraph key={pi} para={p} />
                ))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function highlightColor(name: string): string {
  const map: Record<string, string> = {
    yellow: "#ffff00", green: "#00ff00", cyan: "#00ffff", magenta: "#ff00ff",
    blue: "#0000ff", red: "#ff0000", darkBlue: "#000080", darkCyan: "#008080",
    darkGreen: "#008000", darkMagenta: "#800080", darkRed: "#800000", darkYellow: "#808000",
    darkGray: "#808080", lightGray: "#c0c0c0", black: "#000000",
  };
  return map[name] || "#ffff00";
}
