"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileUp, Loader2, X, CheckCircle } from "lucide-react";
import { projectsApi } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  projectId: string;
  onUpload?: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

export function FileUpload({ projectId, onUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.toLowerCase().endsWith(".ifc")
    );
    if (files.length > 0) {
      uploadFiles(files);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFiles(files);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const uploadFiles = async (files: File[]) => {
    const newUploads: UploadingFile[] = files.map((file) => ({
      file,
      progress: 0,
      status: "uploading" as const,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploads]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Simulate progress (actual progress would come from axios)
        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, progress: 30 } : u
          )
        );

        await projectsApi.uploadFile(projectId, file);

        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, progress: 100, status: "success" } : u
          )
        );
      } catch (error) {
        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.file === file
              ? { ...u, status: "error", error: "Upload failed" }
              : u
          )
        );
      }
    }

    onUpload?.();

    // Clear successful uploads after a delay
    setTimeout(() => {
      setUploadingFiles((prev) =>
        prev.filter((u) => u.status !== "success")
      );
    }, 3000);
  };

  const removeFile = (file: File) => {
    setUploadingFiles((prev) => prev.filter((u) => u.file !== file));
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragging && "border-primary bg-primary/5"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Upload
            className={cn(
              "mb-3 h-10 w-10 text-muted-foreground",
              isDragging && "text-primary"
            )}
          />
          <p className="mb-2 font-medium">
            {isDragging ? "Drop files here" : "Drag & drop IFC files"}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">or</p>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-2 h-4 w-4" />
            Browse Files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".ifc"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Supports IFC 2x3 and IFC 4.x formats (ISO 16739-1:2024)
          </p>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((upload, index) => (
            <div
              key={`${upload.file.name}-${index}`}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium">
                    {upload.file.name}
                  </p>
                  {upload.status === "success" && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {upload.status === "uploading" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
                {upload.status === "uploading" && (
                  <Progress value={upload.progress} className="mt-2 h-1" />
                )}
                {upload.status === "error" && (
                  <p className="mt-1 text-xs text-destructive">{upload.error}</p>
                )}
              </div>
              {upload.status !== "uploading" && (
                <button
                  onClick={() => removeFile(upload.file)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
