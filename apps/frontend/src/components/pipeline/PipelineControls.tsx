"use client";

import { useState } from "react";
import { Play, Square, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pipelineApi, PipelineRunConfig } from "@/lib/api/pipeline";

interface PipelineControlsProps {
  projectId: string;
  isRunning: boolean;
  isCompleted: boolean;
  onStatusChange?: () => void;
}

export function PipelineControls({
  projectId,
  isRunning,
  isCompleted,
  onStatusChange,
}: PipelineControlsProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await pipelineApi.start(projectId);
      onStatusChange?.();
    } catch (error: any) {
      const message = error?.response?.data?.detail || "Pipeline start failed";
      alert(message);
      console.error("Failed to start pipeline:", error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await pipelineApi.cancel(projectId);
    } catch (error: any) {
      // 404 means no active pipeline - just refresh state
      if (error?.response?.status !== 404) {
        console.error("Failed to cancel pipeline:", error);
      }
    } finally {
      setIsCancelling(false);
      onStatusChange?.(); // Always refresh status after cancel attempt
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isRunning ? (
        <Button
          variant="destructive"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Square className="mr-2 h-4 w-4" />
          )}
          Cancel Pipeline
        </Button>
      ) : (
        <Button onClick={handleStart} disabled={isStarting}>
          {isStarting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {isCompleted ? "Run Again" : "Start Pipeline"}
        </Button>
      )}

      {!isRunning && (
        <Button variant="outline" onClick={onStatusChange}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      )}
    </div>
  );
}

export default PipelineControls;
