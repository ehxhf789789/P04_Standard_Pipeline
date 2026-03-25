import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "ko" | "en";

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

export const translations: Record<string, Record<Lang, string>> = {
  // === App ===
  "app.title": { ko: "BIM-Vortex", en: "BIM-Vortex" },
  "app.subtitle": { ko: "AI Standards Pipeline", en: "AI Standards Pipeline" },
  "app.description": {
    ko: "건설 전생애주기 문서를 국제 표준(ISO 19650, IFC, LOIN, IDS, bSDD)에 기반하여 검증하고, AI-ready 데이터로 변환하여 AI Data Lake로 통합 관리합니다.",
    en: "Validate construction lifecycle documents based on international standards (ISO 19650, IFC, LOIN, IDS, bSDD), transform to AI-ready data, and manage in a unified AI Data Lake.",
  },

  // === Nav ===
  "nav.dashboard": { ko: "대시보드", en: "Dashboard" },
  "nav.projects": { ko: "프로젝트", en: "Projects" },
  "nav.lifecycle": { ko: "건설 전생애주기", en: "Construction Lifecycle" },
  "nav.design": { ko: "설계 단계", en: "Design Phase" },
  "nav.construction": { ko: "시공 단계", en: "Construction Phase" },
  "nav.operation": { ko: "유지관리 단계", en: "O&M Phase" },
  "nav.data": { ko: "데이터 & AI", en: "Data & AI" },
  "nav.aiLake": { ko: "AI 데이터 레이크", en: "AI Data Lake" },
  "nav.standards": { ko: "표준 프레임워크", en: "Standards Framework" },
  "nav.query": { ko: "검색 & 쿼리", en: "Query & Search" },
  "nav.appliedStandards": { ko: "적용 표준", en: "Applied Standards" },
  "nav.settings": { ko: "설정", en: "Settings" },
  "nav.signIn": { ko: "로그인", en: "Sign In" },

  // === Dashboard ===
  "dash.hero.title": { ko: "무엇을 하시겠습니까?", en: "What would you like to do?" },
  "dash.action.upload": { ko: "문서 등록", en: "Upload Documents" },
  "dash.action.upload.desc": {
    ko: "IFC, PDF, DOCX, XLSX 등 건설 문서를 프로젝트에 등록합니다",
    en: "Register construction documents (IFC, PDF, DOCX, XLSX, etc.) to a project",
  },
  "dash.action.validate": { ko: "표준 검증", en: "Standards Validation" },
  "dash.action.validate.desc": {
    ko: "등록된 문서를 IDS/LOIN 기준으로 표준 적합성을 검증합니다",
    en: "Validate registered documents against IDS/LOIN standards compliance",
  },
  "dash.action.transform": { ko: "AI 변환", en: "AI Transform" },
  "dash.action.transform.desc": {
    ko: "검증된 데이터를 임베딩, 지식그래프, 정형데이터로 변환합니다",
    en: "Transform validated data into embeddings, knowledge graphs, and tabular datasets",
  },
  "dash.action.query": { ko: "데이터 조회", en: "Query Data" },
  "dash.action.query.desc": {
    ko: "AI Data Lake에서 데이터를 검색하고 활용합니다",
    en: "Search and utilize data from the AI Data Lake",
  },
  "dash.stat.projects": { ko: "프로젝트", en: "Projects" },
  "dash.stat.files": { ko: "등록 파일", en: "Registered Files" },
  "dash.stat.validated": { ko: "검증 완료", en: "Validated" },
  "dash.stat.aiOutputs": { ko: "AI 출력물", en: "AI Outputs" },
  "dash.lifecycle.title": { ko: "건설 전생애주기 단계", en: "Construction Lifecycle Phases" },
  "dash.lifecycle.desc": {
    ko: "단계를 선택하여 해당 단계의 문서를 관리하고 표준 검증을 수행합니다",
    en: "Select a phase to manage documents and perform standards validation",
  },
  "dash.pipeline.title": { ko: "파이프라인 프로세스", en: "Pipeline Process" },
  "dash.pipeline.desc": {
    ko: "파일이 AI-ready 데이터로 변환되는 과정입니다",
    en: "How files are transformed into AI-ready data",
  },
  "dash.recent.title": { ko: "최근 프로젝트", en: "Recent Projects" },
  "dash.recent.viewAll": { ko: "전체 보기", en: "View all" },
  "dash.recent.empty": { ko: "등록된 프로젝트가 없습니다", en: "No projects yet" },
  "dash.recent.create": { ko: "프로젝트를 생성하여 시작하세요", en: "Create a project to get started" },
  "dash.newProject": { ko: "새 프로젝트", en: "New Project" },
  "dash.files": { ko: "파일", en: "files" },

  // === Lifecycle ===
  "lifecycle.design.title": { ko: "설계 단계", en: "Design Phase" },
  "lifecycle.design.basis": { ko: "ISO 19650-2 기반", en: "Based on ISO 19650-2" },
  "lifecycle.design.desc": {
    ko: "BIM 모델 및 설계 문서의 정보 요구사항 정의, IDS 기반 검증",
    en: "Define information requirements for BIM models and design documents, IDS-based validation",
  },
  "lifecycle.construction.title": { ko: "시공 단계", en: "Construction Phase" },
  "lifecycle.construction.basis": { ko: "ISO 19650-3 기반", en: "Based on ISO 19650-3" },
  "lifecycle.construction.desc": {
    ko: "시공 데이터 수집, BCF 기반 이슈 관리, bSDD 표준 분류 적용",
    en: "Collect construction data, BCF-based issue management, apply bSDD classifications",
  },
  "lifecycle.operation.title": { ko: "유지관리 단계", en: "O&M Phase" },
  "lifecycle.operation.basis": { ko: "ISO 19650-3 + ISO 55000 기반", en: "Based on ISO 19650-3 + ISO 55000" },
  "lifecycle.operation.desc": {
    ko: "시설물 운영 데이터 통합, 자산 관리 및 성능 모니터링",
    en: "Integrate facility operation data, asset management and performance monitoring",
  },

  // === Pipeline ===
  "pipeline.ingest": { ko: "수집", en: "Ingest" },
  "pipeline.ingest.desc": { ko: "파일 업로드 및 메타데이터 추출", en: "File upload & metadata extraction" },
  "pipeline.parse": { ko: "파싱", en: "Parse" },
  "pipeline.parse.desc": { ko: "문서 구조 분석 및 데이터 추출", en: "Document structure analysis & data extraction" },
  "pipeline.validate": { ko: "검증", en: "Validate" },
  "pipeline.validate.desc": { ko: "IDS/LOIN 기반 표준 적합성 검증", en: "IDS/LOIN standards compliance validation" },
  "pipeline.enrich": { ko: "보강", en: "Enrich" },
  "pipeline.enrich.desc": { ko: "bSDD 표준 용어/분류 매핑", en: "bSDD standard terminology/classification mapping" },
  "pipeline.transform": { ko: "변환", en: "Transform" },
  "pipeline.transform.desc": { ko: "AI-ready 데이터 형식 변환", en: "AI-ready data format conversion" },
  "pipeline.aiLake": { ko: "저장", en: "AI Lake" },
  "pipeline.aiLake.desc": { ko: "AI 데이터 레이크 적재 및 인덱싱", en: "AI Data Lake loading & indexing" },

  // === Common ===
  "common.uploadDocs": { ko: "문서 등록", en: "Upload Documents" },
  "common.supported": { ko: "지원 형식", en: "Supported Formats" },
  "common.createProject": { ko: "프로젝트 생성", en: "Create Project" },
  "common.selectProject": { ko: "프로젝트를 먼저 생성해주세요", en: "Please create a project first" },
  "common.appliedStandards": { ko: "적용 표준", en: "Applied Standards" },
  "common.pipelineProcess": { ko: "파이프라인 프로세스", en: "Pipeline Process" },
  "common.registeredFiles": { ko: "등록된 파일", en: "Registered Files" },
  "common.documentTypes": { ko: "문서 유형", en: "Document Types" },
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      lang: "ko" as Lang,
      setLang: (lang: Lang) => set({ lang }),
      t: (key: string) => {
        const { lang } = get();
        return translations[key]?.[lang] || key;
      },
    }),
    {
      name: "language-preference",
      skipHydration: true,
    }
  )
);
