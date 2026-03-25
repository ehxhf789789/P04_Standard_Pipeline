"use client";

import { useState } from "react";
import {
  FileText,
  Box,
  FileSpreadsheet,
  Eye,
  Trash2,
} from "lucide-react";
import { ProjectFile, projectsApi } from "@/lib/api/projects";
import { FileDetailPanel } from "@/components/project/FileDetailPanel";
import { useLanguageStore } from "@/store/languageStore";

interface Props {
  files: ProjectFile[];
  projectId: string;
  onDelete?: (file: ProjectFile) => void;
  phaseColor?: string;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "ifc") return <Box className="h-4 w-4 text-blue-600" />;
  if (["pdf"].includes(ext)) return <FileText className="h-4 w-4 text-red-600" />;
  if (["docx", "doc", "hwpx", "hwp"].includes(ext)) return <FileText className="h-4 w-4 text-indigo-600" />;
  if (["xlsx", "xls", "csv"].includes(ext)) return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (["pptx", "ppt"].includes(ext)) return <FileText className="h-4 w-4 text-orange-600" />;
  return <FileText className="h-4 w-4 text-gray-600" />;
}

export function FileListWithPreview({ files, projectId, onDelete, phaseColor = "blue" }: Props) {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);

  const handleDelete = (file: ProjectFile) => {
    if (!confirm(L ? `${file.original_filename} 삭제?` : `Delete ${file.original_filename}?`)) return;
    onDelete?.(file);
  };

  if (files.length === 0) return null;

  return (
    <>
      <div className="space-y-1">
        {files.map((file) => (
          <div
            key={file.id}
            className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all hover:bg-blue-50/50 hover:border-blue-200 ${
              selectedFile?.id === file.id ? "bg-blue-50 border-blue-300 ring-1 ring-blue-200" : ""
            }`}
            onClick={() => setSelectedFile(file)}
          >
            {getFileIcon(file.original_filename)}

            <span className="text-sm font-medium flex-1 truncate">{file.original_filename}</span>

            <span className="text-[10px] text-muted-foreground flex-shrink-0">{file.size_kb.toFixed(0)} KB</span>

            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${
              file.cde_state === "published" ? "bg-green-100 text-green-700" :
              file.cde_state === "shared" ? "bg-blue-100 text-blue-700" :
              "bg-slate-100 text-slate-500"
            }`}>{file.cde_state.toUpperCase()}</span>

            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${
              file.ai_status === "completed" ? "bg-emerald-100 text-emerald-700" :
              file.ai_status === "processing" ? "bg-amber-100 text-amber-700" :
              "bg-slate-100 text-slate-500"
            }`}>
              {file.ai_status === "completed" ? "OK" : file.ai_status === "processing" ? "..." : "pending"}
            </span>

            <button
              onClick={(e) => { e.stopPropagation(); setSelectedFile(file); }}
              className="p-1 rounded hover:bg-blue-100"
              title={L ? "미리보기" : "Preview"}
            >
              <Eye className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                className="p-1 rounded hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Slide panel */}
      {selectedFile && (
        <FileDetailPanel
          file={selectedFile}
          projectId={projectId}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </>
  );
}
