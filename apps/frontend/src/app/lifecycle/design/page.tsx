"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PenTool,
  Upload,
  FileText,
  Box,
  FileSpreadsheet,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { projectsApi, Project, ProjectFile } from "@/lib/api/projects";
import { FileUpload } from "@/components/project/FileUpload";
import { FileListWithPreview } from "@/components/project/FileListWithPreview";
import { ProjectSelector } from "@/components/project/ProjectSelector";
import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/store/languageStore";

export default function DesignPhasePage() {
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
        const designProjects = (allData.items || []).filter(
          (p) => p.lifecycle_phase === "design"
        );
        setProjects(designProjects);
        if (designProjects.length > 0) setSelectedProject(designProjects[0].id);
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    projectsApi.listFiles(selectedProject, undefined, "design")
      .then((data) => setFiles(data.files || []))
      .catch(console.error);
  }, [selectedProject]);

  const refreshFiles = async () => {
    if (!selectedProject) return;
    const data = await projectsApi.listFiles(selectedProject, undefined, "design");
    setFiles(data.files || []);
  };

  const designStandards = [
    { code: "ISO 19650-2", name: L ? "설계 단계 정보 관리" : "Design Phase Info Management", role: L ? "CDE 워크플로우, 정보 교환 요구사항" : "CDE workflow, information exchange requirements" },
    { code: "IFC 4.3", name: L ? "BIM 데이터 스키마" : "BIM Data Schema", role: L ? "설계 BIM 모델 파싱 및 구조 분석" : "Design BIM model parsing and structure analysis" },
    { code: "ISO 7817", name: "LOIN", role: L ? "설계 단계 LOD/LOI 요구사항 정의" : "Design phase LOD/LOI requirement definition" },
    { code: "IDS 1.0", name: L ? "정보 전달 사양" : "Information Delivery Spec", role: L ? "설계 BIM 표준 적합성 검증 (6-facet)" : "Design BIM standards compliance (6-facet)" },
    { code: "bSDD", name: L ? "데이터 사전" : "Data Dictionary", role: L ? "설계 요소 분류 및 속성 표준화" : "Element classification and property standardization" },
    { code: "ISO 12006-2", name: L ? "분류체계 프레임워크" : "Classification Framework", role: L ? "설계 요소 분류 (Uniclass, OmniClass)" : "Element classification (Uniclass, OmniClass)" },
    { code: "ISO 19115", name: L ? "지리공간 메타데이터" : "Geospatial Metadata", role: L ? "설계 좌표계 및 공간 메타데이터" : "Coordinate system and spatial metadata" },
    { code: "EN 15978", name: L ? "지속가능성 평가" : "Sustainability Assessment", role: L ? "설계 단계 LCA/탄소 발자국 산출" : "Design phase LCA/carbon footprint" },
  ];

  const designDocTypes = [
    { type: L ? "설계도면" : "Design Drawings", formats: "PDF", icon: FileText, color: "text-red-600" },
    { type: L ? "BIM 모델" : "BIM Model", formats: "IFC", icon: Box, color: "text-blue-600" },
    { type: L ? "설계설명서" : "Design Description", formats: "DOCX, HWPX", icon: FileText, color: "text-indigo-600" },
    { type: L ? "물량산출서" : "Bill of Quantities", formats: "XLSX", icon: FileSpreadsheet, color: "text-green-600" },
    { type: L ? "설계검토서" : "Design Review", formats: "PDF, DOCX", icon: ShieldCheck, color: "text-violet-600" },
  ];

  const pipelineSteps = [
    { step: L ? "1. 파일 등록" : "1. File Registration", desc: L ? "설계 문서를 업로드하면 ISO 19650 CDE 워크플로우에 등록됩니다." : "Upload design documents to register in ISO 19650 CDE workflow." },
    { step: L ? "2. 구조 분석" : "2. Structure Analysis", desc: L ? "IFC 파서가 공간 구조, 요소 속성, 관계를 추출합니다." : "IFC parser extracts spatial structure, properties, and relationships." },
    { step: L ? "3. LOIN 검증" : "3. LOIN Validation", desc: L ? "설계 단계 LOD/LOI 요구수준에 따라 IDS 규칙을 자동 생성합니다." : "Auto-generate IDS rules based on LOD/LOI requirements." },
    { step: L ? "4. IDS 검증" : "4. IDS Validation", desc: L ? "6-facet 검증: Entity, Attribute, Property, Material, Classification, PartOf" : "6-facet: Entity, Attribute, Property, Material, Classification, PartOf" },
    { step: L ? "5. bSDD 보강" : "5. bSDD Enrichment", desc: L ? "누락된 분류코드와 속성을 bSDD API로 매핑하고 보강합니다." : "Map and enrich missing classifications via bSDD API." },
    { step: L ? "6. AI 변환" : "6. AI Transform", desc: L ? "검증/보강된 데이터를 임베딩, 지식그래프, 정형데이터로 변환합니다." : "Transform into embeddings, knowledge graphs, and tabular datasets." },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <PenTool className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{L ? "설계 단계" : "Design Phase"}</h1>
            <p className="text-xs text-muted-foreground">{L ? "ISO 19650-2 기반" : "Based on ISO 19650-2"}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {L ? "설계 단계에서 산출되는 BIM 모델, 설계도면, 설계도서, 물량산출서 등을 국제 표준에 기반하여 검증하고 AI-ready 데이터로 변환합니다."
            : "Validate BIM models, drawings, specs, and BOQ from the design phase based on international standards and transform into AI-ready data."}
        </p>
      </div>

      {/* === 1. PROJECT + UPLOAD (TOP) === */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-bold">{L ? "프로젝트 & 문서 등록" : "Project & Document Upload"}</h2>
        </div>

        {/* Project Selector with inline create */}
        <ProjectSelector
          projects={projects}
          selectedProject={selectedProject}
          lifecyclePhase="design"
          onSelect={setSelectedProject}
          onProjectCreated={(p) => {
            setProjects((prev) => [...prev, p]);
            setSelectedProject(p.id);
          }}
        />

        {/* File upload area */}
        {selectedProject ? (
          <>
            <FileUpload projectId={selectedProject} lifecyclePhase="design" onUpload={refreshFiles} />
            {files.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{L ? `등록된 파일 (${files.length})` : `Registered Files (${files.length})`}</h3>
                <FileListWithPreview
                  files={files}
                  projectId={selectedProject}
                  phaseColor="blue"
                  onDelete={async (file) => {
                    await projectsApi.deleteFile(selectedProject, file.id);
                    refreshFiles();
                  }}
                />
              </div>
            )}
          </>
        ) : null}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-semibold text-muted-foreground mb-2">{L ? "지원 문서 유형" : "Accepted Document Types"}</p>
          <div className="flex flex-wrap gap-2">
            {designDocTypes.map((doc) => (
              <div key={doc.type} className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                <doc.icon className={`h-3.5 w-3.5 ${doc.color}`} />
                <span className="font-medium">{doc.type}</span>
                <span className="text-muted-foreground font-mono text-[10px]">{doc.formats}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === 2. PIPELINE === */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-bold mb-3">{L ? "파이프라인 프로세스" : "Pipeline Process"}</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {pipelineSteps.map((step) => (
            <div key={step.step} className="flex items-start gap-2.5 rounded-lg bg-muted/30 p-3">
              <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div><p className="font-semibold text-xs">{step.step}</p><p className="text-xs text-muted-foreground">{step.desc}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* === 3. STANDARDS === */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-bold mb-3">{L ? "적용 표준" : "Applied Standards"}</h2>
        <div className="grid gap-1.5 md:grid-cols-2">
          {designStandards.map((std) => (
            <div key={std.code} className="flex items-center gap-3 rounded-lg bg-muted/30 p-2.5">
              <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded w-24 text-center flex-shrink-0">{std.code}</span>
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
