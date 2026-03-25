"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Box,
  Download,
  Loader2,
  Trash2,
  Play,
  RefreshCw,
  ShieldCheck,
  Layers,
  GitBranch,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Upload,
} from "lucide-react";
import { projectsApi, Project, ProjectFile } from "@/lib/api/projects";
import { pipelineApi, PipelineRun } from "@/lib/api/pipeline";
import { usePipelineStatus } from "@/hooks/usePipelineStatus";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineProgress } from "@/components/pipeline/PipelineProgress";
import { PipelineTimeline } from "@/components/pipeline/PipelineTimeline";
import { PipelineControls } from "@/components/pipeline/PipelineControls";
import { FileUpload } from "@/components/project/FileUpload";
import { FileList } from "@/components/project/FileList";
import { ProcessingReport } from "@/components/project/ProcessingReport";
import { useLanguageStore } from "@/store/languageStore";
import { queryApi, ParsedData } from "@/lib/api/query";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { lang } = useLanguageStore();
  const L = lang === "ko";

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [history, setHistory] = useState<PipelineRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileParsed, setSelectedFileParsed] = useState<ParsedData | null>(null);
  const [loadingParsed, setLoadingParsed] = useState(false);

  const { status, isRunning, isCompleted, progressPercent, currentStage, refresh } = usePipelineStatus({ projectId, enableWebSocket: true });

  const fetchProject = useCallback(async () => {
    try {
      const [projectData, filesData, historyData] = await Promise.all([
        projectsApi.get(projectId),
        projectsApi.listFiles(projectId),
        pipelineApi.getHistory(projectId),
      ]);
      setProject(projectData);
      setFiles(filesData.files || []);
      setHistory(historyData.items || historyData || []);
    } catch (e) {
      setError(L ? "프로젝트를 불러오지 못했습니다" : "Failed to load project");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const handleFileUpload = async () => {
    const [projectData, filesData] = await Promise.all([
      projectsApi.get(projectId),
      projectsApi.listFiles(projectId),
    ]);
    setProject(projectData);
    setFiles(filesData.files || []);
  };

  const handleFileView = async (file: any) => {
    setLoadingParsed(true);
    setSelectedFileParsed(null);
    try {
      const parsed = await queryApi.getParsedData(projectId, file.id);
      setSelectedFileParsed(parsed);
    } catch (e) {
      console.error("Parsed data not available:", e);
      setSelectedFileParsed(null);
    } finally {
      setLoadingParsed(false);
    }
  };

  const handleFileDelete = async (file: any) => {
    if (!confirm(L ? `${file.original_filename || file.filename} 삭제?` : `Delete ${file.original_filename || file.filename}?`)) return;
    try {
      await projectsApi.deleteFile(projectId, file.id);
      const [projectData, filesData] = await Promise.all([projectsApi.get(projectId), projectsApi.listFiles(projectId)]);
      setProject(projectData);
      setFiles(filesData.files || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!confirm(L ? "이 프로젝트를 삭제하시겠습니까?" : "Delete this project?")) return;
    try { await projectsApi.delete(projectId); router.push("/projects"); } catch (e) { console.error(e); }
  };

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  if (error || !project) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error || "Project not found"}</div>
        <Link href="/projects"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />{L ? "프로젝트 목록" : "Back to Projects"}</Button></Link>
      </div>
    );
  }

  const totalFiles = files.length;
  const bimFiles = files.filter((f) => f.category === "bim_model").length;
  const docFiles = files.filter((f) => f.category === "document").length;
  const otherFiles = totalFiles - bimFiles - docFiles;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-3 w-3" />
            {L ? "프로젝트" : "Projects"}
          </Link>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* === 1. FILE UPLOAD (TOP PRIORITY) === */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">{L ? "문서 등록" : "Upload Documents"}</h2>
          <span className="text-xs text-muted-foreground ml-auto">{totalFiles} {L ? "파일 등록됨" : "files registered"}</span>
        </div>
        <FileUpload projectId={projectId} onUpload={handleFileUpload} />

        {/* Registered Files */}
        {files.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-semibold">{L ? "등록된 파일" : "Registered Files"}</h3>
              <div className="flex gap-2 text-[10px]">
                {bimFiles > 0 && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">BIM: {bimFiles}</span>}
                {docFiles > 0 && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">DOC: {docFiles}</span>}
                {otherFiles > 0 && <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{L ? "기타" : "Other"}: {otherFiles}</span>}
              </div>
            </div>
            <FileList files={files} onView={handleFileView} onDelete={handleFileDelete} />
          </div>
        )}

        {/* Processing Report for selected file */}
        {loadingParsed && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {L ? "처리 보고서 로딩 중..." : "Loading processing report..."}
          </div>
        )}
        {selectedFileParsed && !loadingParsed && (
          <div className="mt-4 pt-4 border-t">
            <ProcessingReport
              data={selectedFileParsed}
              projectId={projectId}
              onDataUpdate={(updated) => setSelectedFileParsed(updated)}
            />
          </div>
        )}
      </div>

      {/* === 2. PIPELINE === */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">{L ? "파이프라인" : "Pipeline"}</h2>
            {status && (
              <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                status.status === "completed" ? "bg-green-100 text-green-700"
                  : status.status === "running" ? "bg-blue-100 text-blue-700"
                  : status.status === "failed" ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              }`}>
                {status.status}
              </span>
            )}
          </div>
          <PipelineControls projectId={projectId} isRunning={isRunning} isCompleted={isCompleted} onStatusChange={refresh} />
        </div>

        {status && (
          <PipelineProgress
            status={status.status}
            currentStage={currentStage}
            progressPercent={progressPercent}
            stages={status.stages}
            errorMessage={status.error_message}
          />
        )}
      </div>

      {/* === 3. OUTPUTS & HISTORY === */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <h3 className="font-bold text-sm mb-3">{L ? "AI 출력물" : "AI Outputs"}</h3>
          <Link href={`/projects/${projectId}/validation`} className="flex items-center gap-2.5 rounded-lg p-2.5 hover:bg-muted transition-colors">
            <ShieldCheck className="h-4 w-4 text-violet-600" />
            <div><p className="text-xs font-medium">{L ? "검증 결과" : "Validation Results"}</p><p className="text-[10px] text-muted-foreground">IDS 6-facet</p></div>
          </Link>
          <Link href={`/projects/${projectId}/enrichment`} className="flex items-center gap-2.5 rounded-lg p-2.5 hover:bg-muted transition-colors">
            <Layers className="h-4 w-4 text-amber-600" />
            <div><p className="text-xs font-medium">{L ? "보강 매핑" : "Enrichment Mappings"}</p><p className="text-[10px] text-muted-foreground">bSDD</p></div>
          </Link>
          <Link href={`/projects/${projectId}/outputs/knowledge-graph`} className="flex items-center gap-2.5 rounded-lg p-2.5 hover:bg-muted transition-colors">
            <GitBranch className="h-4 w-4 text-blue-600" />
            <div><p className="text-xs font-medium">{L ? "지식 그래프" : "Knowledge Graph"}</p><p className="text-[10px] text-muted-foreground">ifcOWL + BOT</p></div>
          </Link>
          <Link href={`/projects/${projectId}/outputs/embeddings`} className="flex items-center gap-2.5 rounded-lg p-2.5 hover:bg-muted transition-colors">
            <Box className="h-4 w-4 text-emerald-600" />
            <div><p className="text-xs font-medium">{L ? "벡터 임베딩" : "Vector Embeddings"}</p><p className="text-[10px] text-muted-foreground">384-dim</p></div>
          </Link>
          <Link href={`/projects/${projectId}/outputs`} className="flex items-center gap-2.5 rounded-lg p-2.5 hover:bg-muted transition-colors">
            <Download className="h-4 w-4 text-gray-600" />
            <div><p className="text-xs font-medium">{L ? "전체 출력물" : "All Outputs"}</p></div>
          </Link>
        </div>

        {/* Project Info */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-bold text-sm mb-3">{L ? "프로젝트 정보" : "Project Info"}</h3>
          <div className="space-y-2.5 text-sm">
            <InfoRow label={L ? "상태" : "Status"} value={project.latest_run_status || project.status} />
            <InfoRow label={L ? "전체 파일" : "Total Files"} value={String(totalFiles)} />
            <InfoRow label={L ? "BIM 파일" : "BIM Files"} value={String(bimFiles)} />
            <InfoRow label={L ? "문서 파일" : "Doc Files"} value={String(docFiles)} />
            <InfoRow label={L ? "생성일" : "Created"} value={new Date(project.created_at).toLocaleDateString()} />
            <InfoRow label={L ? "수정일" : "Updated"} value={new Date(project.updated_at).toLocaleDateString()} />
          </div>
        </div>

        {/* Run History */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-bold text-sm mb-3">{L ? "실행 이력" : "Run History"}</h3>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">{L ? "실행 이력 없음" : "No runs yet"}</p>
          ) : (
            <PipelineTimeline runs={history} />
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-xs">{value}</span>
    </div>
  );
}
