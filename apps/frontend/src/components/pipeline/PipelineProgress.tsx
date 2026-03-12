"use client";

import { useMemo } from "react";
import {
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
  FileCode,
  CheckSquare,
  Sparkles,
  Network,
  Package,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageProgress } from "@/lib/api/pipeline";
import { cn } from "@/lib/utils";

const STAGE_CONFIG = {
  parse: {
    name: "Parse",
    description: "IFC file parsing with IfcOpenShell",
    icon: FileCode,
  },
  validate: {
    name: "Validate",
    description: "IDS rules from LOIN + bSDD",
    icon: CheckSquare,
  },
  enrich: {
    name: "Enrich",
    description: "bSDD standardization",
    icon: Sparkles,
  },
  transform: {
    name: "Transform",
    description: "4 AI output formats",
    icon: Network,
  },
  package: {
    name: "Package",
    description: "Summary & reports",
    icon: Package,
  },
};

interface PipelineProgressProps {
  status: string;
  currentStage?: string;
  progressPercent: number;
  stages: StageProgress[];
  errorMessage?: string;
}

export function PipelineProgress({
  status,
  currentStage,
  progressPercent,
  stages,
  errorMessage,
}: PipelineProgressProps) {
  const statusBadge = useMemo(() => {
    switch (status) {
      case "running":
        return <Badge variant="default">Running</Badge>;
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "cancelled":
        return <Badge variant="warning">Cancelled</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }, [status]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Pipeline Progress</CardTitle>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {/* Stage List */}
        <div className="space-y-3">
          {Object.entries(STAGE_CONFIG).map(([stageKey, config], index) => {
            const stageData = stages.find((s) => s.stage === stageKey);
            const stageStatus = stageData?.status || "pending";
            const isActive = currentStage === stageKey && status === "running";

            return (
              <StageItem
                key={stageKey}
                number={index + 1}
                name={config.name}
                description={config.description}
                icon={config.icon}
                status={stageStatus}
                isActive={isActive}
                progress={stageData?.progress_percent}
                message={stageData?.message}
                duration={stageData?.duration_ms}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface StageItemProps {
  number: number;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: string;
  isActive: boolean;
  progress?: number;
  message?: string;
  duration?: number;
}

function StageItem({
  number,
  name,
  description,
  icon: Icon,
  status,
  isActive,
  progress,
  message,
  duration,
}: StageItemProps) {
  const StatusIcon = useMemo(() => {
    if (isActive) {
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    }
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "running":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground/40" />;
    }
  }, [status, isActive]);

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-lg border p-3 transition-colors",
        isActive && "border-primary bg-primary/5",
        status === "completed" && "bg-green-50/50 dark:bg-green-950/20",
        status === "failed" && "bg-destructive/5"
      )}
    >
      <div className="flex-shrink-0">{StatusIcon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            Stage {number}: {name}
          </span>
          {duration && (
            <span className="text-xs text-muted-foreground">
              ({(duration / 1000).toFixed(1)}s)
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {isActive && progress !== undefined && (
          <div className="mt-2 space-y-1">
            <Progress value={progress} className="h-1" />
            {message && (
              <p className="text-xs text-muted-foreground">{message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PipelineProgress;
