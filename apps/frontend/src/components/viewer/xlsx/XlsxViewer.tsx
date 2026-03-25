"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, ZoomIn, ZoomOut, Copy, Check } from "lucide-react";

interface SheetData {
  name: string;
  data: any[][];
  merges?: { s: { r: number; c: number }; e: { r: number; c: number } }[];
}

interface Props {
  url: string;
}

function colLabel(index: number): string {
  let label = "";
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export function XlsxDocViewer({ url }: Props) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const xlsxModule = await import("xlsx");
        const XLSX = xlsxModule.default || xlsxModule;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });

        const parsed: SheetData[] = wb.SheetNames.map((name: string) => {
          const ws = wb.Sheets[name];
          const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          const merges = ws["!merges"] || [];
          return { name, data: data.slice(0, 200), merges };
        });

        setSheets(parsed);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [url]);

  const handleCopy = useCallback(() => {
    if (!selectedCell || !sheets[activeSheet]) return;
    const val = sheets[activeSheet].data[selectedCell.r]?.[selectedCell.c] ?? "";
    navigator.clipboard.writeText(String(val));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [selectedCell, activeSheet, sheets]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c") handleCopy();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleCopy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-slate-100 rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading XLSX...</span>
      </div>
    );
  }

  if (error || sheets.length === 0) {
    return <div className="text-sm text-red-600 p-4 bg-red-50 rounded-lg">{error || "No data"}</div>;
  }

  const sheet = sheets[activeSheet];
  const maxCols = Math.max(...sheet.data.map((r) => r.length), 0);

  return (
    <div className="rounded-lg border overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-green-700 text-white px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium">XLSX Viewer</span>
          <span className="text-green-200">{sheet.data.length} rows × {maxCols} cols</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="p-1 hover:bg-green-600 rounded"><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="p-1 hover:bg-green-600 rounded"><ZoomIn className="h-3.5 w-3.5" /></button>
          {selectedCell && (
            <button onClick={handleCopy} className="p-1 hover:bg-green-600 rounded flex items-center gap-1">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex border-b bg-slate-50 overflow-x-auto">
          {sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => { setActiveSheet(i); setSelectedCell(null); }}
              className={`px-3 py-1.5 text-[11px] font-medium border-r whitespace-nowrap ${
                activeSheet === i ? "bg-white text-green-700 border-b-2 border-b-green-600" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Cell info bar */}
      {selectedCell && (
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border-b text-[10px]">
          <span className="font-mono font-bold text-green-700">{colLabel(selectedCell.c)}{selectedCell.r + 1}</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600 truncate">{String(sheet.data[selectedCell.r]?.[selectedCell.c] ?? "")}</span>
        </div>
      )}

      {/* Table */}
      <div ref={tableRef} className="overflow-auto" style={{ maxHeight: "500px" }}>
        <table style={{ borderCollapse: "collapse", fontSize: `${10 * zoom}px`, minWidth: "100%" }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ backgroundColor: "#f1f5f9" }}>
              <th style={{ ...thStyle, width: "40px", position: "sticky", left: 0, zIndex: 20, backgroundColor: "#e2e8f0" }}></th>
              {Array.from({ length: maxCols }).map((_, ci) => (
                <th key={ci} style={{ ...thStyle, minWidth: `${60 * zoom}px` }}>{colLabel(ci)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.data.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? "font-semibold" : ""}>
                <td style={{ ...rowHeaderStyle, position: "sticky", left: 0, zIndex: 5 }}>{ri + 1}</td>
                {Array.from({ length: maxCols }).map((_, ci) => {
                  const isSelected = selectedCell?.r === ri && selectedCell?.c === ci;
                  return (
                    <td
                      key={ci}
                      onClick={() => setSelectedCell({ r: ri, c: ci })}
                      style={{
                        ...cellStyle,
                        backgroundColor: isSelected ? "#dbeafe" : ri === 0 ? "#f0fdf4" : undefined,
                        outline: isSelected ? "2px solid #2563eb" : undefined,
                        outlineOffset: "-1px",
                        cursor: "cell",
                      }}
                    >
                      {formatCell(row[ci])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(val: any): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    if (Number.isInteger(val)) return val.toLocaleString();
    return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(val);
}

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "2px 6px",
  textAlign: "center",
  color: "#64748b",
  fontWeight: 600,
  fontSize: "9px",
  backgroundColor: "#f1f5f9",
};

const rowHeaderStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "2px 4px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 500,
  backgroundColor: "#f1f5f9",
  minWidth: "40px",
};

const cellStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  padding: "2px 6px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "200px",
};
