"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Box,
  Download,
  FileUp,
  Loader2,
  Settings,
  Trash2,
} from "lucide-react";
import { projectsApi, Project } from "@/lib/api/projects";
import { pipelineApi, PipelineRun } from "@/lib/api/pipeline";
import { usePipelineStatus } from "@/hooks/usePipelineStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineProgress } from "@/components/pipeline/PipelineProgress";
import { PipelineTimeline } from "@/components/pipeline/PipelineTimeline";
import { PipelineControls } from "@/components/pipeline/PipelineControls";
import { FileUpload } from "@/components/project/FileUpload";
import { FileList } from "@/components/project/FileList";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [history, setHistory] = useState<PipelineRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    status,
    isRunning,
    isCompleted,
    progressPercent,
    currentStage,
    refresh,
  } = usePipelineStatus({
    projectId,
    enableWebSocket: true,
  });

  const fetchProject = useCallback(async () => {
    try {
      const [projectData, filesData, historyData] = await Promise.all([
        projectsApi.get(projectId),
        projectsApi.listFiles(projectId),
        pipelineApi.getHistory(projectId),
      ]);
      setProject(projectData);
      setFiles(filesData.files || filesData.items || filesData || []);
      setHistory(historyData.items || historyData || []);
    } catch (e) {
      setError("Failed to load project");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    try {
      await projectsApi.delete(projectId);
      router.push("/projects");
    } catch (e) {
      console.error("Failed to delete project:", e);
    }
  };

  const handleFileUpload = async () => {
    // Refresh both files and project (ifc_file_count is updated on upload)
    const [projectData, filesData] = await Promise.all([
      projectsApi.get(projectId),
      projectsApi.listFiles(projectId),
    ]);
    setProject(projectData);
    setFiles(filesData.files || filesData.items || filesData || []);
  };

  const handleFileView = (file: any) => {
    // Navigate to viewer with this file
    router.push(`/projects/${projectId}/viewer?file=${file.id}`);
  };

  const handleFileDelete = async (file: any) => {
    if (!confirm(`Delete ${file.original_filename || file.filename}?`)) {
      return;
    }
    try {
      await projectsApi.deleteFile(projectId, file.id);
      // Refresh files and project
      const [projectData, filesData] = await Promise.all([
        projectsApi.get(projectId),
        projectsApi.listFiles(projectId),
      ]);
      setProject(projectData);
      setFiles(filesData.files || filesData.items || filesData || []);
    } catch (e) {
      console.error("Failed to delete file:", e);
      alert("파일 삭제에 실패했습니다.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error || "Project not found"}
        </div>
        <Link href="/projects">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${projectId}/viewer`}>
            <Button variant="outline">
              <Box className="mr-2 h-4 w-4" />
              3D Viewer
            </Button>
          </Link>
          <Link href={`/projects/${projectId}/outputs`}>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Outputs
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Pipeline */}
        <div className="space-y-6 lg:col-span-2">
          {/* Pipeline Controls */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Pipeline</CardTitle>
                <PipelineControls
                  projectId={projectId}
                  isRunning={isRunning}
                  isCompleted={isCompleted}
                  onStatusChange={refresh}
                />
              </div>
            </CardHeader>
          </Card>

          {/* Pipeline Progress */}
          {status && (
            <PipelineProgress
              status={status.status}
              currentStage={currentStage}
              progressPercent={progressPercent}
              stages={status.stages}
              errorMessage={status.error_message}
            />
          )}

          {/* Tabs */}
          <Tabs defaultValue="files">
            <TabsList>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="history">Run History</TabsTrigger>
            </TabsList>
            <TabsContent value="files" className="space-y-4">
              <FileUpload projectId={projectId} onUpload={handleFileUpload} />
              <FileList
                files={files}
                onView={handleFileView}
                onDelete={handleFileDelete}
              />
            </TabsContent>
            <TabsContent value="history">
              <Card>
                <CardContent className="pt-6">
                  <PipelineTimeline runs={history} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/projects/${projectId}/validation`} className="block">
                <Button variant="ghost" className="w-full justify-start">
                  Validation Results
                </Button>
              </Link>
              <Link href={`/projects/${projectId}/enrichment`} className="block">
                <Button variant="ghost" className="w-full justify-start">
                  Enrichment Mappings
                </Button>
              </Link>
              <Link href={`/projects/${projectId}/outputs/knowledge-graph`} className="block">
                <Button variant="ghost" className="w-full justify-start">
                  Knowledge Graph
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{project.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IFC Files</span>
                <span className="font-medium">{project.ifc_file_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="font-medium">
                  {new Date(project.updated_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
