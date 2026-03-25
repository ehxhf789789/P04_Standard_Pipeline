"use client";

import { useState, useMemo } from "react";
import { Search, ExternalLink, ChevronDown, ChevronRight, BookOpen, CheckCircle2 } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";

interface Standard {
  code: string;
  name_en: string;
  name_ko: string;
  category: string;
  desc_en: string;
  desc_ko: string;
  url: string;
  pipeline_stages: string[];
  implemented: string[];
  implemented_ko: string[];
}

const categories = [
  { id: "all", en: "All Standards", ko: "전체 표준" },
  { id: "information", en: "Information Management", ko: "정보 관리" },
  { id: "bim", en: "BIM / IFC", ko: "BIM / IFC" },
  { id: "validation", en: "Validation & Delivery", ko: "검증 및 전달" },
  { id: "classification", en: "Classification & Dictionary", ko: "분류 및 사전" },
  { id: "geospatial", en: "Geospatial / Spatial", ko: "지리공간 / 공간정보" },
  { id: "asset", en: "Asset & Sustainability", ko: "자산 관리 및 지속가능성" },
  { id: "digital", en: "Digital Twin & IoT", ko: "디지털 트윈 및 IoT" },
  { id: "national", en: "National Standards", ko: "국가 표준" },
];

const standards: Standard[] = [
  // === Information Management ===
  {
    code: "ISO 19650-1:2018", name_en: "Information Management — Concepts and Principles", name_ko: "정보 관리 — 개념 및 원칙",
    category: "information", desc_en: "Framework for managing information over the whole lifecycle of a built asset using BIM.", desc_ko: "BIM을 활용한 건설 자산 전생애주기 정보 관리 프레임워크.",
    url: "https://www.iso.org/standard/68078.html", pipeline_stages: ["Ingest", "AI Lake"],
    implemented: ["CDE workflow states", "Document lifecycle management", "Audit trail logging"], implemented_ko: ["CDE 워크플로우 상태 관리", "문서 생애주기 관리", "감사 추적 로깅"],
  },
  {
    code: "ISO 19650-2:2018", name_en: "Information Management — Delivery Phase", name_ko: "정보 관리 — 전달 단계",
    category: "information", desc_en: "Information management during the delivery phase (design and construction).", desc_ko: "전달 단계(설계 및 시공)의 정보 관리.",
    url: "https://www.iso.org/standard/68080.html", pipeline_stages: ["Ingest", "Validate"],
    implemented: ["Design phase CDE workflow", "Information exchange requirements"], implemented_ko: ["설계 단계 CDE 워크플로우", "정보 교환 요구사항"],
  },
  {
    code: "ISO 19650-3:2020", name_en: "Information Management — Operational Phase", name_ko: "정보 관리 — 운영 단계",
    category: "information", desc_en: "Information management during the operational phase of assets.", desc_ko: "자산 운영 단계의 정보 관리.",
    url: "https://www.iso.org/standard/75109.html", pipeline_stages: ["Ingest", "AI Lake"],
    implemented: ["O&M phase CDE workflow", "Asset information management"], implemented_ko: ["유지관리 단계 CDE 워크플로우", "자산 정보 관리"],
  },
  {
    code: "ISO 21597:2020 (ICDD)", name_en: "Information Container for Linked Document Delivery", name_ko: "연결 문서 전달을 위한 정보 컨테이너",
    category: "information", desc_en: "Packaging and linking heterogeneous documents (BIM, GIS, PDF) in a single container.", desc_ko: "이종 문서(BIM, GIS, PDF)를 단일 컨테이너로 패키징하고 연결.",
    url: "https://www.iso.org/standard/74389.html", pipeline_stages: ["Ingest", "Parse", "Transform", "AI Lake"],
    implemented: ["Multi-format container creation", "Linked document packaging"], implemented_ko: ["다중 형식 컨테이너 생성", "연결 문서 패키징"],
  },
  {
    code: "ISO 29481 (IDM)", name_en: "Information Delivery Manual", name_ko: "정보 전달 매뉴얼",
    category: "information", desc_en: "Methodology for defining information exchange requirements between parties.", desc_ko: "관계자 간 정보 교환 요구사항 정의 방법론.",
    url: "https://www.iso.org/standard/60553.html", pipeline_stages: ["Ingest", "Validate"],
    implemented: ["Exchange requirement definition", "Process map-based validation"], implemented_ko: ["교환 요구사항 정의", "프로세스 맵 기반 검증"],
  },
  // === BIM / IFC ===
  {
    code: "ISO 16739-1:2024 (IFC 4.3)", name_en: "Industry Foundation Classes", name_ko: "산업 기반 클래스 (IFC)",
    category: "bim", desc_en: "Open data schema for BIM — defines building and infrastructure elements, properties, and relationships.", desc_ko: "BIM 개방형 데이터 스키마 — 건축 및 인프라 요소, 속성, 관계 정의.",
    url: "https://www.iso.org/standard/84123.html", pipeline_stages: ["Ingest", "Parse", "Validate", "Enrich", "Transform", "AI Lake"],
    implemented: ["IFC file parsing (2x3/4.0/4.3)", "Spatial hierarchy extraction", "PropertySet/QuantitySet extraction", "Material & classification extraction", "Element relationship → Knowledge Graph"],
    implemented_ko: ["IFC 파일 파싱 (2x3/4.0/4.3)", "공간 계층 추출", "PropertySet/QuantitySet 추출", "재료 및 분류 추출", "요소 관계 → 지식그래프"],
  },
  {
    code: "BCF 3.0", name_en: "BIM Collaboration Format", name_ko: "BIM 협업 형식",
    category: "bim", desc_en: "Open standard for communicating issues and changes in BIM projects.", desc_ko: "BIM 프로젝트의 이슈와 변경사항 전달을 위한 개방형 표준.",
    url: "https://technical.buildingsmart.org/standards/bcf/", pipeline_stages: ["Ingest", "Validate", "AI Lake"],
    implemented: ["BCF issue auto-generation on validation failure", "BCF XML import/export", "Issue lifecycle tracking"], implemented_ko: ["검증 실패 시 BCF 이슈 자동 생성", "BCF XML 가져오기/내보내기", "이슈 생애주기 추적"],
  },
  {
    code: "COBie", name_en: "Construction Operations Building Information Exchange", name_ko: "건설-운영 건물 정보 교환",
    category: "bim", desc_en: "Standard for asset data handover from construction to operations.", desc_ko: "시공에서 운영으로 자산 데이터 인수인계를 위한 표준.",
    url: "https://www.nibs.org/cobie", pipeline_stages: ["Parse", "Validate", "Enrich", "Transform", "AI Lake"],
    implemented: ["COBie data extraction", "Completeness validation", "XLSX generation"], implemented_ko: ["COBie 데이터 추출", "완전성 검증", "XLSX 생성"],
  },
  // === Validation & Delivery ===
  {
    code: "IDS 1.0", name_en: "Information Delivery Specification", name_ko: "정보 전달 사양",
    category: "validation", desc_en: "Machine-readable specification for validating BIM data using 6 facets: Entity, Attribute, Property, Material, Classification, PartOf.", desc_ko: "6개 패싯(Entity, Attribute, Property, Material, Classification, PartOf)을 사용한 BIM 데이터 검증 사양.",
    url: "https://technical.buildingsmart.org/projects/information-delivery-specification-ids/", pipeline_stages: ["Parse", "Validate", "Transform", "AI Lake"],
    implemented: ["IDS XML parsing", "All 6 facets implemented", "Per-element Pass/Fail", "Compliance score calculation", "Auto-generation from LOIN"],
    implemented_ko: ["IDS XML 파싱", "6개 패싯 전체 구현", "요소별 Pass/Fail 판정", "적합성 점수 산출", "LOIN으로부터 자동 생성"],
  },
  {
    code: "ISO 7817-1:2024 (LOIN)", name_en: "Level of Information Need", name_ko: "정보 요구수준",
    category: "validation", desc_en: "Defines what level of geometric (LOD) and alphanumeric (LOI) information is needed per element and phase.", desc_ko: "요소 및 단계별 필요한 형상(LOD) 및 속성(LOI) 정보 수준 정의.",
    url: "https://www.iso.org/standard/82914.html", pipeline_stages: ["Parse", "Validate"],
    implemented: ["LOIN JSON parsing", "LOIN → IDS auto-conversion", "LOD/LOI mapping per element type", "Phase-specific information level"], implemented_ko: ["LOIN JSON 파싱", "LOIN → IDS 자동 변환", "요소 유형별 LOD/LOI 매핑", "단계별 정보 수준 차등 적용"],
  },
  // === Classification & Dictionary ===
  {
    code: "ISO 23386/23387 (bSDD)", name_en: "buildingSMART Data Dictionary", name_ko: "buildingSMART 데이터 사전",
    category: "classification", desc_en: "Standardized property and classification definitions with multi-language support.", desc_ko: "다국어 지원 표준 속성 및 분류 정의.",
    url: "https://www.buildingsmart.org/users/services/buildingsmart-data-dictionary/", pipeline_stages: ["Validate", "Enrich", "Transform", "AI Lake"],
    implemented: ["bSDD REST API integration", "IFC Classification → bSDD mapping", "Multi-language property standardization", "Missing classification suggestion"],
    implemented_ko: ["bSDD REST API 연동", "IFC Classification → bSDD 매핑", "다국어 속성 표준화", "누락 분류 제안"],
  },
  {
    code: "ISO 12006-2:2015", name_en: "Classification Framework for Construction", name_ko: "건설 분류체계 프레임워크",
    category: "classification", desc_en: "Framework for classification systems (Uniclass, OmniClass, CCI) in construction.", desc_ko: "건설 분류체계(Uniclass, OmniClass, CCI) 프레임워크.",
    url: "https://www.iso.org/standard/61753.html", pipeline_stages: ["Parse", "Validate", "Enrich", "Transform", "AI Lake"],
    implemented: ["Uniclass 2015 mapping", "OmniClass integration", "Cross-standard code mapping"], implemented_ko: ["Uniclass 2015 매핑", "OmniClass 통합", "교차 표준 코드 매핑"],
  },
  {
    code: "ISO 16757", name_en: "Product Data for Building Services", name_ko: "건축 설비 제품 데이터",
    category: "classification", desc_en: "Standard for product data templates and properties in building services.", desc_ko: "건축 설비 제품 데이터 템플릿 및 속성 표준.",
    url: "https://www.iso.org/standard/57613.html", pipeline_stages: ["Ingest", "Parse", "Validate", "Enrich", "AI Lake"],
    implemented: ["Product data sheet import", "Property standardization"], implemented_ko: ["제품 데이터시트 가져오기", "속성 표준화"],
  },
  // === Geospatial ===
  {
    code: "ISO 19115/19139", name_en: "Geographic Information — Metadata", name_ko: "지리 정보 — 메타데이터",
    category: "geospatial", desc_en: "International standard for describing geographic datasets for discovery and evaluation.", desc_ko: "지리 데이터셋 발견 및 평가를 위한 메타데이터 국제 표준.",
    url: "https://www.iso.org/standard/53798.html", pipeline_stages: ["Ingest", "Parse", "Validate", "Enrich", "AI Lake"],
    implemented: ["Geospatial metadata extraction", "CRS detection", "Metadata completeness validation"], implemented_ko: ["지리공간 메타데이터 추출", "좌표 참조 시스템 감지", "메타데이터 완전성 검증"],
  },
  {
    code: "CityGML 3.0 / CityJSON 2.0", name_en: "OGC City Geography Markup Language", name_ko: "OGC 도시 지리 마크업 언어",
    category: "geospatial", desc_en: "Open standard for 3D city models with semantic information (LOD0-4).", desc_ko: "시맨틱 정보를 포함한 3D 도시 모델 개방형 표준 (LOD0-4).",
    url: "https://www.ogc.org/standard/citygml/", pipeline_stages: ["Ingest", "Parse", "Validate", "Enrich", "Transform", "AI Lake"],
    implemented: ["CityGML/CityJSON parsing", "IFC ↔ CityGML coordinate alignment", "Urban-scale spatial indexing"], implemented_ko: ["CityGML/CityJSON 파싱", "IFC ↔ CityGML 좌표 정렬", "도시 규모 공간 인덱싱"],
  },
  {
    code: "ISO 19107/19111", name_en: "Spatial Schema & Coordinate Referencing", name_ko: "공간 스키마 및 좌표 참조",
    category: "geospatial", desc_en: "Defines spatial geometry types and coordinate reference systems for geospatial interoperability.", desc_ko: "지리공간 상호운용성을 위한 공간 기하 유형 및 좌표 참조 시스템 정의.",
    url: "https://www.iso.org/standard/66175.html", pipeline_stages: ["Parse", "Validate", "Enrich", "Transform", "AI Lake"],
    implemented: ["CRS detection from IFC/GIS", "Coordinate transformation (EPSG)", "Spatial query support"], implemented_ko: ["IFC/GIS에서 CRS 감지", "좌표 변환 (EPSG)", "공간 쿼리 지원"],
  },
  // === Asset & Sustainability ===
  {
    code: "ISO 55000:2024", name_en: "Asset Management", name_ko: "자산 관리",
    category: "asset", desc_en: "Framework for managing physical assets throughout their lifecycle.", desc_ko: "물리적 자산의 전생애주기 관리 프레임워크.",
    url: "https://www.iso.org/standard/83053.html", pipeline_stages: ["Parse", "Validate", "Enrich", "Transform", "AI Lake"],
    implemented: ["Asset register management", "Condition assessment tracking", "Predictive maintenance features"], implemented_ko: ["자산 대장 관리", "상태 평가 추적", "예측 유지보수 특성 추출"],
  },
  {
    code: "EN 15978 / ISO 14040", name_en: "Sustainability & Life Cycle Assessment", name_ko: "지속가능성 및 전과정 평가",
    category: "asset", desc_en: "Environmental assessment of buildings and LCA methodology standards.", desc_ko: "건물 환경 평가 및 전과정 평가(LCA) 방법론 표준.",
    url: "https://www.iso.org/standard/38498.html", pipeline_stages: ["Parse", "Validate", "Enrich", "Transform", "AI Lake"],
    implemented: ["Material quantity extraction for LCA", "EPD database mapping", "Carbon footprint calculation"], implemented_ko: ["LCA용 자재 물량 추출", "EPD 데이터베이스 매핑", "탄소 발자국 산출"],
  },
  // === Digital Twin ===
  {
    code: "ISO 23247:2021", name_en: "Digital Twin Framework", name_ko: "디지털 트윈 프레임워크",
    category: "digital", desc_en: "Reference architecture for digital twins connecting physical assets to digital representations.", desc_ko: "물리적 자산을 디지털 표현에 연결하는 디지털 트윈 참조 아키텍처.",
    url: "https://www.iso.org/standard/75066.html", pipeline_stages: ["Ingest", "Parse", "Validate", "Enrich", "Transform", "AI Lake"],
    implemented: ["IoT/sensor data ingestion", "Physical-digital asset linking", "Time-series ML feature extraction"], implemented_ko: ["IoT/센서 데이터 수집", "물리-디지털 자산 연결", "시계열 ML 특성 추출"],
  },
  // === National ===
  {
    code: "KS F Series", name_en: "Korean Industrial Standards — Construction", name_ko: "한국산업표준 — 건설",
    category: "national", desc_en: "Korean national standards for construction documents, BIM guidelines, and building code.", desc_ko: "건설 문서, BIM 지침, 건축법규를 위한 한국 국가 표준.",
    url: "https://standard.go.kr/", pipeline_stages: ["Ingest", "Parse", "Validate", "Enrich", "AI Lake"],
    implemented: ["HWPX/HWP document parsing", "Korean building code rules", "KS ↔ ISO classification mapping"], implemented_ko: ["HWPX/HWP 문서 파싱", "한국 건축법규 규칙", "KS ↔ ISO 분류 매핑"],
  },
  {
    code: "ISO 32000 (PDF)", name_en: "Document Management — PDF", name_ko: "문서 관리 — PDF",
    category: "national", desc_en: "Portable Document Format standard for document exchange.", desc_ko: "문서 교환을 위한 PDF 포맷 표준.",
    url: "https://www.iso.org/standard/75839.html", pipeline_stages: ["Parse"],
    implemented: ["PDF text extraction", "Table extraction", "Metadata extraction", "OCR support"], implemented_ko: ["PDF 텍스트 추출", "테이블 추출", "메타데이터 추출", "OCR 지원"],
  },
  {
    code: "ISO/IEC 29500 (OOXML)", name_en: "Office Open XML", name_ko: "오피스 오픈 XML",
    category: "national", desc_en: "Standard for DOCX, XLSX, PPTX document formats.", desc_ko: "DOCX, XLSX, PPTX 문서 형식 표준.",
    url: "https://www.iso.org/standard/71691.html", pipeline_stages: ["Parse"],
    implemented: ["DOCX parsing", "XLSX parsing", "PPTX parsing", "Heading hierarchy detection"], implemented_ko: ["DOCX 파싱", "XLSX 파싱", "PPTX 파싱", "제목 계층 감지"],
  },
];

