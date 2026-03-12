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
  latest_run_status?: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
}

export interface ProjectList {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
}

export const projectsApi = {
  list: async (page = 1, pageSize = 20): Promise<ProjectList> => {
    const { data } = await apiClient.get("/projects", {
      params: { page, page_size: pageSize },
    });
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

  uploadFile: async (projectId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);

    const { data } = await apiClient.post(
      `/projects/${projectId}/files/upload`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return data;
  },

  listFiles: async (projectId: string): Promise<any> => {
    const { data } = await apiClient.get(`/projects/${projectId}/files`);
    return data;
  },

  deleteFile: async (projectId: string, fileId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/files/${fileId}`);
  },
};

export default projectsApi;
