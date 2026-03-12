/**
 * Outputs API
 */

import apiClient from "./client";

export interface OutputFile {
  id: string;
  file_type: string;
  filename: string;
  size_kb: number;
  mime_type: string;
  download_url: string;
}

export interface OutputFilesResponse {
  files: OutputFile[];
  total_size_kb: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, any>;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  statistics: Record<string, any>;
}

export interface EmbeddingVector {
  element_id: string;
  element_name: string;
  ifc_class: string;
  vector: number[];
}

export interface EmbeddingData {
  embeddings: EmbeddingVector[];
  dimension: number;
  model_name: string;
}

export interface TabularPreview {
  columns: string[];
  rows: Record<string, any>[];
  total_rows: number;
  total_columns: number;
}

export interface GNNStructure {
  num_nodes: number;
  num_edges: number;
  num_features: number;
  node_ids: string[];
  edge_index: number[][];
  feature_names: string[];
}

export const outputsApi = {
  list: async (projectId: string, runId?: string): Promise<OutputFilesResponse> => {
    const params = runId ? { run_id: runId } : {};
    const { data } = await apiClient.get(`/projects/${projectId}/outputs`, { params });
    return data;
  },

  getKnowledgeGraph: async (projectId: string, runId?: string): Promise<KnowledgeGraphData> => {
    const params = runId ? { run_id: runId } : {};
    const { data } = await apiClient.get(`/projects/${projectId}/outputs/knowledge-graph`, { params });
    return data;
  },

  getEmbeddings: async (
    projectId: string,
    runId?: string,
    includeVectors = false
  ): Promise<EmbeddingData> => {
    const params = { run_id: runId, include_vectors: includeVectors };
    const { data } = await apiClient.get(`/projects/${projectId}/outputs/embeddings`, { params });
    return data;
  },

  getTabular: async (projectId: string, runId?: string, limit = 100): Promise<TabularPreview> => {
    const params = { run_id: runId, limit };
    const { data } = await apiClient.get(`/projects/${projectId}/outputs/tabular`, { params });
    return data;
  },

  getGNNStructure: async (projectId: string, runId?: string): Promise<GNNStructure> => {
    const params = runId ? { run_id: runId } : {};
    const { data } = await apiClient.get(`/projects/${projectId}/outputs/gnn-structure`, { params });
    return data;
  },

  downloadUrl: (projectId: string, filename: string, runId?: string): string => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const params = runId ? `?run_id=${runId}` : "";
    return `${base}/api/v1/projects/${projectId}/outputs/download/${filename}${params}`;
  },

  downloadAllUrl: (projectId: string, runId?: string): string => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const params = runId ? `?run_id=${runId}` : "";
    return `${base}/api/v1/projects/${projectId}/outputs/download/all.zip${params}`;
  },
};

export default outputsApi;
