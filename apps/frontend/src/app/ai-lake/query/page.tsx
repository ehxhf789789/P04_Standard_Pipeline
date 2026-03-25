"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Database,
  Play,
  Download,
  FileText,
  Cpu,
  GitBranch,
  BarChart3,
  Network,
  Loader2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/store/languageStore";
import { queryApi, SearchResult } from "@/lib/api/query";

type QueryType = "semantic" | "sparql" | "sql" | "natural";

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
      { ko: "유지관리 점검 보고서 내 균열 관련 내용", en: "Crack-related content in O&M inspection reports" },
    ],
    sparql: [
      { ko: "SELECT ?element ?type WHERE { ?element rdf:type ifc:IfcWall . ?element ifc:hasPropertySet ?pset }", en: "SELECT ?element ?type WHERE { ?element rdf:type ifc:IfcWall . ?element ifc:hasPropertySet ?pset }" },
      { ko: "SELECT ?space ?area WHERE { ?space rdf:type ifc:IfcSpace . ?space bot:hasArea ?area }", en: "SELECT ?space ?area WHERE { ?space rdf:type ifc:IfcSpace . ?space bot:hasArea ?area }" },
    ],
    sql: [
      { ko: "SELECT element_type, COUNT(*) FROM elements GROUP BY element_type ORDER BY COUNT(*) DESC", en: "SELECT element_type, COUNT(*) FROM elements GROUP BY element_type ORDER BY COUNT(*) DESC" },
      { ko: "SELECT * FROM documents WHERE lifecycle_phase = 'design' AND ai_status = 'completed'", en: "SELECT * FROM documents WHERE lifecycle_phase = 'design' AND ai_status = 'completed'" },
    ],
  };

  const sampleResults: QueryResult[] = [
    {
      id: "1", type: "embedding", score: 0.95,
      content: { ko: "IfcWall - 외부벽체 (W-001): 두께 300mm, 콘크리트 C24, 단열재 EPS 100mm", en: "IfcWall - Exterior Wall (W-001): Thickness 300mm, Concrete C24, Insulation EPS 100mm" },
      metadata: { source: { ko: "Design_BIM_Model.ifc", en: "Design_BIM_Model.ifc" }, phase: { ko: "설계", en: "Design" }, standard: { ko: "IFC 4.3", en: "IFC 4.3" } },
    },
    {
      id: "2", type: "knowledge_graph", score: 0.91,
      content: { ko: "IfcBuildingStorey[1F] → containsElement → IfcWall[W-001] → hasPropertySet → Pset_WallCommon", en: "IfcBuildingStorey[1F] → containsElement → IfcWall[W-001] → hasPropertySet → Pset_WallCommon" },
      metadata: { source: { ko: "Knowledge Graph", en: "Knowledge Graph" }, phase: { ko: "설계", en: "Design" }, standard: { ko: "ifcOWL", en: "ifcOWL" } },
    },
    {
      id: "3", type: "tabular", score: 0.87,
      content: { ko: "벽체 물량 데이터: Type=RC벽, Length=12.5m, Height=3.2m, Volume=12.0m³", en: "Wall quantity data: Type=RC Wall, Length=12.5m, Height=3.2m, Volume=12.0m³" },
      metadata: { source: { ko: "물량산출서.xlsx", en: "BOQ.xlsx" }, phase: { ko: "설계", en: "Design" }, standard: { ko: "bSDD", en: "bSDD" } },
    },
    {
      id: "4", type: "document", score: 0.84,
      content: { ko: "설계설명서 3.2.1항: 외벽 단열 성능은 열관류율 0.15 W/m²K 이하로 설계하여야 한다.", en: "Design Description §3.2.1: Exterior wall insulation must be designed with thermal transmittance ≤ 0.15 W/m²K." },
      metadata: { source: { ko: "설계설명서.pdf", en: "DesignDescription.pdf" }, phase: { ko: "설계", en: "Design" }, standard: { ko: "ISO 6946", en: "ISO 6946" } },
    },
  ];

  const [queryType, setQueryType] = useState<QueryType>("natural");
  const [query, setQuery] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "embedding": return <Cpu className="h-4 w-4 text-violet-600" />;
      case "knowledge_graph": return <GitBranch className="h-4 w-4 text-blue-600" />;
      case "tabular": return <BarChart3 className="h-4 w-4 text-emerald-600" />;
      case "document": return <FileText className="h-4 w-4 text-red-600" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, Record<string, string>> = {
      embedding: { ko: "벡터 임베딩", en: "Vector Embedding" },
      knowledge_graph: { ko: "지식 그래프", en: "Knowledge Graph" },
      tabular: { ko: "정형 데이터", en: "Tabular Data" },
      document: { ko: "문서", en: "Document" },
    };
    return labels[type]?.[lang] || type;
  };

  const tabs = [
    { id: "natural" as const, label: L ? "자연어" : "Natural Language" },
    { id: "semantic" as const, label: L ? "시맨틱 검색" : "Semantic Search" },
    { id: "sql" as const, label: "SQL" },
    { id: "sparql" as const, label: "SPARQL" },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link href="/ai-lake" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" />
          AI Data Lake
        </Link>
        <h1 className="text-2xl font-bold">{L ? "검색 & 쿼리" : "Query & Search"}</h1>
        <p className="text-sm text-muted-foreground">
          {L ? "AI Data Lake에서 데이터를 검색하고 쿼리합니다" : "Search and query data from the AI Data Lake"}
        </p>
      </div>

      {/* Query Type Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setQueryType(tab.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              queryType === tab.id ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
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
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm font-mono min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            ) : (
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                placeholder={L
                  ? (queryType === "natural" ? "무엇을 찾고 싶으신가요? 자연어로 질문해주세요..." : "검색할 내용을 입력하세요...")
                  : (queryType === "natural" ? "What are you looking for? Ask in natural language..." : "Enter your search query...")
                }
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            )}
          </div>
          <Button onClick={handleQuery} disabled={isQuerying || !query.trim()} className="px-6">
            {isQuerying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>

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
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {L ? "내보내기" : "Export"}
            </Button>
          </div>

          {results.map((result, idx) => (
            <div key={result.file_id + idx} className="rounded-xl border p-4 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <div className="mt-0.5"><FileText className="h-4 w-4 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{result.filename}</span>
                    <span className="text-[10px] font-mono text-primary">score: {result.score.toFixed(2)}</span>
                  </div>
                  {/* Snippets */}
                  {result.snippets.map((snippet, si) => (
                    <p key={si} className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded p-2">{snippet}</p>
                  ))}
                  {/* Metadata tags */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px]">
                      {result.lifecycle_phase}
                    </span>
                    {result.standards_applied.map((std) => (
                      <span key={std.code} className="inline-flex items-center rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-mono">
                        {std.code}
                      </span>
                    ))}
                    {result.tables_count > 0 && (
                      <span className="inline-flex items-center rounded bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px]">
                        {result.tables_count} {L ? "테이블" : "tables"}
                      </span>
                    )}
                  </div>
                  {/* Keywords */}
                  {result.keywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {result.keywords.slice(0, 8).map((kw) => (
                        <span key={kw} className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">#{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => { navigator.clipboard.writeText(result.snippets.join("\n")); }}>
                  <Copy className="h-3.5 w-3.5" />
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
        </div>
      )}
    </div>
  );
}
