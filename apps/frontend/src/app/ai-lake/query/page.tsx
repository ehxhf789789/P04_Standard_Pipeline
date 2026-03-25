"use client";

import { useState, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Search, Database, Play, Download, FileText, Cpu, GitBranch,
  BarChart3, Loader2, Copy, Check, Sparkles, ArrowRight, Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/store/languageStore";
import { queryApi, SearchResult } from "@/lib/api/query";

type QueryType = "natural" | "semantic" | "sql" | "sparql";

// NL → SQL/SPARQL conversion templates
const nlToQuery = (nlQuery: string, targetType: "sql" | "sparql"): string => {
  const q = nlQuery.toLowerCase();
  if (targetType === "sql") {
    if (q.includes("loin") || q.includes("기준") || q.includes("criteria"))
      return `SELECT e.element_id, e.element_type, e.name, v.loin_level, v.compliance_score\nFROM elements e\nJOIN validation_results v ON e.id = v.element_id\nWHERE v.compliance_score < 0.8\nORDER BY v.compliance_score ASC;`;
    if (q.includes("분류") || q.includes("classification") || q.includes("누락") || q.includes("missing"))
      return `SELECT e.element_id, e.element_type, e.name\nFROM elements e\nLEFT JOIN classifications c ON e.id = c.element_id\nWHERE c.classification_code IS NULL\nAND e.element_type IN ('IfcWall', 'IfcSlab', 'IfcBeam', 'IfcColumn');`;
    if (q.includes("벽") || q.includes("wall"))
      return `SELECT element_type, COUNT(*) as cnt, AVG(property_count) as avg_props\nFROM elements\nWHERE element_type LIKE '%Wall%'\nGROUP BY element_type\nORDER BY cnt DESC;`;
    if (q.includes("ai") || q.includes("변환") || q.includes("transform"))
      return `SELECT d.filename, d.lifecycle_phase, d.ai_status, d.processed_at,\n  d.keyword_count, d.table_count\nFROM documents d\nWHERE d.ai_status = 'completed'\nORDER BY d.processed_at DESC;`;
    if (q.includes("문서") || q.includes("파일") || q.includes("document") || q.includes("file"))
      return `SELECT d.filename, d.lifecycle_phase, d.file_size_kb, d.category,\n  d.ai_status, d.created_at\nFROM documents d\nORDER BY d.created_at DESC\nLIMIT 50;`;
    return `SELECT d.filename, d.lifecycle_phase, d.ai_status,\n  COUNT(k.word) as keyword_count\nFROM documents d\nLEFT JOIN keywords k ON d.id = k.document_id\nGROUP BY d.id\nORDER BY keyword_count DESC;`;
  } else {
    if (q.includes("벽") || q.includes("wall"))
      return `PREFIX ifc: <http://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2/OWL#>\nPREFIX bot: <https://w3id.org/bot#>\n\nSELECT ?wall ?name ?pset WHERE {\n  ?wall rdf:type ifc:IfcWall .\n  ?wall ifc:name ?name .\n  OPTIONAL { ?wall ifc:hasPropertySet ?pset }\n}`;
    if (q.includes("공간") || q.includes("space") || q.includes("area"))
      return `PREFIX ifc: <http://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2/OWL#>\nPREFIX bot: <https://w3id.org/bot#>\n\nSELECT ?space ?name ?area WHERE {\n  ?space rdf:type ifc:IfcSpace .\n  ?space ifc:name ?name .\n  OPTIONAL { ?space bot:hasArea ?area }\n}`;
    if (q.includes("관계") || q.includes("relation") || q.includes("연결"))
      return `PREFIX ifc: <http://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2/OWL#>\nPREFIX bot: <https://w3id.org/bot#>\n\nSELECT ?element ?type ?related ?relType WHERE {\n  ?element rdf:type ?type .\n  ?element ?relType ?related .\n  FILTER(?relType IN (bot:containsElement, ifc:relatedObjects))\n} LIMIT 100`;
    return `PREFIX ifc: <http://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2/OWL#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n\nSELECT ?element ?type ?label WHERE {\n  ?element rdf:type ?type .\n  OPTIONAL { ?element rdfs:label ?label }\n} LIMIT 50`;
  }
};

export default function AILakeQueryPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";

  const queryExamples: Record<QueryType, Record<string, string>[]> = {
    natural: [
      { ko: "설계 단계에서 LOIN 기준 미달인 요소는?", en: "Which elements fail LOIN criteria in the design phase?" },
      { ko: "시공 단계 IFC 모델에서 분류코드가 누락된 벽체 목록", en: "List walls missing classification codes in construction IFC models" },
      { ko: "유지관리 문서 중 AI 변환이 완료된 파일 현황", en: "Status of AI-transformed files among O&M documents" },
    ],
    semantic: [
      { ko: "외벽 단열 성능 기준을 충족하는 BIM 요소", en: "BIM elements meeting exterior wall insulation performance criteria" },
      { ko: "설계 단계 콘크리트 물량 산출 데이터", en: "Design phase concrete quantity calculation data" },
    ],
    sparql: [
      { ko: "SELECT ?element ?type WHERE { ?element rdf:type ifc:IfcWall . ?element ifc:hasPropertySet ?pset }", en: "SELECT ?element ?type WHERE { ?element rdf:type ifc:IfcWall . ?element ifc:hasPropertySet ?pset }" },
    ],
    sql: [
      { ko: "SELECT element_type, COUNT(*) FROM elements GROUP BY element_type ORDER BY COUNT(*) DESC", en: "SELECT element_type, COUNT(*) FROM elements GROUP BY element_type ORDER BY COUNT(*) DESC" },
    ],
  };

  const [queryType, setQueryType] = useState<QueryType>("natural");
  const [query, setQuery] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [generatedSPARQL, setGeneratedSPARQL] = useState("");
  const [showGenerated, setShowGenerated] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleQuery = async () => {
    if (!query.trim()) return;
    setIsQuerying(true);
    setHasSearched(true);
    try {
      const response = await queryApi.search(query);
      setResults(response.results);
    } catch (e) {
      console.error("Search failed:", e);
      setResults([]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleNLConvert = useCallback(() => {
    if (!query.trim() || queryType !== "natural") return;
    setIsConverting(true);
    // Simulate LLM conversion delay
    setTimeout(() => {
      setGeneratedSQL(nlToQuery(query, "sql"));
      setGeneratedSPARQL(nlToQuery(query, "sparql"));
      setShowGenerated(true);
      setIsConverting(false);
    }, 800);
  }, [query, queryType]);

  const handleUseGenerated = (type: "sql" | "sparql", code: string) => {
    setQueryType(type);
    setQuery(code);
    setShowGenerated(false);
  };

  const handleCopySnippet = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleExportResults = () => {
    if (results.length === 0) return;
    const csv = ["filename,lifecycle_phase,score,keywords,tables_count"];
    results.forEach((r) => csv.push(`"${r.filename}","${r.lifecycle_phase}",${r.score.toFixed(3)},"${r.keywords.join("; ")}",${r.tables_count}`));
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "query_results.csv"; a.click();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "embedding": return <Cpu className="h-4 w-4 text-violet-600" />;
      case "knowledge_graph": return <GitBranch className="h-4 w-4 text-blue-600" />;
      case "tabular": return <BarChart3 className="h-4 w-4 text-emerald-600" />;
      default: return <FileText className="h-4 w-4 text-red-600" />;
    }
  };

  const tabs = [
    { id: "natural" as const, label: L ? "자연어" : "Natural Language", icon: Sparkles },
    { id: "semantic" as const, label: L ? "시맨틱" : "Semantic", icon: Search },
    { id: "sql" as const, label: "SQL", icon: Code2 },
    { id: "sparql" as const, label: "SPARQL", icon: Code2 },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link href="/ai-lake" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" /> AI Data Lake
        </Link>
        <h1 className="text-2xl font-bold">{L ? "검색 & 쿼리" : "Query & Search"}</h1>
        <p className="text-sm text-muted-foreground">
          {L ? "AI Data Lake에서 자연어, 시맨틱, SQL, SPARQL로 데이터를 검색합니다" : "Search data from the AI Data Lake using natural language, semantic, SQL, or SPARQL"}
        </p>
      </div>

      {/* Query Type Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setQueryType(tab.id); setShowGenerated(false); }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              queryType === tab.id ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Query Input */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            {queryType === "sql" || queryType === "sparql" ? (
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={queryType === "sql" ? "SELECT * FROM ..." : "SELECT ?s ?p ?o WHERE { ... }"}
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm font-mono min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            ) : (
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleQuery(); }}
                placeholder={L
                  ? (queryType === "natural" ? "무엇을 찾고 싶으신가요? 자연어로 질문해주세요..." : "검색할 내용을 입력하세요...")
                  : (queryType === "natural" ? "What are you looking for? Ask in natural language..." : "Enter your search query...")
                }
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleQuery} disabled={isQuerying || !query.trim()} className="px-6">
              {isQuerying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            </Button>
            {queryType === "natural" && (
              <Button onClick={handleNLConvert} disabled={isConverting || !query.trim()} variant="outline" className="px-4 text-xs">
                {isConverting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span className="ml-1">{L ? "변환" : "Convert"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* NL → SQL/SPARQL auto-generated */}
        {showGenerated && queryType === "natural" && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              {L ? "자동 생성된 쿼리" : "Auto-generated Queries"}
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-600">SQL</span>
                  <button onClick={() => handleUseGenerated("sql", generatedSQL)} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    {L ? "이 쿼리 사용" : "Use this"} <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">{generatedSQL}</pre>
              </div>
              <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-emerald-600">SPARQL</span>
                  <button onClick={() => handleUseGenerated("sparql", generatedSPARQL)} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    {L ? "이 쿼리 사용" : "Use this"} <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">{generatedSPARQL}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Example Queries */}
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">{L ? "예시:" : "Examples:"}</p>
          <div className="flex flex-wrap gap-2">
            {queryExamples[queryType].map((example, i) => (
              <button
                key={i}
                onClick={() => setQuery(L ? example.ko : example.en)}
                className="rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors truncate max-w-[400px]"
              >
                {L ? example.ko : example.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {isQuerying && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{L ? "AI Data Lake 검색 중..." : "Searching AI Data Lake..."}</p>
          </div>
        </div>
      )}

      {!isQuerying && hasSearched && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {L ? `${results.length}개 결과` : `${results.length} results found`}
            </p>
            <Button variant="outline" size="sm" onClick={handleExportResults}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {L ? "CSV 내보내기" : "Export CSV"}
            </Button>
          </div>

          {results.map((result, idx) => (
            <div key={result.file_id + idx} className="rounded-xl border p-4 hover:shadow-sm transition-all bg-card">
              <div className="flex items-start gap-3">
                <div className="mt-0.5"><FileText className="h-4 w-4 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{result.filename}</span>
                    <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {result.snippets.map((snippet, si) => (
                    <p key={si} className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded p-2">{snippet}</p>
                  ))}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[10px]">
                      {result.lifecycle_phase}
                    </span>
                    {result.standards_applied.map((std) => (
                      <span key={std.code} className="inline-flex items-center rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-mono">
                        {std.code}
                      </span>
                    ))}
                    {result.tables_count > 0 && (
                      <span className="inline-flex items-center rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px]">
                        {result.tables_count} {L ? "테이블" : "tables"}
                      </span>
                    )}
                  </div>
                  {result.keywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {result.keywords.slice(0, 8).map((kw) => (
                        <span key={kw} className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">#{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button className="text-muted-foreground hover:text-foreground p-1" onClick={() => handleCopySnippet(result.snippets.join("\n"), idx)}>
                  {copiedIdx === idx ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isQuerying && hasSearched && results.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>{L ? "결과 없음" : "No results found"}</p>
          <p className="text-xs mt-1">{L ? "다른 검색어로 시도해보세요" : "Try different search terms"}</p>
        </div>
      )}
    </div>
  );
}
