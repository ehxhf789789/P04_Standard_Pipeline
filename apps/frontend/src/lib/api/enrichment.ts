/**
 * Enrichment API
 */

import apiClient from "./client";

export interface PropertyMapping {
  original_name: string;
  standardized_name?: string;
  bsdd_uri?: string;
  bsdd_class?: string;
  confidence?: number;
  status: "mapped" | "unmapped" | "manual";
}

export interface ElementEnrichment {
  element_id: string;
  global_id: string;
  ifc_class: string;
  original_class: string;
  standardized_class?: string;
  bsdd_classification?: string;
  property_mappings: PropertyMapping[];
  enrichment_status: "enriched" | "partial" | "unchanged";
}

export interface EnrichmentSummary {
  total_elements: number;
  enriched_count: number;
  partial_count: number;
  unchanged_count: number;
  total_properties: number;
  mapped_properties: number;
  bsdd_classifications_used: string[];
}

export interface EnrichmentResults {
  summary: EnrichmentSummary;
  elements: ElementEnrichment[];
}

// Transform backend response to frontend format
function transformSummary(data: any): EnrichmentSummary {
  return {
    total_elements: data.total_elements || 0,
    enriched_count: data.elements_with_classification ?? data.enriched_count ?? 0,
    partial_count: data.properties_mapped_fuzzy ?? data.partial_count ?? 0,
    unchanged_count: data.properties_not_found ?? data.unchanged_count ?? 0,
    total_properties: data.total_properties || 0,
    mapped_properties: data.properties_mapped_exact ?? data.mapped_properties ?? 0,
    bsdd_classifications_used: data.bsdd_classifications_used || [],
  };
}

export const enrichmentApi = {
  getSummary: async (projectId: string, runId?: string): Promise<EnrichmentSummary> => {
    const params = runId ? { run_id: runId } : {};
    const { data } = await apiClient.get(`/projects/${projectId}/enrichment/summary`, { params });
    return transformSummary(data);
  },

  getResults: async (
    projectId: string,
    options?: {
      runId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<EnrichmentResults> => {
    const { data } = await apiClient.get(`/projects/${projectId}/enrichment/results`, {
      params: {
        run_id: options?.runId,
        status: options?.status,
        page: options?.page || 1,
        page_size: options?.pageSize || 50,
      },
    });
    return {
      summary: transformSummary(data.summary || {}),
      elements: data.elements || [],
    };
  },

  getMappings: async (projectId: string, runId?: string): Promise<PropertyMapping[]> => {
    const params = runId ? { run_id: runId } : {};
    const { data } = await apiClient.get(`/projects/${projectId}/enrichment/mappings`, { params });
    return data.mappings || data;
  },
};

export default enrichmentApi;
