"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileUp,
  Loader2,
  X,
  CheckCircle,
  FileText,
  Box,
  FileSpreadsheet,
  Presentation,
  File,
  Image,
} from "lucide-react";
import { projectsApi } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  projectId: string;
  lifecyclePhase?: string;
  onUpload?: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

const SUPPORTED_EXTENSIONS = [
  ".ifc", ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv",
  ".pptx", ".ppt", ".hwpx", ".hwp", ".png", ".jpg", ".jpeg",
  ".tiff", ".ids", ".bcf", ".bcfzip",
];

const ACCEPT_STRING = SUPPORTED_EXTENSIONS.join(",");

const FORMAT_GROUPS = [
  { label: "BIM", exts: "IFC", icon: Box, color: "text-blue-600" },
  { label: "Document", exts: "PDF, DOCX, HWPX", icon: FileText, color: "text-red-600" },
  { label: "Spreadsheet", exts: "XLSX, CSV", icon: FileSpreadsheet, color: "text-green-600" },
  { label: "Presentation", exts: "PPTX", icon: Presentation, color: "text-orange-600" },
  { label: "Image", exts: "PNG, JPG", icon: Image, color: "text-purple-600" },
];

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "ifc") return <Box className="h-4 w-4 text-blue-600" />;
  if (["pdf"].includes(ext)) return <FileText className="h-4 w-4 text-red-600" />;
  if (["docx", "doc", "hwpx", "hwp"].includes(ext)) return <FileText className="h-4 w-4 text-indigo-600" />;
  if (["xlsx", "xls", "csv"].includes(ext)) return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (["pptx", "ppt"].includes(ext)) return <Presentation className="h-4 w-4 text-orange-600" />;
  if (["png", "jpg", "jpeg", "tiff"].includes(ext)) return <Image className="h-4 w-4 text-purple-600" />;
  return <File className="h-4 w-4 text-gray-600" />;
}

export function FileUpload({ projectId, lifecyclePhase, onUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const isValidFile = (filename: string) => {
    const ext = "." + (filename.split(".").pop()?.toLowerCase() || "");
    return SUPPORTED_EXTENSIONS.includes(ext);
  };

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

    const files = Array.from(e.dataTransfer.files).filter((f) => isValidFile(f.name));
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
        setUploadingFiles((prev) =>
          prev.map((u) => (u.file === file ? { ...u, progress: 30 } : u))
        );

        await projectsApi.uploadFile(projectId, file, lifecyclePhase);

        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, progress: 100, status: "success" } : u
          )
        );
      } catch (error: any) {
        const errorMsg = error?.response?.data?.detail || "Upload failed";
        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: "error", error: errorMsg } : u
          )
        );
      }
    }

    onUpload?.();

    setTimeout(() => {
      setUploadingFiles((prev) => prev.filter((u) => u.status !== "success"));
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
          "border-2 border-dashed transition-all",
          isDragging && "border-primary bg-primary/5 scale-[1.01]"
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
          <p className="mb-1 font-medium">
            {isDragging ? "Drop files here" : "Drag & drop construction documents"}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            All construction lifecycle documents supported
          </p>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-2 h-4 w-4" />
            Browse Files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_STRING}
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Supported Formats */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {FORMAT_GROUPS.map((group) => (
              <div key={group.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <group.icon className={`h-3.5 w-3.5 ${group.color}`} />
                <span>{group.exts}</span>
              </div>
            ))}
          </div>
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
              {getFileIcon(upload.file.name)}
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
