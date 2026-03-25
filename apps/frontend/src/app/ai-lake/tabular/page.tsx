"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Download } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import apiClient from "@/lib/api/client";

export default function TabularPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(0);

  useEffect(() => {
    apiClient.get("/query/ai-data/tabular")
      .then(({ data }) => setTables(data.tables || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <Link href="/ai-lake" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> AI Data Lake
        </Link>
        <h1 className="text-2xl font-bold">{L ? "정형 데이터셋" : "Tabular Datasets"}</h1>
        <p className="text-sm text-muted-foreground">{tables.length} {L ? "테이블" : "tables"}</p>
      </div>

      {tables.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">{L ? "추출된 테이블이 없습니다" : "No tables extracted"}</p>
      ) : (
        <>
          {/* Table selector */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {tables.map((t, i) => (
              <button key={i} onClick={() => setSelectedTable(i)} className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-medium rounded-md ${selectedTable === i ? "bg-emerald-600 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>
                {t.source || `Table ${i + 1}`} {t.sheet && `(${t.sheet})`}
              </button>
            ))}
          </div>

          {/* Table view */}
          {tables[selectedTable] && (
            <div className="rounded-lg border bg-white overflow-auto" style={{ maxHeight: "500px" }}>
              <table className="w-full text-xs border-collapse">
                {tables[selectedTable].headers?.length > 0 && (
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="px-2 py-1.5 border text-center text-slate-400 w-8">#</th>
                      {tables[selectedTable].headers.map((h: string, hi: number) => (
                        <th key={hi} className="px-3 py-1.5 border text-left font-semibold">{h || "-"}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {(tables[selectedTable].rows || []).map((row: string[], ri: number) => (
                    <tr key={ri} className="hover:bg-slate-50">
                      <td className="px-2 py-1 border text-center text-slate-400">{ri + 1}</td>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-1 border">{cell || "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-1.5 bg-slate-50 border-t text-[10px] text-muted-foreground">
                {L ? "소스:" : "Source:"} {tables[selectedTable].source} | {tables[selectedTable].row_count || 0} {L ? "행" : "rows"}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
