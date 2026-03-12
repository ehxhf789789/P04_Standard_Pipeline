"use client";

import { useState, useEffect, useCallback } from "react";
import { useWebSocket, WebSocketMessage } from "./useWebSocket";
import { pipelineApi, PipelineStatus, StageProgress } from "@/lib/api/pipeline";

export interface UsePipelineStatusOptions {
  projectId: string;
  runId?: string;
  pollingInterval?: number;
  enableWebSocket?: boolean;
}

export function usePipelineStatus(options: UsePipelineStatusOptions) {
  const {
    projectId,
    runId,
    pollingInterval = 5000,
    enableWebSocket = true,
  } = options;

  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch status via REST API
  const fetchStatus = useCallback(async () => {
    try {
      const data = await pipelineApi.getStatus(projectId, runId);
      setStatus(data);
      setError(null);
    } catch (e: any) {
      // 404 means no pipeline runs - this is normal, not an error
      if (e?.response?.status === 404) {
        setStatus(null);
        setError(null);
      } else {
        setError(e as Error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, runId]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    const { event, data } = message;

    setStatus((prev) => {
      if (!prev) return prev;

      switch (event) {
        case "pipeline:started":
          return {
            ...prev,
            status: "running",
            started_at: new Date().toISOString(),
          };

        case "stage:started":
          return {
            ...prev,
            current_stage: data.stage,
            stages: prev.stages.map((s) =>
              s.stage === data.stage
                ? { ...s, status: "running", started_at: new Date().toISOString() }
                : s
            ),
          };

        case "stage:progress":
          return {
            ...prev,
            current_stage: data.stage,
            progress_percent: data.overall_progress || prev.progress_percent,
            stages: prev.stages.map((s) =>
              s.stage === data.stage
                ? {
                    ...s,
                    status: "running",
                    progress_percent: data.stage_progress || data.progress_percent,
                    message: data.message,
                  }
                : s
            ),
          };

        case "stage:completed":
          return {
            ...prev,
            stages: prev.stages.map((s) =>
              s.stage === data.stage
                ? {
                    ...s,
                    status: "completed",
                    progress_percent: 100,
                    completed_at: new Date().toISOString(),
                    duration_ms: data.duration_ms,
                    summary: data.summary,
                  }
                : s
            ),
          };

        case "pipeline:completed":
          return {
            ...prev,
            status: "completed",
            progress_percent: 100,
            completed_at: new Date().toISOString(),
          };

        case "pipeline:failed":
          return {
            ...prev,
            status: "failed",
            error_message: data.error,
          };

        case "pipeline:cancelled":
          return {
            ...prev,
            status: "cancelled",
          };

        default:
          return prev;
      }
    });
  }, []);

  // WebSocket connection
  const { isConnected } = useWebSocket(
    enableWebSocket ? `/ws/pipeline/${projectId}` : "",
    {
      onMessage: handleWebSocketMessage,
      reconnect: enableWebSocket,
    }
  );

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling fallback when WebSocket is not connected
  useEffect(() => {
    if (!enableWebSocket || isConnected) return;

    const interval = setInterval(fetchStatus, pollingInterval);
    return () => clearInterval(interval);
  }, [enableWebSocket, isConnected, fetchStatus, pollingInterval]);

  // Computed values
  const isRunning = status?.status === "running" || status?.status === "pending";
  const isCompleted = status?.status === "completed";
  const isFailed = status?.status === "failed";
  const currentStage = status?.current_stage;
  const progressPercent = status?.progress_percent || 0;

  return {
    status,
    isLoading,
    error,
    isRunning,
    isCompleted,
    isFailed,
    currentStage,
    progressPercent,
    isWebSocketConnected: isConnected,
    refresh: fetchStatus,
  };
}

export default usePipelineStatus;
