"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Database,
  Search,
  Network,
  BarChart3,
  FileText,
  ArrowRight,
  HardDrive,
  Cpu,
  GitBranch,
} from "lucide-react";
import { projectsApi, Project } from "@/lib/api/projects";
import { queryApi, QueryStats } from "@/lib/api/query";
import { useLanguageStore } from "@/store/languageStore";

export default function AIDataLakePage() {
  const { lang } = useLanguageStore();
  const [stats, setStats] = useState({ docs: 0, embeddings: 0, kgNodes: 0, kgEdges: 0, tabRows: 0, storageMB: 0 });
  const L = lang === "ko";

  useEffect(() => {
    async function fetchData() {
      try {
        const realStats = await queryApi.getStats();
        setStats({
          docs: realStats.total_documents,
          embeddings: realStats.processed_documents,
          kgNodes: realStats.total_keywords,
          kgEdges: realStats.total_tables,
          tabRows: realStats.total_tables,
          storageMB: realStats.total_documents * 2,
        });
      } catch (e) {
        console.error(e);
        // Fallback to project-based stats
        try {
          const data = await projectsApi.list();
          const projects = data.items || [];
          const totalFiles = projects.reduce((s: number, p: Project) => s + (p.file_count || p.ifc_file_count || 0), 0);
          setStats({ docs: totalFiles, embeddings: 0, kgNodes: 0, kgEdges: 0, tabRows: 0, storageMB: 0 });
        } catch (e2) { console.error(e2); }
      }
    }
    fetchData();
  }, []);

  const dataCategories = [
    {
      id: "embeddings", icon: Cpu, color: "from-violet-500 to-purple-600",
      title: "Vector Embeddings", titleKo: "벡터 임베딩",
      desc: L ? "문서/요소별 시맨틱 벡터 (sentence-transformers)" : "Per-document/element semantic vectors (sentence-transformers)",
      standard: "AI/ML Ready Format", format: "Float32 vectors, 384-dim", href: "/ai-lake/embeddings",
    },
    {
      id: "knowledge-graph", icon: GitBranch, color: "from-blue-500 to-cyan-600",
      title: "Knowledge Graph", titleKo: "지식 그래프",
      desc: L ? "IFC 관계 기반 그래프 (ifcOWL + BOT Ontology)" : "IFC relationship-based graph (ifcOWL + BOT Ontology)",
      standard: "ISO 16739-1, ifcOWL", format: "Nodes + Edges (JSON-LD)", href: "/ai-lake/knowledge-graph",
    },
    {
      id: "tabular", icon: BarChart3, color: "from-emerald-500 to-green-600",
      title: "Tabular Datasets", titleKo: "정형 데이터셋",
      desc: L ? "표준화된 속성 테이블 (bSDD 분류 기반)" : "Standardized property tables (bSDD classification-based)",
      standard: "ISO 23386/23387", format: "CSV / Parquet / JSON", href: "/ai-lake/tabular",
    },
    {
      id: "gnn", icon: Network, color: "from-amber-500 to-orange-600",
      title: "GNN Structures", titleKo: "GNN 그래프 구조",
      desc: L ? "그래프 신경망용 인접 행렬 및 특성 행렬" : "Adjacency and feature matrices for graph neural networks",
      standard: "PyG / DGL Format", format: "Adjacency + Feature matrices", href: "/ai-lake/gnn",
    },
  ];

  const standardsBasis = [
    { standard: "ISO 16739-1:2024 (IFC 4.3)", role: L ? "BIM 데이터 스키마 정의 및 공간/요소 관계 추출" : "BIM data schema definition and spatial/element relationship extraction", output: "Knowledge Graph, GNN Structures" },
    { standard: "ISO 7817-1:2024 (LOIN)", role: L ? "정보 요구수준 정의 → IDS 검증 규칙 자동 생성" : "Information need level definition → auto-generate IDS validation rules", output: "Validation Rules, Quality Metrics" },
    { standard: "IDS 1.0", role: L ? "6-facet 검증 (Entity, Attribute, Property, Material, Classification, PartOf)" : "6-facet validation (Entity, Attribute, Property, Material, Classification, PartOf)", output: "Compliance Reports, Quality Scores" },
    { standard: "ISO 23386/23387 (bSDD)", role: L ? "표준 분류체계 및 속성 매핑, 다국어 용어 통일" : "Standard classification and property mapping, multi-language term unification", output: "Enriched Properties, Tabular Datasets" },
    { standard: "ISO 19650 Series", role: L ? "CDE 워크플로우 (WIP → Shared → Published → Archived)" : "CDE workflow (WIP → Shared → Published → Archived)", output: "Document Lifecycle States, Audit Trail" },
    { standard: "ISO 19115/19139", role: L ? "메타데이터 표준 — 공간 데이터셋의 발견 및 평가를 위한 메타데이터" : "Metadata standard — metadata for discovery and evaluation of spatial datasets", output: "Dataset Metadata, Catalog Index" },
    { standard: "ISO 21597 (ICDD)", role: L ? "정보 컨테이너 패키징 — 이종 데이터의 연결 및 전달" : "Information container packaging — linking and delivery of heterogeneous data", output: "Linked Delivery Packages" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-violet-50 p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
                <Database className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">AI Data Lake</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              {L
                ? "건설 전생애주기 데이터를 국제 표준에 기반하여 AI-ready 형식으로 변환하고 통합 관리하는 데이터 레이크입니다. 벡터 임베딩, 지식 그래프, 정형 데이터셋 등 다양한 AI 학습/추론용 데이터를 쿼리하고 활용할 수 있습니다."
                : "A unified data lake that transforms construction lifecycle data into AI-ready formats based on international standards. Query and utilize vector embeddings, knowledge graphs, tabular datasets and more for AI training and inference."}
            </p>
          </div>
          <Link href="/ai-lake/query" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm">
            <Search className="h-4 w-4" />
            {L ? "데이터 쿼리" : "Query Data"}
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-6">
          <MiniStat label={L ? "등록 문서" : "Documents"} value={stats.docs} icon={<FileText className="h-3.5 w-3.5" />} />
          <MiniStat label={L ? "임베딩" : "Embeddings"} value={stats.embeddings} icon={<Cpu className="h-3.5 w-3.5" />} />
          <MiniStat label="KG Nodes" value={stats.kgNodes} icon={<GitBranch className="h-3.5 w-3.5" />} />
          <MiniStat label="KG Edges" value={stats.kgEdges} icon={<Network className="h-3.5 w-3.5" />} />
          <MiniStat label={L ? "테이블 행" : "Table Rows"} value={stats.tabRows} icon={<BarChart3 className="h-3.5 w-3.5" />} />
          <MiniStat label={L ? "저장 용량" : "Storage"} value={`${stats.storageMB}MB`} icon={<HardDrive className="h-3.5 w-3.5" />} />
        </div>
      </div>

      {/* Data Categories */}
      <div>
        <h2 className="text-xl font-bold mb-4">{L ? "AI-Ready 데이터 형식" : "AI-Ready Data Formats"}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {dataCategories.map((cat) => (
            <Link key={cat.id} href={cat.href} className="rounded-xl border p-5 hover:shadow-md hover:border-primary/30 transition-all block">
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${cat.color} text-white`}>
                  <cat.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{L ? cat.titleKo : cat.title}</h3>
                  <p className="text-[10px] text-muted-foreground font-mono">{L ? cat.title : cat.titleKo}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{cat.desc}</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-16">{L ? "표준:" : "Standard:"}</span>
                  <span className="font-mono text-primary">{cat.standard}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-16">{L ? "형식:" : "Format:"}</span>
                  <span className="font-mono">{cat.format}</span>
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary font-medium">
                {L ? "데이터 보기" : "View Data"} <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Standards Basis */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-bold mb-2">{L ? "AI Data Lake 구축 근거 표준" : "Standards Basis for AI Data Lake"}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {L ? "AI Data Lake 구축의 근거가 되는 국제 표준 및 각 표준의 역할" : "International standards that form the basis for AI Data Lake construction and their roles"}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">{L ? "표준" : "Standard"}</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">{L ? "파이프라인 역할" : "Role in Pipeline"}</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">{L ? "AI 출력물" : "AI Output"}</th>
              </tr>
            </thead>
            <tbody>
              {standardsBasis.map((item) => (
                <tr key={item.standard} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-4 font-mono text-xs text-primary">{item.standard}</td>
                  <td className="py-3 px-4 text-muted-foreground">{item.role}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {item.output.split(", ").map((o) => (
                        <span key={o} className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs">{o}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Flow */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-bold mb-4">{L ? "데이터 흐름: 문서 → AI Lake" : "Data Flow: Document → AI Lake"}</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { label: L ? "파일 업로드" : "File Upload", sub: "PDF, IFC, DOCX..." },
            { label: L ? "파싱" : "Parse", sub: L ? "구조 추출" : "Structure Extract" },
            { label: L ? "검증" : "Validate", sub: "IDS + LOIN" },
            { label: L ? "보강" : "Enrich", sub: "bSDD Mapping" },
            { label: L ? "변환" : "Transform", sub: "AI Formats" },
            { label: "AI Lake", sub: L ? "저장 및 인덱싱" : "Store & Index" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex-shrink-0 rounded-lg border bg-background px-4 py-3 text-center min-w-[120px]">
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="text-[10px] text-muted-foreground">{step.sub}</p>
              </div>
              {i < 5 && <ArrowRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white/80 backdrop-blur-sm p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">{icon}{label}</div>
      <div className="text-lg font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}
