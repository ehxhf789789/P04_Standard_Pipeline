"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wrench,
  FileText,
  Box,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  Plus,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { projectsApi, Project, ProjectFile } from "@/lib/api/projects";
import { FileUpload } from "@/components/project/FileUpload";
import { FileListWithPreview } from "@/components/project/FileListWithPreview";
import { ProjectSelector } from "@/components/project/ProjectSelector";
import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/store/languageStore";

export default function OperationPhasePage() {
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
          (p) => p.lifecycle_phase === "operation"
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
    projectsApi.listFiles(selectedProject, undefined, "operation")
      .then((data) => setFiles(data.files || []))
      .catch(console.error);
  }, [selectedProject]);

  const refreshFiles = async () => {
    if (!selectedProject) return;
    const data = await projectsApi.listFiles(selectedProject, undefined, "operation");
    setFiles(data.files || []);
  };

  const operationStandards = [
    { code: "ISO 19650-3", name: L ? "운영 단계 정보 관리" : "O&M Phase Info Management", role: L ? "운영 단계 CDE 워크플로우, 자산 정보 관리" : "O&M CDE workflow, asset information management" },
    { code: "ISO 55000", name: L ? "자산 관리" : "Asset Management", role: L ? "시설물 자산 생애주기 관리" : "Facility asset lifecycle management" },
    { code: "IFC 4.3", name: L ? "BIM 데이터 스키마" : "BIM Data Schema", role: L ? "As-Built BIM에서 유지관리 정보 추출" : "Extract O&M info from As-Built BIM" },
    { code: "COBie", name: "COBie", role: L ? "운영/유지관리 데이터 교환 표준" : "O&M data exchange standard" },
    { code: "bSDD", name: L ? "데이터 사전" : "Data Dictionary", role: L ? "시설물 구성요소 표준 분류" : "Facility component standard classification" },
    { code: "ISO 23247", name: L ? "디지털 트윈" : "Digital Twin", role: L ? "물리적 자산-디지털 모델 연결" : "Physical asset-digital model linking" },
    { code: "ISO 19115", name: L ? "지리공간 메타데이터" : "Geospatial Metadata", role: L ? "시설물 위치 및 공간 메타데이터" : "Facility location and spatial metadata" },
    { code: "EN 15978", name: L ? "지속가능성 평가" : "Sustainability Assessment", role: L ? "운영 단계 에너지/환경 데이터" : "O&M phase energy/environmental data" },
  ];

  const operationDocTypes = [
    { type: L ? "점검보고서" : "Inspection Report", formats: "PDF, DOCX", icon: ShieldCheck, color: "text-red-600" },
    { type: L ? "유지관리 BIM" : "Maintenance BIM", formats: "IFC", icon: Box, color: "text-blue-600" },
    { type: L ? "보수이력" : "Repair History", formats: "XLSX", icon: FileSpreadsheet, color: "text-green-600" },
    { type: L ? "설비 매뉴얼" : "Equipment Manual", formats: "PDF, DOCX", icon: FileText, color: "text-indigo-600" },
    { type: L ? "에너지 데이터" : "Energy Data", formats: "XLSX, CSV", icon: FileSpreadsheet, color: "text-amber-600" },
    { type: L ? "안전진단서" : "Safety Diagnosis", formats: "PDF", icon: ShieldCheck, color: "text-violet-600" },
  ];

  const pipelineSteps = [
    { step: L ? "1. 유지관리 문서 등록" : "1. Document Registration", desc: L ? "점검보고서, 보수이력 등을 CDE에 등록하고 자산 정보와 연결합니다." : "Register inspection reports, repair history in CDE and link to assets." },
    { step: L ? "2. 데이터 추출" : "2. Data Extraction", desc: L ? "문서에서 점검 결과, 측정값, 상태 정보를 자동 추출합니다." : "Auto-extract inspection results, measurements, and condition data." },
    { step: L ? "3. 이력 검증" : "3. History Verification", desc: L ? "유지관리 기준에 따라 점검 주기, 보수 이력의 완전성을 검증합니다." : "Verify inspection cycle and repair history completeness." },
    { step: L ? "4. 자산 매핑" : "4. Asset Mapping", desc: L ? "시설물 구성요소와 bSDD 표준 분류를 매핑하고 COBie 데이터를 생성합니다." : "Map components to bSDD and generate COBie data." },
    { step: L ? "5. AI 분석 변환" : "5. AI Transform", desc: L ? "유지관리 데이터를 AI 학습용 시계열/패턴 데이터로 변환합니다." : "Transform into time-series/pattern data for AI training." },
    { step: L ? "6. 예측 모델 지원" : "6. Predictive Support", desc: L ? "변환된 데이터를 AI Data Lake에 적재하여 예측 유지보수 모델을 지원합니다." : "Load into AI Data Lake for predictive maintenance models." },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-green-50 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{L ? "유지관리 단계" : "O&M Phase"}</h1>
            <p className="text-xs text-muted-foreground">{L ? "ISO 19650-3 + ISO 55000 기반" : "Based on ISO 19650-3 + ISO 55000"}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {L ? "시설물 유지관리 단계에서 산출되는 점검보고서, 보수이력, 에너지 데이터 등을 표준에 기반하여 관리하고, 예측 유지보수를 위한 AI 데이터로 변환합니다."
            : "Manage inspection reports, repair history, energy data from the O&M phase based on standards, and transform into AI data for predictive maintenance."}
        </p>
      </div>

      {/* === 1. PROJECT + UPLOAD === */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold">{L ? "프로젝트 & 문서 등록" : "Project & Document Upload"}</h2>
        </div>

        <ProjectSelector
          projects={projects}
          selectedProject={selectedProject}
          lifecyclePhase="operation"
          onSelect={setSelectedProject}
          onProjectCreated={(p) => {
            setProjects((prev) => [...prev, p]);
            setSelectedProject(p.id);
          }}
        />

        {selectedProject ? (
          <>
            <FileUpload projectId={selectedProject} lifecyclePhase="operation" onUpload={refreshFiles} />
            {files.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{L ? `등록된 파일 (${files.length})` : `Registered Files (${files.length})`}</h3>
                <FileListWithPreview
                  files={files}
                  projectId={selectedProject}
                  phaseColor="emerald"
                  onDelete={async (file) => { await projectsApi.deleteFile(selectedProject, file.id); refreshFiles(); }}
                />
              </div>
            )}
          </>
        ) : null}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-semibold text-muted-foreground mb-2">{L ? "지원 문서 유형" : "Accepted Document Types"}</p>
          <div className="flex flex-wrap gap-2">
            {operationDocTypes.map((doc) => (
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
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div><p className="font-semibold text-xs">{step.step}</p><p className="text-xs text-muted-foreground">{step.desc}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* === 3. STANDARDS === */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-bold mb-3">{L ? "적용 표준" : "Applied Standards"}</h2>
        <div className="grid gap-1.5 md:grid-cols-2">
          {operationStandards.map((std) => (
            <div key={std.code} className="flex items-center gap-3 rounded-lg bg-muted/30 p-2.5">
              <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded w-24 text-center flex-shrink-0">{std.code}</span>
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
