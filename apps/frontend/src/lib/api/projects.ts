/**
 * Projects API
 */

import apiClient from "./client";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  ifc_file_count: number;
  file_count?: number;
  lifecycle_phase?: string;
  latest_run_status?: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  lifecycle_phase?: string;
}

export interface ProjectList {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProjectFile {
  id: string;
  filename: string;
  original_filename: string;
  size_kb: number;
  category: string;
  file_type: string;
  standard: string;
  schema_version?: string;
  lifecycle_phase?: string;
  cde_state: string;
  ai_status: string;
  uploaded_at: string;
}

export interface FileListResponse {
  files: ProjectFile[];
  total: number;
  by_category: Record<string, number>;
}

export const projectsApi = {
  list: async (page = 1, pageSize = 20, lifecyclePhase?: string): Promise<ProjectList> => {
    const params: Record<string, any> = { page, page_size: pageSize };
    if (lifecyclePhase) params.lifecycle_phase = lifecyclePhase;
    const { data } = await apiClient.get("/projects", { params });
    return data;
  },

  get: async (id: string): Promise<Project> => {
    const { data } = await apiClient.get(`/projects/${id}`);
    return data;
  },

  create: async (project: ProjectCreate): Promise<Project> => {
    const { data } = await apiClient.post("/projects", project);
    return data;
  },

  update: async (id: string, updates: Partial<ProjectCreate>): Promise<Project> => {
    const { data } = await apiClient.patch(`/projects/${id}`, updates);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },

  uploadFile: async (projectId: string, file: File, lifecyclePhase?: string): Promise<ProjectFile> => {
    const formData = new FormData();
    formData.append("file", file);

    const params: Record<string, string> = {};
    if (lifecyclePhase) {
      params.lifecycle_phase = lifecyclePhase;
    }

    const { data } = await apiClient.post(
      `/projects/${projectId}/files/upload`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        params,
      }
    );
    return data;
  },

  listFiles: async (projectId: string, category?: string, lifecyclePhase?: string): Promise<FileListResponse> => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (lifecyclePhase) params.lifecycle_phase = lifecyclePhase;

    const { data } = await apiClient.get(`/projects/${projectId}/files`, { params });
    return data;
  },

  getFileStats: async (projectId: string): Promise<any> => {
    const { data } = await apiClient.get(`/projects/${projectId}/files/stats`);
    return data;
  },

  updateFilePhase: async (projectId: string, fileId: string, phase: string): Promise<ProjectFile> => {
    const { data } = await apiClient.patch(
      `/projects/${projectId}/files/${fileId}/phase`,
      null,
      { params: { lifecycle_phase: phase } }
    );
    return data;
  },

  updateCdeState: async (projectId: string, fileId: string, state: string): Promise<ProjectFile> => {
    const { data } = await apiClient.patch(
      `/projects/${projectId}/files/${fileId}/cde-state`,
      null,
      { params: { cde_state: state } }
    );
    return data;
  },

  deleteFile: async (projectId: string, fileId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/files/${fileId}`);
  },
};

export default projectsApi;
