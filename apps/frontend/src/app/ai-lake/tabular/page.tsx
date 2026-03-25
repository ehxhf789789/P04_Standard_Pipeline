"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, Search, ArrowUpDown, Filter, X } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import apiClient from "@/lib/api/client";

export default function TabularPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [isoFilter, setIsoFilter] = useState("all");

  useEffect(() => {
    apiClient.get("/query/ai-data/tabular").then(({ data }) => setTables(data.tables || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  // ISO standard codes detected per table
  const isoStandards = useMemo(() => {
    const codes = new Set<string>();
    tables.forEach((t) => {
      const src = (t.source || "").toLowerCase();
      const headers = (t.headers || []).join(" ").toLowerCase();
      const combined = src + " " + headers;
      if (combined.includes("ifc") || combined.includes("16739")) codes.add("ISO 16739");
      if (combined.includes("bsdd") || combined.includes("23386")) codes.add("ISO 23386");
      if (combined.includes("loin") || combined.includes("7817")) codes.add("ISO 7817");
      if (combined.includes("ids")) codes.add("IDS 1.0");
      if (combined.includes("19650") || combined.includes("cde")) codes.add("ISO 19650");
      if (combined.includes("cobie") || combined.includes("asset")) codes.add("COBie");
      if (combined.includes("55000") || combined.includes("maintenance")) codes.add("ISO 55000");
    });
    if (codes.size === 0) codes.add("General");
    return [...codes].sort();
  }, [tables]);

  const filteredTables = useMemo(() => {
    let result = tables;
    if (phaseFilter !== "all") result = result.filter((t) => t.phase === phaseFilter || !t.phase);
    if (isoFilter !== "all") {
      result = result.filter((t) => {
        const combined = ((t.source || "") + " " + (t.headers || []).join(" ")).toLowerCase();
        const code = isoFilter.toLowerCase();
        return combined.includes(code.replace("iso ", "").replace(" ", ""));
      });
    }
    return result;
  }, [tables, phaseFilter, isoFilter]);

  const currentTable = filteredTables[selectedTable] || null;

  const filteredRows = useMemo(() => {
    if (!currentTable) return [];
    let rows = [...(currentTable.rows || [])];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((row: string[]) => row.some((cell) => String(cell).toLowerCase().includes(q)));
    }
    if (sortCol !== null) {
      rows.sort((a: string[], b: string[]) => {
        const va = String(a[sortCol] || "");
        const vb = String(b[sortCol] || "");
        const na = parseFloat(va), nb = parseFloat(vb);
        if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return rows;
  }, [currentTable, searchQuery, sortCol, sortAsc]);

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) setSortAsc(!sortAsc);
    else { setSortCol(colIdx); setSortAsc(true); }
  };

  const handleExportCSV = () => {
    if (!currentTable) return;
    const headers = currentTable.headers || [];
    const csvRows = [headers.join(","), ...filteredRows.map((r: string[]) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${currentTable.source || "table"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const phases = [...new Set(tables.map((t) => t.phase || "unassigned"))];

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/ai-lake" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"><ArrowLeft className="h-3 w-3" /> AI Data Lake</Link>
          <h1 className="text-2xl font-bold">{L ? "정형 데이터셋" : "Tabular Datasets"}</h1>
          <p className="text-sm text-muted-foreground">{filteredTables.length} {L ? "테이블" : "tables"} / {filteredRows.length} {L ? "행" : "rows"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} disabled={!currentTable} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={() => {
            if (!currentTable) return;
            const blob = new Blob([JSON.stringify(currentTable, null, 2)], { type: "application/json" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${currentTable.source || "table"}.json`; a.click();
          }} disabled={!currentTable} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> JSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border rounded-md px-2 py-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select value={phaseFilter} onChange={(e) => { setPhaseFilter(e.target.value); setSelectedTable(0); }} className="text-xs bg-transparent border-0 focus:outline-none">
            <option value="all">{L ? "전체 단계" : "All phases"}</option>
            {phases.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border rounded-md px-2 py-1">
          <Filter className="h-3.5 w-3.5 text-emerald-500" />
          <select value={isoFilter} onChange={(e) => { setIsoFilter(e.target.value); setSelectedTable(0); }} className="text-xs bg-transparent border-0 focus:outline-none">
            <option value="all">{L ? "전체 표준" : "All standards"}</option>
            {isoStandards.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 bg-white border rounded-md px-2 py-1 flex-1 max-w-xs">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={L ? "행 검색..." : "Search rows..."} className="text-xs bg-transparent border-0 focus:outline-none flex-1" />
          {searchQuery && <button onClick={() => setSearchQuery("")}><X className="h-3 w-3 text-muted-foreground" /></button>}
        </div>
      </div>

      {filteredTables.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">{L ? "추출된 테이블이 없습니다" : "No tables extracted"}</p>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {filteredTables.map((t, i) => (
              <button key={i} onClick={() => { setSelectedTable(i); setSortCol(null); setSearchQuery(""); }} className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-medium rounded-md ${selectedTable === i ? "bg-emerald-600 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>
                {t.source || `Table ${i + 1}`} {t.sheet && `(${t.sheet})`}
                <span className="ml-1 text-[9px] opacity-70">{t.row_count || 0}r</span>
              </button>
            ))}
          </div>

          {currentTable && (
            <div className="rounded-lg border bg-white overflow-auto" style={{ maxHeight: "500px" }}>
              <table className="w-full text-xs border-collapse">
                {currentTable.headers?.length > 0 && (
                  <thead className="sticky top-0 bg-slate-100 z-10">
                    <tr>
                      <th className="px-2 py-1.5 border text-center text-slate-400 w-8">#</th>
                      {currentTable.headers.map((h: string, hi: number) => (
                        <th key={hi} onClick={() => handleSort(hi)} className="px-3 py-1.5 border text-left font-semibold cursor-pointer hover:bg-slate-200 select-none">
                          <span className="flex items-center gap-1">
                            {h || "-"}
                            {sortCol === hi && <ArrowUpDown className="h-3 w-3 text-emerald-600" />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {filteredRows.map((row: string[], ri: number) => (
                    <tr key={ri} className="hover:bg-emerald-50/50">
                      <td className="px-2 py-1 border text-center text-slate-400">{ri + 1}</td>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-1 border max-w-[200px] truncate" title={String(cell)}>{cell || "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