export default function StandardsPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedStandard, setExpandedStandard] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return standards.filter((s) => {
      const matchCategory = selectedCategory === "all" || s.category === selectedCategory;
      if (!matchCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.code.toLowerCase().includes(q) ||
        s.name_en.toLowerCase().includes(q) ||
        s.name_ko.includes(q) ||
        s.desc_en.toLowerCase().includes(q) ||
        s.desc_ko.includes(q)
      );
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{L ? "표준 프레임워크" : "Standards Framework"}</h1>
        <p className="text-sm text-muted-foreground">
          {L ? `${standards.length}개 국제 표준 — 검색하고 상세 정보를 확인하세요` : `${standards.length} international standards — search and explore details`}
        </p>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={L ? "표준 코드, 이름, 키워드로 검색..." : "Search by code, name, keyword..."}
            className="w-full rounded-lg border bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        <span className="text-xs text-muted-foreground self-center">{filtered.length}/{standards.length}</span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categories.map((cat) => {
          const count = cat.id === "all" ? standards.length : standards.filter((s) => s.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat.id ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"
              }`}
            >
              {L ? cat.ko : cat.en} ({count})
            </button>
          );
        })}
      </div>

      {/* Standards list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{L ? "검색 결과가 없습니다" : "No standards found"}</p>
          </div>
        ) : (
          filtered.map((std) => {
            const isExpanded = expandedStandard === std.code;
            return (
              <div key={std.code} className="rounded-lg border bg-white overflow-hidden">
                <button
                  onClick={() => setExpandedStandard(isExpanded ? null : std.code)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  <span className="font-mono text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded flex-shrink-0 min-w-[140px] text-center">{std.code}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{L ? std.name_ko : std.name_en}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{L ? std.name_en : std.name_ko}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {std.pipeline_stages.slice(0, 3).map((s) => (
                      <span key={s} className="text-[8px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{s}</span>
                    ))}
                    {std.pipeline_stages.length > 3 && <span className="text-[8px] text-muted-foreground">+{std.pipeline_stages.length - 3}</span>}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t bg-slate-50/50 space-y-3">
                    {/* Description */}
                    <p className="text-sm text-muted-foreground pt-3">{L ? std.desc_ko : std.desc_en}</p>

                    {/* Pipeline stages */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">{L ? "파이프라인 적용 단계:" : "Pipeline Stages:"}</p>
                      <div className="flex gap-1.5">
                        {std.pipeline_stages.map((s) => (
                          <span key={s} className="text-[10px] bg-amber-100 text-amber-700 rounded px-2 py-0.5 font-medium">{s}</span>
                        ))}
                      </div>
                    </div>

                    {/* Implementation */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">{L ? "구현 현황:" : "Implementation:"}</p>
                      <div className="grid gap-1 md:grid-cols-2">
                        {(L ? std.implemented_ko : std.implemented).map((item) => (
                          <div key={item} className="flex items-center gap-1.5 text-xs">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reference link */}
                    {std.url && (
                      <a href={std.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                        <ExternalLink className="h-3 w-3" />
                        {L ? "표준 원문 참조" : "View Standard Reference"}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
