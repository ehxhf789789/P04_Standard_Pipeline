"use client";

import { useState } from "react";
import { Plus, FolderOpen, Check, X } from "lucide-react";
import { projectsApi, Project } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/store/languageStore";

interface Props {
  projects: Project[];
  selectedProject: string | null;
  lifecyclePhase: string;
  onSelect: (id: string) => void;
  onProjectCreated: (project: Project) => void;
}

export function ProjectSelector({
  projects,
  selectedProject,
  lifecyclePhase,
  onSelect,
  onProjectCreated,
}: Props) {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const phaseLabels: Record<string, Record<string, string>> = {
    design: { ko: "설계", en: "Design" },
    construction: { ko: "시공", en: "Construction" },
    operation: { ko: "유지관리", en: "O&M" },
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      const project = await projectsApi.create({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        lifecycle_phase: lifecyclePhase,
      } as any);
      onProjectCreated(project);
      setNewName("");
      setNewDesc("");
      setIsCreating(false);
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Project selector + create button */}
      <div className="flex items-center gap-2 flex-wrap">
        {projects.length > 0 && (
          <>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedProject || ""}
              onChange={(e) => onSelect(e.target.value)}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm min-w-[200px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        )}
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/50 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {L ? "새 프로젝트" : "New Project"}
          </button>
        )}
      </div>

      {/* Inline create form */}
      {isCreating && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-primary">
            {L
              ? `${phaseLabels[lifecyclePhase]?.ko || lifecyclePhase} 단계 — 새 프로젝트 생성`
              : `${phaseLabels[lifecyclePhase]?.en || lifecyclePhase} Phase — Create New Project`}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder={L ? "프로젝트 이름 (예: OO교량 설계)" : "Project name (e.g. OO Bridge Design)"}
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          </div>
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={L ? "설명 (선택사항)" : "Description (optional)"}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || isSubmitting}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {isSubmitting ? (L ? "생성 중..." : "Creating...") : (L ? "생성" : "Create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsCreating(false); setNewName(""); setNewDesc(""); }}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              {L ? "취소" : "Cancel"}
            </Button>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {L ? `단계: ${phaseLabels[lifecyclePhase]?.ko}` : `Phase: ${phaseLabels[lifecyclePhase]?.en}`}
            </span>
          </div>
        </div>
      )}

      {/* No projects message */}
      {projects.length === 0 && !isCreating && (
        <div className="text-center py-6 text-muted-foreground rounded-lg border border-dashed">
          <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {L ? "이 단계에 프로젝트가 없습니다" : "No projects in this phase"}
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            {L ? "첫 프로젝트 생성하기" : "Create your first project"}
          </button>
        </div>
      )}
    </div>
  );
}
