"use client";

import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  Clock,
  PlayCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { PipelineRun } from "@/lib/api/pipeline";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Parse date string from backend (UTC without timezone marker) to proper Date object.
 * Backend sends dates like "2026-03-10T01:02:46.041409" without 'Z' suffix.
 */
function parseUTCDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // If the date string doesn't end with 'Z' or timezone offset, treat as UTC
  if (!dateStr.endsWith('Z') && !dateStr.match(/[+-]\d{2}:\d{2}$/)) {
    return new Date(dateStr + 'Z');
  }
  return new Date(dateStr);
}

interface PipelineTimelineProps {
  runs: PipelineRun[];
  onSelect?: (run: PipelineRun) => void;
  selectedId?: string;
}

export function PipelineTimeline({
  runs,
  onSelect,
  selectedId,
}: PipelineTimelineProps) {
  const runList = Array.isArray(runs) ? runs : [];

  if (runList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Clock className="mb-2 h-8 w-8 opacity-30" />
        <p className="text-sm">No pipeline runs yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {runList.map((run, index) => (
        <TimelineItem
          key={run.id}
          run={run}
          isSelected={selectedId === run.id}
          isLast={index === runList.length - 1}
          onClick={() => onSelect?.(run)}
        />
      ))}
    </div>
  );
}

interface TimelineItemProps {
  run: PipelineRun;
  isSelected: boolean;
  isLast: boolean;
  onClick: () => void;
}

function TimelineItem({ run, isSelected, isLast, onClick }: TimelineItemProps) {
  const StatusIcon = {
    pending: Clock,
    running: PlayCircle,
    completed: CheckCircle,
    failed: XCircle,
    cancelled: AlertCircle,
  }[run.status] || Clock;

  const statusColor = {
    pending: "text-muted-foreground",
    running: "text-blue-500",
    completed: "text-green-500",
    failed: "text-destructive",
    cancelled: "text-yellow-500",
  }[run.status] || "text-muted-foreground";

  const statusBadgeVariant = {
    pending: "secondary",
    running: "default",
    completed: "success",
    failed: "destructive",
    cancelled: "warning",
  }[run.status] as "secondary" | "default" | "success" | "destructive" | "warning";

  return (
    <div className="relative flex gap-4">
      {/* Timeline Line */}
      {!isLast && (
        <div className="absolute left-[15px] top-8 h-full w-px bg-border" />
      )}

      {/* Icon */}
      <div className={cn("relative z-10 flex-shrink-0 rounded-full bg-background p-1", statusColor)}>
        <StatusIcon className="h-6 w-6" />
      </div>

      {/* Content */}
      <button
        onClick={onClick}
        className={cn(
          "flex-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
          isSelected && "border-primary bg-primary/5"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {run.id.slice(0, 8)}
            </span>
            <Badge variant={statusBadgeVariant}>{run.status}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(parseUTCDate(run.created_at), { addSuffix: true })}
          </span>
        </div>

        {run.current_stage && run.status === "running" && (
          <p className="mt-1 text-sm text-muted-foreground">
            Current stage: <span className="font-medium">{run.current_stage}</span>
            {run.progress_percent > 0 && ` (${run.progress_percent}%)`}
          </p>
        )}

        {run.status === "completed" && run.completed_at && run.started_at && (
          <p className="mt-1 text-xs text-muted-foreground">
            Duration:{" "}
            {(
              (parseUTCDate(run.completed_at).getTime() -
                parseUTCDate(run.started_at).getTime()) /
              1000
            ).toFixed(1)}
            s
          </p>
        )}
      </button>
    </div>
  );
}

export default PipelineTimeline;
