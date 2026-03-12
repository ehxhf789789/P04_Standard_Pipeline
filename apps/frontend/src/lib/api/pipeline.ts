/**
 * Pipeline API
 */

import apiClient from "./client";

export interface StageProgress {
  stage: string;
  status: string;
  progress_percent?: number;
  message?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  summary?: Record<string, any>;
}

export interface PipelineStatus {
  run_id: string;
  project_id: string;
  status: string;
  current_stage?: string;
  progress_percent: number;
  stages: StageProgress[];
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface PipelineRun {
  id: string;
  project_id: string;
  ifc_file_id?: string;
  status: string;
  current_stage?: string;
  progress_percent: number;
  configuration: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface PipelineRunConfig {
  ifc_file_id?: string;
  loin_config_id?: string;
  options?: Record<string, any>;
}

export const pipelineApi = {
  start: async (projectId: string, config?: PipelineRunConfig): Promise<PipelineStatus> => {
    const { data } = await apiClient.post(`/projects/${projectId}/pipeline/run`, config ?? null);
    return data;
  },

  getStatus: async (projectId: string, runId?: string): Promise<PipelineStatus> => {
    const params = runId ? { run_id: runId } : {};
    const { data } = await apiClient.get(`/projects/${projectId}/pipeline/status`, { params });
    return data;
  },

  getHistory: async (projectId: string, limit = 20): Promise<{ items: PipelineRun[]; total: number }> => {
    const { data } = await apiClient.get(`/projects/${projectId}/pipeline/history`, {
      params: { limit },
    });
    return data;
  },

  cancel: async (projectId: string, runId?: string): Promise<void> => {
    const params = runId ? { run_id: runId } : {};
    await apiClient.post(`/projects/${projectId}/pipeline/cancel`, null, { params });
  },

  getResult: async (projectId: string, runId: string): Promise<any> => {
    const { data } = await apiClient.get(`/projects/${projectId}/pipeline/result/${runId}`);
    return data;
  },
};

export default pipelineApi;
