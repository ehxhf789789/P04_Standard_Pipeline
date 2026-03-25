"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, FolderOpen, Loader2, FileText, CheckCircle, Clock, PenTool, HardHat, Wrench, Trash2 } from "lucide-react";
import { projectsApi, Project } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguageStore } from "@/store/languageStore";

const phaseConfig = {
  design: { icon: PenTool, color: "from-blue-500 to-blue-600", bg: "bg-blue-50 border-blue-200", label_ko: "설계 단계", label_en: "Design Phase", href: "/lifecycle/design" },
  construction: { icon: HardHat, color: "from-amber-500 to-orange-500", bg: "bg-amber-50 border-amber-200", label_ko: "시공 단계", label_en: "Construction Phase", href: "/lifecycle/construction" },
  operation: { icon: Wrench, color: "from-emerald-500 to-green-600", bg: "bg-emerald-50 border-emerald-200", label_ko: "유지관리 단계", label_en: "O&M Phase", href: "/lifecycle/operation" },
};

export default function ProjectsPage() {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    projectsApi.list(1, 100)
      .then((data) => setProjects(data.items || []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const grouped: Record<string, Project[]> = { design: [], construction: [], operation: [], unassigned: [] };
  projects.forEach((p) => {
    const phase = p.lifecycle_phase || "unassigned";
    if (!grouped[phase]) grouped[phase] = [];
    grouped[phase].push(p);
  });

  const handleDelete = async (id: string) => {
    if (!confirm(L ? "프로젝트를 삭제하시겠습니까?" : "Delete this project?")) return;
    try {
      await projectsApi.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e) { console.error(e); }
  };

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{L ? "프로젝트 관리" : "Project Management"}</h1>
          <p className="text-sm text-muted-foreground">
            {L ? "건설 전생애주기 단계별 프로젝트를 관리합니다" : "Manage projects across construction lifecycle phases"}
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {L ? `전체 ${projects.length}개 프로젝트` : `${projects.length} total projects`}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-3">
        {(["design", "construction", "operation"] as const).map((phase) => {
          const config = phaseConfig[phase];
          const Icon = config.icon;
          const count = grouped[phase]?.length || 0;
          return (
            <Link key={phase} href={config.href} className={`rounded-xl border ${config.bg} p-4 hover:shadow-md transition-all`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${config.color} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{L ? config.label_ko : config.label_en}</p>
                  <p className="text-xs text-muted-foreground">{count} {L ? "프로젝트" : "projects"}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Projects by phase */}
      {(["design", "construction", "operation"] as const).map((phase) => {
        const config = phaseConfig[phase];
        const Icon = config.icon;
        const phaseProjects = grouped[phase] || [];

        return (
          <div key={phase} className="rounded-xl border bg-card">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-bold text-sm">{L ? config.label_ko : config.label_en}</h2>
                <span className="text-xs text-muted-foreground">({phaseProjects.length})</span>
              </div>
              <Link href={config.href} className="text-xs text-primary hover:underline">
                {L ? "단계로 이동 →" : "Go to phase →"}
              </Link>
            </div>

            {phaseProjects.length === 0 ? (
              <div className="px-5 py-6 text-center text-muted-foreground text-sm">
                {L ? "프로젝트 없음" : "No projects"}
                <span className="mx-2">—</span>
                <Link href={config.href} className="text-primary hover:underline">
                  {L ? "생성하기" : "Create one"}
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {phaseProjects.map((project) => (
                  <div key={project.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    <Link href={`/projects/${project.id}`} className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{project.name}</p>
                        {project.description && <p className="text-xs text-muted-foreground truncate">{project.description}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">{project.file_count || project.ifc_file_count || 0} {L ? "파일" : "files"}</span>
                      {project.latest_run_status && (
                        <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                          project.latest_run_status === "completed" ? "bg-green-100 text-green-700"
                            : project.latest_run_status === "running" ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>{project.latest_run_status}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{new Date(project.created_at).toLocaleDateString()}</span>
                    </Link>
                    <button onClick={() => handleDelete(project.id)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Unassigned projects */}
      {grouped.unassigned?.length > 0 && (
        <div className="rounded-xl border bg-amber-50 border-amber-200">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center justify-between">
            <h2 className="font-bold text-sm text-amber-800">
              {L ? "⚠ 미분류 프로젝트" : "⚠ Unassigned Projects"} ({grouped.unassigned.length})
            </h2>
            <span className="text-[10px] text-amber-600">
              {L ? "단계를 배정해주세요" : "Please assign a lifecycle phase"}
            </span>
          </div>
          <div className="divide-y divide-amber-200">
            {grouped.unassigned.map((project) => (
              <div key={project.id} className="flex items-center gap-3 px-5 py-3">
                <Link href={`/projects/${project.id}`} className="flex-1 flex items-center gap-3 min-w-0">
                  <p className="text-sm font-medium truncate">{project.name}</p>
                  <span className="text-xs text-muted-foreground">{project.file_count || project.ifc_file_count || 0} {L ? "파일" : "files"}</span>
                </Link>
                {/* Phase assignment dropdown */}
                <select
                  defaultValue=""
                  onChange={async (e) => {
                    if (!e.target.value) return;
                    try {
                      await projectsApi.update(project.id, { lifecycle_phase: e.target.value } as any);
                      // Refresh
                      const data = await projectsApi.list(1, 100);
                      setProjects(data.items || []);
                    } catch (err) { console.error(err); }
                  }}
                  className="rounded-md border text-[11px] px-2 py-1 bg-white"
                >
                  <option value="">{L ? "단계 배정..." : "Assign phase..."}</option>
                  <option value="design">{L ? "설계 단계" : "Design"}</option>
                  <option value="construction">{L ? "시공 단계" : "Construction"}</option>
                  <option value="operation">{L ? "유지관리 단계" : "O&M"}</option>
                </select>
                <button onClick={() => handleDelete(project.id)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
