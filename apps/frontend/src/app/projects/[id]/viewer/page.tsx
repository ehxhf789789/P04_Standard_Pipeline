"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { IFCViewer } from "@/components/viewer/IFCViewer";
import { projectsApi } from "@/lib/api/projects";
import { API_BASE } from "@/lib/api/client";

export default function ViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const fileIdParam = searchParams.get("file");

  const [fileUrl, setFileUrl] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFileUrl() {
      setIsLoading(true);
      setError(null);
      try {
        const filesData = await projectsApi.listFiles(projectId);
        const files = filesData.files || filesData.items || filesData || [];

        if (files.length === 0) {
          setError("프로젝트에 IFC 파일이 없습니다.");
          return;
        }

        // Use specific file if provided, otherwise use first file
        const targetFile = fileIdParam
          ? files.find((f: any) => f.id === fileIdParam)
          : files[0];

        if (!targetFile) {
          setError("파일을 찾을 수 없습니다.");
          return;
        }

        // Build file URL - download from backend
        const url = `${API_BASE}/projects/${projectId}/files/${targetFile.id}/download`;
        setFileUrl(url);
      } catch (e) {
        console.error("Failed to load files:", e);
        setError("파일 목록을 불러오는데 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    loadFileUrl();
  }, [projectId, fileIdParam]);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Project
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">3D IFC Viewer</h1>
        </div>
      </div>

      {/* IFC Viewer */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : (
          <IFCViewer projectId={projectId} fileUrl={fileUrl} />
        )}
      </div>
    </div>
  );
}
