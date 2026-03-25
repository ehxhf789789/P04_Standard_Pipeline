"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  HardHat,
  FileText,
  Box,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  Plus,
  Upload,
  ShieldCheck,
  Image,
} from "lucide-react";
import { projectsApi, Project, ProjectFile } from "@/lib/api/projects";
import { FileUpload } from "@/components/project/FileUpload";
import { FileListWithPreview } from "@/components/project/FileListWithPreview";
import { ProjectSelector } from "@/components/project/ProjectSelector";
import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/store/languageStore";

export default function ConstructionPhasePage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const allData = await projectsApi.list(1, 100);
        const phaseProjects = (allData.items || []).filter(
          (p) => p.lifecycle_phase === "construction"
        );
        setProjects(phaseProjects);
        if (phaseProjects.length > 0) setSelectedProject(phaseProjects[0].id);
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    projectsApi.listFiles(selectedProject, undefined, "construction")
      .then((data) => setFiles(data.files || []))
      .catch(console.error);
  }, [selectedProject]);

  const refreshFiles = async () => {
    if (!selectedProject) return;
    const data = await projectsApi.listFiles(selectedProject, undefined, "construction");
    setFiles(data.files || []);
  };

  const constructionStandards = [
    { code: "ISO 19650-3", name: L ? "시공 단계 정보 관리" : "Construction Phase Information Management", role: L ? "시공 CDE 워크플로우, 정보 교환 관리" : "Construction CDE workflow, information exchange management" },
    { code: "IFC 4.3", name: L ? "BIM 데이터 스키마" : "BIM Data Schema", role: L ? "시공 BIM 모델 파싱 및 진척 데이터 연동" : "Construction BIM model parsing and progress data integration" },
    { code: "BCF 3.0", name: L ? "BIM 협업 형식" : "BIM Collaboration Format", role: L ? "현장 이슈 관리, 시공 품질 피드백 루프" : "Field issue management, construction quality feedback loop" },
    { code: "bSDD", name: L ? "데이터 사전" : "Data Dictionary", role: L ? "시공 자재/요소 표준 분류 매핑" : "Construction material/element standard classification mapping" },
    { code: "IDS 1.0", name: L ? "정보 전달 사양" : "Information Delivery Specification", role: L ? "시공 단계 정보 요구사항 검증" : "Construction phase information requirement verification" },
    { code: "ISO 12006-2", name: L ? "분류체계 프레임워크" : "Classification Framework", role: L ? "시공 요소 분류체계 (Uniclass, OmniClass)" : "Construction element classification (Uniclass, OmniClass)" },
    { code: "ISO 21597", name: L ? "ICDD 정보 컨테이너" : "ICDD Information Container", role: L ? "이종 문서 연결 및 패키징" : "Heterogeneous document linking and packaging" },
    { code: "ISO 19115", name: L ? "지리공간 메타데이터" : "Geospatial Metadata", role: L ? "현장 좌표 및 공간 메타데이터 관리" : "Site coordinates and spatial metadata management" },
  ];

  const constructionDocTypes = [
    { type: L ? "시공상세도" : "Shop Drawings", formats: "PDF", icon: FileText, color: "text-red-600" },
    { type: L ? "시공 BIM" : "Construction BIM", formats: "IFC", icon: Box, color: "text-blue-600" },
    { type: L ? "공정보고서" : "Progress Report", formats: "DOCX, HWPX", icon: FileText, color: "text-indigo-600" },
    { type: L ? "진척현황" : "Progress Status", formats: "XLSX", icon: FileSpreadsheet, color: "text-green-600" },
    { type: L ? "품질점검표" : "Quality Checklist", formats: "XLSX, PDF", icon: ShieldCheck, color: "text-violet-600" },
    { type: L ? "현장사진" : "Site Photos", formats: "JPG, PNG", icon: Image, color: "text-amber-600" },
  ];

  const pipelineSteps = [
    { step: L ? "1. 시공 문서 등록" : "1. Document Registration", desc: L ? "시공 단계 문서를 CDE에 등록하고 ISO 19650-3 워크플로우를 적용합니다." : "Register construction documents in CDE and apply ISO 19650-3 workflow." },
    { step: L ? "2. 데이터 추출" : "2. Data Extraction", desc: L ? "시공 BIM 모델에서 As-Built 정보를 추출하고, 보고서에서 텍스트/테이블을 파싱합니다." : "Extract As-Built info from BIM models, parse text/tables from reports." },
    { step: L ? "3. 표준 검증" : "3. Standards Validation", desc: L ? "시공 단계 IDS 규칙으로 정보 완전성을 검증하고, BCF 이슈를 자동 생성합니다." : "Verify completeness with IDS rules, auto-generate BCF issues." },
    { step: L ? "4. 분류 매핑" : "4. Classification Mapping", desc: L ? "bSDD API로 시공 자재 및 요소의 표준 분류코드를 매핑합니다." : "Map standard classification codes via bSDD API." },
    { step: L ? "5. AI 변환" : "5. AI Transformation", desc: L ? "시공 데이터를 AI-ready 형식으로 변환하여 AI Data Lake에 적재합니다." : "Transform data into AI-ready format and load into AI Data Lake." },
    { step: L ? "6. 이슈 관리" : "6. Issue Management", desc: L ? "BCF 3.0 기반으로 시공 품질 이슈를 추적하고 피드백 루프를 운영합니다." : "Track quality issues and operate feedback loops based on BCF 3.0." },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
            <HardHat className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{L ? "시공 단계" : "Construction Phase"}</h1>
            <p className="text-xs text-muted-foreground">{L ? "ISO 19650-3 기반" : "Based on ISO 19650-3"}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {L
            ? "시공 단계에서 산출되는 As-Built BIM, 시공상세도, 공정보고서, 품질점검표 등을 표준에 기반하여 검증하고, AI-ready 데이터로 변환합니다."
            : "Validate As-Built BIM, shop drawings, progress reports, and quality checklists based on standards, and transform into AI-ready data."}
        </p>
      </div>

      {/* === 1. PROJECT + UPLOAD === */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-bold">{L ? "프로젝트 & 문서 등록" : "Project & Document Upload"}</h2>
        </div>

        <ProjectSelector
          projects={projects}
          selectedProject={selectedProject}
          lifecyclePhase="construction"
          onSelect={setSelectedProject}
          onProjectCreated={(p) => {
            setProjects((prev) => [...prev, p]);
            setSelectedProject(p.id);
          }}
        />

        {selectedProject ? (
          <>
            <FileUpload projectId={selectedProject} lifecyclePhase="construction" onUpload={refreshFiles} />
            {files.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{L ? `등록된 파일 (${files.length})` : `Registered Files (${files.length})`}</h3>
                <FileListWithPreview
                  files={files}
                  projectId={selectedProject}
                  phaseColor="amber"
                  onDelete={async (file) => { await projectsApi.deleteFile(selectedProject, file.id); refreshFiles(); }}
                />
              </div>
            )}
          </>
        ) : null}

        {/* Accepted Document Types (inline) */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-semibold text-muted-foreground mb-2">{L ? "지원 문서 유형" : "Accepted Document Types"}</p>
          <div className="flex flex-wrap gap-2">
            {constructionDocTypes.map((doc) => (
              <div key={doc.type} className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                <doc.icon className={`h-3.5 w-3.5 ${doc.color}`} />
                <span className="font-medium">{doc.type}</span>
                <span className="text-muted-foreground font-mono text-[10px]">{doc.formats}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === 2. PIPELINE PROCESS === */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-bold mb-3">{L ? "파이프라인 프로세스" : "Pipeline Process"}</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {pipelineSteps.map((step) => (
            <div key={step.step} className="flex items-start gap-2.5 rounded-lg bg-muted/30 p-3">
              <CheckCircle2 className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-xs">{step.step}</p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === 3. APPLIED STANDARDS (REFERENCE) === */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-bold mb-3">{L ? "적용 표준" : "Applied Standards"}</h2>
        <div className="grid gap-1.5 md:grid-cols-2">
          {constructionStandards.map((std) => (
            <div key={std.code} className="flex items-center gap-3 rounded-lg bg-muted/30 p-2.5">
              <span className="font-mono text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded w-24 text-center flex-shrink-0">
                {std.code}
              </span>
              <span className="font-medium text-xs flex-1">{std.name}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground flex-1">{std.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
