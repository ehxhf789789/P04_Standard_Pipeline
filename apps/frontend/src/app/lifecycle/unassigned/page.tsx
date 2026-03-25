"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderOpen,
  Upload,
  FileText,
  Box,
  FileSpreadsheet,
  ShieldCheck,
  ArrowRight,
  Plus,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { projectsApi, Project, ProjectFile } from "@/lib/api/projects";
import { FileUpload } from "@/components/project/FileUpload";
import { FileListWithPreview } from "@/components/project/FileListWithPreview";
import { ProjectSelector } from "@/components/project/ProjectSelector";
import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/store/languageStore";

export default function UnassignedPhasePage() {
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
        const unassignedProjects = (allData.items || []).filter(
          (p) => !p.lifecycle_phase || p.lifecycle_phase === "unassigned"
        );
        setProjects(unassignedProjects);
        if (unassignedProjects.length > 0) setSelectedProject(unassignedProjects[0].id);
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    projectsApi.listFiles(selectedProject)
      .then((data) => setFiles(data.files || []))
      .catch(console.error);
  }, [selectedProject]);

  const refreshFiles = async () => {
    if (!selectedProject) return;
    const data = await projectsApi.listFiles(selectedProject);
    setFiles(data.files || []);
  };

  const handleAssignPhase = async (projectId: string, phase: string) => {
    try {
      await projectsApi.update(projectId, { lifecycle_phase: phase } as any);
      // Re-fetch — the assigned project should disappear from this list
      const allData = await projectsApi.list(1, 100);
      const unassignedProjects = (allData.items || []).filter(
        (p) => !p.lifecycle_phase || p.lifecycle_phase === "unassigned"
      );
      setProjects(unassignedProjects);
      if (selectedProject === projectId) {
        setSelectedProject(unassignedProjects.length > 0 ? unassignedProjects[0].id : null);
        setFiles([]);
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm(L ? "프로젝트를 삭제하시겠습니까?" : "Delete this project?")) return;
    try {
      await projectsApi.delete(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (selectedProject === projectId) {
        const remaining = projects.filter((p) => p.id !== projectId);
        setSelectedProject(remaining.length > 0 ? remaining[0].id : null);
        setFiles([]);
      }
    } catch (e) { console.error(e); }
  };

  const docTypes = [
    { type: L ? "설계도면" : "Design Drawings", formats: "PDF", icon: FileText, color: "text-red-600" },
    { type: L ? "BIM 모델" : "BIM Model", formats: "IFC", icon: Box, color: "text-blue-600" },
    { type: L ? "문서" : "Documents", formats: "DOCX, HWPX, PPTX", icon: FileText, color: "text-indigo-600" },
    { type: L ? "스프레드시트" : "Spreadsheets", formats: "XLSX, CSV", icon: FileSpreadsheet, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-gray-600 text-white">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{L ? "미분류 프로젝트" : "Unassigned Projects"}</h1>
            <p className="text-xs text-muted-foreground">
              {L ? "아직 건설 전생애주기 단계가 배정되지 않은 프로젝트" : "Projects not yet assigned to a lifecycle phase"}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {L
            ? "미분류 프로젝트에 파일을 등록하고, 이후 설계·시공·유지관리 단계로 배정할 수 있습니다. 단계를 배정하면 해당 표준 기반 검증 파이프라인이 자동으로 적용됩니다."
            : "Upload files to unassigned projects, then assign them to Design, Construction, or O&M phases. Assigning a phase automatically applies the corresponding standards-based validation pipeline."}
        </p>
      </div>

      {/* Project + Upload */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-bold">{L ? "프로젝트 & 문서 등록" : "Project & Document Upload"}</h2>
        </div>

        <ProjectSelector
          projects={projects}
          selectedProject={selectedProject}
          lifecyclePhase="unassigned"
          onSelect={setSelectedProject}
          onProjectCreated={(p) => {
            setProjects((prev) => [...prev, p]);
            setSelectedProject(p.id);
          }}
        />

        {selectedProject ? (
          <>
            <FileUpload projectId={selectedProject} onUpload={refreshFiles} />
            {files.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  {L ? `등록된 파일 (${files.length})` : `Registered Files (${files.length})`}
                </h3>
                <FileListWithPreview
                  files={files}
                  projectId={selectedProject}
                  phaseColor="slate"
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
            {docTypes.map((doc) => (
              <div key={doc.type} className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                <doc.icon className={`h-3.5 w-3.5 ${doc.color}`} />
                <span className="font-medium">{doc.type}</span>
                <span className="text-muted-foreground font-mono text-[10px]">{doc.formats}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Phase assignment */}
      {projects.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold">{L ? "단계 배정" : "Assign Lifecycle Phase"}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {L
              ? "프로젝트를 적절한 건설 전생애주기 단계에 배정하면, 해당 단계의 표준(ISO 19650-2/3, ISO 55000 등)에 기반한 검증이 자동으로 적용됩니다."
              : "Assigning a project to a lifecycle phase automatically applies the corresponding standards-based validation (ISO 19650-2/3, ISO 55000, etc.)."}
          </p>
          <div className="divide-y rounded-lg border">
            {projects.map((project) => (
              <div key={project.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <Link href={`/projects/${project.id}`} className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{project.name}</p>
                  {project.description && <p className="text-xs text-muted-foreground truncate">{project.description}</p>}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {project.file_count || project.ifc_file_count || 0} {L ? "파일" : "files"}
                </span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleAssignPhase(project.id, e.target.value);
                  }}
                  className="rounded-md border text-[11px] px-2 py-1.5 bg-white dark:bg-slate-800 min-w-[120px]"
                >
                  <option value="">{L ? "단계 배정..." : "Assign phase..."}</option>
                  <option value="design">{L ? "설계 단계" : "Design"}</option>
                  <option value="construction">{L ? "시공 단계" : "Construction"}</option>
                  <option value="operation">{L ? "유지관리 단계" : "O&M"}</option>
                </select>
                <button onClick={() => handleDeleteProject(project.id)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-bold mb-3">{L ? "건설 전생애주기 단계" : "Construction Lifecycle Phases"}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { href: "/lifecycle/design", label: L ? "설계 단계" : "Design Phase", basis: "ISO 19650-2", color: "from-blue-500 to-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" },
            { href: "/lifecycle/construction", label: L ? "시공 단계" : "Construction Phase", basis: "ISO 19650-3", color: "from-amber-500 to-orange-500", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
            { href: "/lifecycle/operation", label: L ? "유지관리 단계" : "O&M Phase", basis: "ISO 55000", color: "from-emerald-500 to-green-600", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" },
          ].map((phase) => (
            <Link key={phase.href} href={phase.href} className={`rounded-xl border ${phase.bg} p-4 hover:shadow-md transition-all group`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{phase.label}</h3>
                  <p className="text-[10px] text-muted-foreground font-mono">{phase.basis}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
