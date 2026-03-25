/**
 * Query & Search API
 */

import apiClient from "./client";

export interface SearchResult {
  file_id: string;
  filename: string;
  lifecycle_phase: string;
  score: number;
  snippets: string[];
  keywords: string[];
  tables_count: number;
  standards_applied: { code: string; name: string; role: string }[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export interface QueryStats {
  total_documents: number;
  processed_documents: number;
  total_tables: number;
  total_keywords: number;
  by_phase: Record<string, number>;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
}

export interface ParsedData {
  file_id: string;
  original_filename: string;
  lifecycle_phase: string;
  processed_at: string;
  extension: string;
  status: string;
  full_text: string;
  sections: { title: string; page?: number; level?: number }[];
  tables: { headers: string[]; rows: string[][]; row_count: number; sheet?: string; page?: number }[];
  metadata: Record<string, any>;
  keywords: { word: string; count: number }[];
  statistics: Record<string, number>;
  standards_applied: { code: string; name: string; role: string }[];
  standards_pipeline: any[];
  validation_summary?: {
    ids_compliance: number;
    ids_checks: any[];
    loin_level: string;
    total_checks: number;
    passed_checks: number;
  };
  bsdd_mappings?: { keyword: string; bsdd_class: string; uri: string }[];
  error?: string;
}

export const queryApi = {
  search: async (query: string, projectId?: string, lifecyclePhase?: string): Promise<SearchResponse> => {
    const { data } = await apiClient.post("/query/search", {
      query,
      project_id: projectId || null,
      lifecycle_phase: lifecyclePhase || null,
    });
    return data;
  },

  getStats: async (): Promise<QueryStats> => {
    const { data } = await apiClient.get("/query/stats");
    return data;
  },

  getParsedData: async (projectId: string, fileId: string): Promise<ParsedData> => {
    const { data } = await apiClient.get(`/projects/${projectId}/files/${fileId}/parsed`);
    return data;
  },
};

export default queryApi;
