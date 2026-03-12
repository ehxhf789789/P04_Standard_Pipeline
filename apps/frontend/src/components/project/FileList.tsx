"use client";

import { FileCode, MoreVertical, Eye, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface IFCFile {
  id: string;
  filename: string;
  original_filename?: string;
  size_kb: number;
  schema_version?: string;
  uploaded_at?: string;
  element_count?: number;
}

interface FileListProps {
  files: IFCFile[];
  onView?: (file: IFCFile) => void;
  onDelete?: (file: IFCFile) => void;
}

export function FileList({ files, onView, onDelete }: FileListProps) {
  const fileList = Array.isArray(files) ? files : [];

  if (fileList.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <FileCode className="mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">No IFC files uploaded yet</p>
          <p className="text-xs">Upload files to start processing</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">IFC Files ({fileList.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {fileList.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              onView={() => onView?.(file)}
              onDelete={() => onDelete?.(file)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface FileItemProps {
  file: IFCFile;
  onView?: () => void;
  onDelete?: () => void;
}

function FileItem({ file, onView, onDelete }: FileItemProps) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3 min-w-0">
        <FileCode className="h-8 w-8 flex-shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="truncate font-medium">{file.original_filename || file.filename}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatFileSize(file.size_kb)}</span>
            {file.schema_version && (
              <>
                <span>•</span>
                <Badge variant="outline" className="text-xs">
                  {file.schema_version}
                </Badge>
              </>
            )}
            {file.element_count && (
              <>
                <span>•</span>
                <span>{file.element_count.toLocaleString()} elements</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onView && (
          <Button variant="ghost" size="icon" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}

function formatFileSize(kb: number): string {
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default FileList;
